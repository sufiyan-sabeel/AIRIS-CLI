package com.kageos.airis.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

object ApiClient {

    private var baseUrl: String = "http://192.168.1.100:3000"

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private val jsonType = "application/json; charset=utf-8".toMediaType()

    fun setBaseUrl(url: String) {
        baseUrl = url.trimEnd('/')
    }

    fun getBaseUrl(): String = baseUrl

    suspend fun healthCheck(): Result<JSONObject> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/health")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: "{}"
            response.close()

            if (response.isSuccessful) {
                Result.success(JSONObject(body))
            } else {
                Result.failure(Exception("Server returned ${response.code}: $body"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun verifyAuth(token: String): Result<JSONObject> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().toString()
            val request = Request.Builder()
                .url("$baseUrl/api/auth/verify")
                .post(payload.toRequestBody(jsonType))
                .addHeader("Authorization", "Bearer $token")
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: "{}"
            response.close()

            if (response.isSuccessful) {
                Result.success(JSONObject(body))
            } else {
                Result.failure(Exception("Auth failed: ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun streamChat(
        token: String,
        message: String,
        provider: String,
        sessionId: String
    ): Flow<SseEvent> = callbackFlow {
        val payload = JSONObject().apply {
            put("message", message)
            put("provider", provider)
            put("sessionId", sessionId)
        }.toString()

        val request = Request.Builder()
            .url("$baseUrl/api/chat/stream")
            .post(payload.toRequestBody(jsonType))
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Accept", "text/event-stream")
            .build()

        val call = client.newCall(request)

        try {
            val response = call.execute()

            if (!response.isSuccessful) {
                val errorBody = response.body?.string() ?: "Unknown error"
                response.close()
                send(SseEvent.Error("Server error ${response.code}: $errorBody"))
                close()
                return@callbackFlow
            }

            val reader = BufferedReader(InputStreamReader(response.body!!.byteStream()))
            var line: String?

            while (reader.readLine().also { line = it } != null) {
                val currentLine = line ?: continue

                if (currentLine.startsWith("data: ")) {
                    val data = currentLine.removePrefix("data: ")

                    if (data == "[DONE]") {
                        send(SseEvent.Done)
                        break
                    }

                    try {
                        val json = JSONObject(data)

                        when {
                            json.has("content") -> {
                                send(SseEvent.Content(json.getString("content")))
                            }
                            json.has("error") -> {
                                send(SseEvent.Error(json.getString("error")))
                            }
                            json.has("status") -> {
                                send(SseEvent.Status(json.getString("status")))
                            }
                            json.has("taskId") -> {
                                send(SseEvent.TaskStarted(json.optInt("taskId", 0)))
                            }
                            json.has("stream") -> {
                                send(SseEvent.TerminalOutput(
                                    stream = json.getString("stream"),
                                    output = json.getString("output")
                                ))
                            }
                            json.has("exitCode") -> {
                                send(SseEvent.TaskComplete(
                                    status = json.optString("status", "unknown"),
                                    exitCode = json.optInt("exitCode", -1)
                                ))
                            }
                        }
                    } catch (_: Exception) {
                    }
                }
            }

            reader.close()
            response.close()
        } catch (e: Exception) {
            send(SseEvent.Error(e.message ?: "Connection failed"))
        }

        close()
    }

    suspend fun sendChat(
        token: String,
        message: String,
        provider: String,
        sessionId: String
    ): Result<JSONObject> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("message", message)
                put("provider", provider)
                put("sessionId", sessionId)
            }.toString()

            val request = Request.Builder()
                .url("$baseUrl/api/chat")
                .post(payload.toRequestBody(jsonType))
                .addHeader("Authorization", "Bearer $token")
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: "{}"
            response.close()

            if (response.isSuccessful) {
                Result.success(JSONObject(body))
            } else {
                Result.failure(Exception("Chat failed: ${response.code}: $body"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun executeCli(
        token: String,
        command: String,
        workDir: String? = null
    ): Result<JSONObject> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("command", command)
                if (workDir != null) put("workDir", workDir)
            }.toString()

            val request = Request.Builder()
                .url("$baseUrl/api/cli/execute")
                .post(payload.toRequestBody(jsonType))
                .addHeader("Authorization", "Bearer $token")
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: "{}"
            response.close()

            if (response.isSuccessful) {
                Result.success(JSONObject(body))
            } else {
                Result.failure(Exception("CLI failed: ${response.code}: $body"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTasks(token: String): Result<JSONArray> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/api/tasks")
                .get()
                .addHeader("Authorization", "Bearer $token")
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: "{}"
            response.close()

            if (response.isSuccessful) {
                val json = JSONObject(body)
                Result.success(json.optJSONArray("tasks") ?: JSONArray())
            } else {
                Result.failure(Exception("Tasks failed: ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createTask(
        token: String,
        name: String,
        command: String
    ): Result<JSONObject> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("name", name)
                put("command", command)
            }.toString()

            val request = Request.Builder()
                .url("$baseUrl/api/tasks")
                .post(payload.toRequestBody(jsonType))
                .addHeader("Authorization", "Bearer $token")
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: "{}"
            response.close()

            if (response.isSuccessful) {
                Result.success(JSONObject(body))
            } else {
                Result.failure(Exception("Create task failed: ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getHistory(token: String, limit: Int = 50): Result<JSONArray> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/api/history?limit=$limit")
                .get()
                .addHeader("Authorization", "Bearer $token")
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: "{}"
            response.close()

            if (response.isSuccessful) {
                val json = JSONObject(body)
                Result.success(json.optJSONArray("history") ?: JSONArray())
            } else {
                Result.failure(Exception("History failed: ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

sealed class SseEvent {
    data class Content(val text: String) : SseEvent()
    data class Error(val message: String) : SseEvent()
    data class Status(val status: String) : SseEvent()
    data class TaskStarted(val taskId: Int) : SseEvent()
    data class TerminalOutput(val stream: String, val output: String) : SseEvent()
    data class TaskComplete(val status: String, val exitCode: Int) : SseEvent()
    data object Done : SseEvent()
}
