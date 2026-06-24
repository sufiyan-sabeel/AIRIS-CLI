package com.kageos.airis.core.repository

import com.kageos.airis.core.model.AutomationTask
import com.kageos.airis.core.model.AutomationType
import com.kageos.airis.core.model.LogLevel
import com.kageos.airis.core.model.TaskHistoryItem
import com.kageos.airis.core.model.TaskStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AutomationRepository {
    private val _tasks = MutableStateFlow<List<AutomationTask>>(emptyList())
    val tasks: StateFlow<List<AutomationTask>> = _tasks.asStateFlow()

    private val _history = MutableStateFlow<List<TaskHistoryItem>>(emptyList())
    val history: StateFlow<List<TaskHistoryItem>> = _history.asStateFlow()

    private val logRepository = LogRepository.getInstance()

    fun addTask(task: AutomationTask) {
        _tasks.value = _tasks.value + task
        logRepository.addLog(LogLevel.INFO, "Automation", "Task created: ${task.name}")
    }

    fun removeTask(taskId: String) {
        val task = _tasks.value.find { it.id == taskId }
        _tasks.value = _tasks.value.filter { it.id != taskId }
        task?.let {
            logRepository.addLog(LogLevel.INFO, "Automation", "Task deleted: ${it.name}")
        }
    }

    fun toggleTask(taskId: String) {
        _tasks.value = _tasks.value.map {
            if (it.id == taskId) {
                val newState = !it.isEnabled
                logRepository.addLog(
                    LogLevel.INFO,
                    "Automation",
                    "Task ${it.name} ${if (newState) "enabled" else "disabled"}"
                )
                it.copy(isEnabled = newState)
            } else it
        }
    }

    fun addHistoryItem(item: TaskHistoryItem) {
        _history.value = _history.value + item
        logRepository.addLog(
            LogLevel.INFO,
            "Automation",
            "Task completed: ${item.taskName} - ${item.status}"
        )
    }

    fun clearHistory() {
        _history.value = emptyList()
        logRepository.addLog(LogLevel.INFO, "Automation", "Task history cleared")
    }

    fun simulateTaskRun(task: AutomationTask) {
        val historyItem = TaskHistoryItem(
            taskName = task.name,
            status = TaskStatus.COMPLETED,
            completedAt = System.currentTimeMillis(),
            output = "Task '${task.name}' executed successfully (demo mode)"
        )
        addHistoryItem(historyItem)
    }
}
