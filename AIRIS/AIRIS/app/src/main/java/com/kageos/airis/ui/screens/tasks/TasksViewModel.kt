package com.kageos.airis.ui.screens.tasks

import androidx.lifecycle.ViewModel
import com.kageos.airis.core.di.AppContainer

class TasksViewModel(private val container: AppContainer) : ViewModel() {
    val automationRepository = container.automationRepository
}
