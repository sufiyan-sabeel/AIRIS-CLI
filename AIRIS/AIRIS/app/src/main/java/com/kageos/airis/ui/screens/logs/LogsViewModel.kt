package com.kageos.airis.ui.screens.logs

import androidx.lifecycle.ViewModel
import com.kageos.airis.core.di.AppContainer
import com.kageos.airis.core.model.LogLevel

class LogsViewModel(private val container: AppContainer) : ViewModel() {
    val logRepository = container.logRepository

    fun addLog(level: LogLevel, tag: String, message: String) {
        logRepository.addLog(level, tag, message)
    }
}
