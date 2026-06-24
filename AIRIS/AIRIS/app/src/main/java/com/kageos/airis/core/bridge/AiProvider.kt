package com.kageos.airis.core.bridge

interface AiProvider {
    suspend fun sendMessage(message: String, context: List<String> = emptyList()): String
    fun isConfigured(): Boolean
    fun getProviderName(): String
}
