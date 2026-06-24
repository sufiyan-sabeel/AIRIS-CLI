package com.kageos.airis.core.model

data class AutomationTask(
    val id: String = System.currentTimeMillis().toString(),
    val name: String,
    val description: String,
    val type: AutomationType,
    val isEnabled: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

enum class AutomationType {
    SCHEDULED, TRIGGERED, MANUAL
}
