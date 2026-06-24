package com.kageos.airis.core.bridge

interface CodingAgentBridge {
    suspend fun readFile(path: String): Result<String>
    suspend fun writeFile(path: String, content: String): Result<Unit>
    suspend fun listProjectFiles(path: String): Result<List<String>>
    suspend fun executeCommand(command: String): Result<String>
    fun isAvailable(): Boolean
}
