package com.kageos.airis.ui.screens.automation

import androidx.lifecycle.ViewModel
import com.kageos.airis.core.di.AppContainer

class AutomationViewModel(private val container: AppContainer) : ViewModel() {
    val automationRepository = container.automationRepository
}
