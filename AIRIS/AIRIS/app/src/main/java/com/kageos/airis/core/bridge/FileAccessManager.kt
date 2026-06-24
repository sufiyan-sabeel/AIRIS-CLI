package com.kageos.airis.core.bridge

interface FileAccessManager {
    fun listFiles(path: String): List<String>
    fun readFile(path: String): Result<String>
    fun writeFile(path: String, content: String): Result<Unit>
    fun createDirectory(path: String): Result<Unit>
    fun deleteFile(path: String): Result<Unit>
    fun isAvailable(): Boolean
}
