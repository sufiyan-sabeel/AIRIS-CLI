package com.kageos.airis.core.bridge

interface TelegramBridge {
    suspend fun sendMessage(chatId: String, text: String): Result<Unit>
    suspend fun getUpdates(): Result<List<String>>
    fun isConfigured(): Boolean
    fun getBridgeName(): String
}
