package com.kageos.airis.ui.screens.settings

import androidx.lifecycle.ViewModel
import com.kageos.airis.core.di.AppContainer

class SettingsViewModel(private val container: AppContainer) : ViewModel() {
    val preferencesManager = container.preferencesManager
}
