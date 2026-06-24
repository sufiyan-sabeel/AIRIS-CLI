package com.kageos.airis.core.bridge

interface AutomationBridge {
    suspend fun executeCommand(command: String): Result<String>
    fun isAvailable(): Boolean
    fun getBridgeName(): String
}
