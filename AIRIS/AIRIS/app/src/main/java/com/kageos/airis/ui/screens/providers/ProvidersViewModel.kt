package com.kageos.airis.ui.screens.providers

import androidx.lifecycle.ViewModel
import com.kageos.airis.core.di.AppContainer

class ProvidersViewModel(private val container: AppContainer) : ViewModel() {
    val providerRepository = container.providerRepository
}
