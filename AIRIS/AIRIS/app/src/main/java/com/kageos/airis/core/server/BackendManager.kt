package com.kageos.airis.core.server

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

object BackendManager {

    private const val SERVER_URL = "http://127.0.0.1:3000"
    private const val BACKEND_DIR = "/storage/emulated/0/Download/AIRIS-CLI/backend"
    private const val START_SCRIPT = "$BACKEND_DIR/start.sh"

    private val client = OkHttpClient.Builder()
        .connectTimeout(2, TimeUnit.SECONDS)
        .readTimeout(3, TimeUnit.SECONDS)
        .writeTimeout(2, TimeUnit.SECONDS)
        .build()

    private val jsonType = "application/json; charset=utf-8".toMediaType()

    private var serverProcess: Process? = null

    suspend fun checkStatus(): ServerState = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$SERVER_URL/api/system/health")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: "{}"
            response.close()

            if (response.isSuccessful) {
                val json = JSONObject(body)
                ServerState.Online(
                    uptime = json.optLong("uptime", 0L),
                    memoryUsed = json.optJSONObject("memory")?.optInt("rss", 0) ?: 0,
                    memoryTotal = json.optJSONObject("memory")?.optInt("heapTotal", 0) ?: 0,
                    pid = json.optInt("pid", 0),
                    nodeVersion = json.optString("nodeVersion", ""),
                    platform = json.optString("platform", "")
                )
            } else {
                ServerState.Offline
            }
        } catch (_: Exception) {
            ServerState.Offline
        }
    }

    suspend fun startServer(): ServerState = withContext(Dispatchers.IO) {
        val existing = checkStatus()
        if (existing is ServerState.Online) {
            return@withContext existing
        }

        val scriptFile = File(START_SCRIPT)
        if (!scriptFile.exists()) {
            return@withContext ServerState.Error("start.sh not found at $START_SCRIPT")
        }

        try {
            val processBuilder = ProcessBuilder(
                "/system/bin/sh", START_SCRIPT
            )
            processBuilder.directory(File(BACKEND_DIR))
            processBuilder.redirectErrorStream(true)

            serverProcess = processBuilder.start()

            val reader = BufferedReader(InputStreamReader(serverProcess!!.inputStream))
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                val text = line ?: continue
                if (text.contains("AIRIS Backend running")) {
                    break
                }
                if (text.contains("Error") || text.contains("EACCES")) {
                    serverProcess?.destroy()
                    return@withContext ServerState.Error(text)
                }
            }

            for (i in 1..10) {
                val status = checkStatus()
                if (status is ServerState.Online) {
                    return@withContext status
                }
                Thread.sleep(500)
            }

            ServerState.Error("Server started but health check timed out")
        } catch (e: Exception) {
            ServerState.Error("Failed to start: ${e.message}")
        }
    }

    suspend fun stopServer(): ServerState = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().toString()
            val request = Request.Builder()
                .url("$SERVER_URL/api/system/shutdown")
                .post(payload.toRequestBody(jsonType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: "{}"
            response.close()

            serverProcess?.destroy()
            serverProcess = null

            Thread.sleep(1500)

            val finalStatus = checkStatus()
            if (finalStatus is ServerState.Offline) {
                ServerState.Offline
            } else {
                ServerState.Error("Shutdown requested but server still responding")
            }
        } catch (_: Exception) {
            serverProcess?.destroy()
            serverProcess = null
            ServerState.Offline
        }
    }

    fun isProcessRunning(): Boolean {
        return try {
            serverProcess?.exitValue()
            false
        } catch (_: IllegalThreadStateException) {
            true
        }
    }
}
