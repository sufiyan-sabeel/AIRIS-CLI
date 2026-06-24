package com.kageos.airis.core.bridge

interface TerminalBridge {
    suspend fun execute(command: String): Result<String>
    fun isAvailable(): Boolean
    fun getWorkingDirectory(): String
    fun setWorkingDirectory(path: String)
}
