package com.kageos.airis.core.di

import android.content.Context
import com.kageos.airis.core.data.PreferencesManager
import com.kageos.airis.core.network.ApiClient
import com.kageos.airis.core.repository.AutomationRepository
import com.kageos.airis.core.repository.ChatRepository
import com.kageos.airis.core.repository.LogRepository
import com.kageos.airis.core.repository.ProviderRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class AppContainer(context: Context) {
    val preferencesManager = PreferencesManager(context)
    val chatRepository = ChatRepository()
    val providerRepository = ProviderRepository()
    val automationRepository = AutomationRepository()
    val logRepository = LogRepository()

    private val initScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    init {
        initScope.launch {
            val url = preferencesManager.backendUrl.first()
            ApiClient.setBaseUrl(url)

            LogRepository.getInstance().addLog(
                com.kageos.airis.core.model.LogLevel.INFO,
                "AppContainer",
                "Backend URL: $url"
            )
        }
    }

    suspend fun updateBackendUrl(url: String) {
        preferencesManager.setBackendUrl(url)
        ApiClient.setBaseUrl(url)
    }
}
