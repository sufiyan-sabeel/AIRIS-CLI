package com.kageos.airis.core.model

data class ChatMessage(
    val id: String = System.currentTimeMillis().toString(),
    val content: String,
    val isFromUser: Boolean,
    val timestamp: Long = System.currentTimeMillis(),
    val provider: String = ""
)
