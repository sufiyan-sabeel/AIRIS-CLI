package com.kageos.airis.core.model

data class TaskHistoryItem(
    val id: String = System.currentTimeMillis().toString(),
    val taskName: String,
    val status: TaskStatus,
    val startedAt: Long = System.currentTimeMillis(),
    val completedAt: Long? = null,
    val output: String = ""
)

enum class TaskStatus {
    PENDING, RUNNING, COMPLETED, FAILED
}
