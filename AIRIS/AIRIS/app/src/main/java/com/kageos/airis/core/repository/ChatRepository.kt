package com.kageos.airis.core.repository

import com.kageos.airis.core.model.ChatMessage
import com.kageos.airis.core.network.ApiClient
import com.kageos.airis.core.network.SseEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ChatRepository {

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _isStreaming = MutableStateFlow(false)
    val isStreaming: StateFlow<Boolean> = _isStreaming.asStateFlow()

    private val _streamingContent = MutableStateFlow("")
    val streamingContent: StateFlow<String> = _streamingContent.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private var streamJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO)

    fun addMessage(message: ChatMessage) {
        _messages.value = _messages.value + message
    }

    fun sendMessage(
        token: String,
        message: String,
        provider: String,
        sessionId: String
    ) {
        if (_isStreaming.value) return
        if (message.isBlank()) return

        val userMsg = ChatMessage(
            content = message,
            isFromUser = true,
            provider = provider
        )
        addMessage(userMsg)
        _isStreaming.value = true
        _streamingContent.value = ""
        _error.value = null

        streamJob = scope.launch {
            var fullResponse = ""

            try {
                ApiClient.streamChat(token, message, provider, sessionId).collect { event ->
                    when (event) {
                        is SseEvent.Content -> {
                            fullResponse += event.text
                            _streamingContent.value = fullResponse
                        }
                        is SseEvent.Error -> {
                            _error.value = event.message
                        }
                        is SseEvent.Done -> {
                        }
                        else -> {}
                    }
                }

                if (fullResponse.isNotEmpty()) {
                    val aiMsg = ChatMessage(
                        content = fullResponse,
                        isFromUser = false,
                        provider = provider
                    )
                    addMessage(aiMsg)
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Connection failed"
            } finally {
                _isStreaming.value = false
                _streamingContent.value = ""
            }
        }
    }

    fun sendMessageNonStream(
        token: String,
        message: String,
        provider: String,
        sessionId: String
    ) {
        if (_isStreaming.value) return
        if (message.isBlank()) return

        val userMsg = ChatMessage(
            content = message,
            isFromUser = true,
            provider = provider
        )
        addMessage(userMsg)
        _isStreaming.value = true
        _error.value = null

        streamJob = scope.launch {
            try {
                val result = ApiClient.sendChat(token, message, provider, sessionId)
                result.fold(
                    onSuccess = { json ->
                        val content = json.optString("content", "")
                        if (content.isNotEmpty()) {
                            val aiMsg = ChatMessage(
                                content = content,
                                isFromUser = false,
                                provider = provider
                            )
                            addMessage(aiMsg)
                        }
                    },
                    onFailure = { err ->
                        _error.value = err.message ?: "Request failed"
                    }
                )
            } catch (e: Exception) {
                _error.value = e.message ?: "Connection failed"
            } finally {
                _isStreaming.value = false
            }
        }
    }

    fun clearMessages() {
        _messages.value = emptyList()
        _error.value = null
    }

    fun clearError() {
        _error.value = null
    }

    fun getMessages(): List<ChatMessage> = _messages.value

    fun cancelStream() {
        streamJob?.cancel()
        _isStreaming.value = false
        _streamingContent.value = ""
    }
}
