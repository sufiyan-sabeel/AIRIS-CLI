package com.kageos.airis.core.repository

import com.kageos.airis.core.model.LogEntry
import com.kageos.airis.core.model.LogLevel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class LogRepository {
    private val _logs = MutableStateFlow<List<LogEntry>>(emptyList())
    val logs: StateFlow<List<LogEntry>> = _logs.asStateFlow()

    companion object {
        @Volatile
        private var instance: LogRepository? = null

        fun getInstance(): LogRepository {
            return instance ?: synchronized(this) {
                instance ?: LogRepository().also { instance = it }
            }
        }
    }

    fun addLog(level: LogLevel, tag: String, message: String) {
        val entry = LogEntry(
            level = level,
            tag = tag,
            message = message
        )
        _logs.value = _logs.value + entry
    }

    fun clearLogs() {
        _logs.value = emptyList()
    }

    fun getLogsByLevel(level: LogLevel): List<LogEntry> {
        return _logs.value.filter { it.level == level }
    }
}
