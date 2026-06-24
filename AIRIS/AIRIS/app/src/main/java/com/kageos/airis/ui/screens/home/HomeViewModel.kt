package com.kageos.airis.ui.screens.home

import androidx.lifecycle.ViewModel
import com.kageos.airis.core.di.AppContainer

class HomeViewModel(private val container: AppContainer) : ViewModel() {
    val chatRepository = container.chatRepository
    val automationRepository = container.automationRepository
}
