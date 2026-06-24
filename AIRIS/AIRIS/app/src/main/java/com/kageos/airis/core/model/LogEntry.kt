package com.kageos.airis.core.model

data class LogEntry(
    val id: String = System.currentTimeMillis().toString(),
    val level: LogLevel,
    val tag: String,
    val message: String,
    val timestamp: Long = System.currentTimeMillis()
)

enum class LogLevel {
    DEBUG, INFO, WARNING, ERROR
}
