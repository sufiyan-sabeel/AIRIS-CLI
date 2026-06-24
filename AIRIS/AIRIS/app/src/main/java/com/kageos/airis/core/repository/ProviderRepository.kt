package com.kageos.airis.core.repository

import com.kageos.airis.core.model.ProviderConfig
import com.kageos.airis.core.model.ProviderType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class ProviderRepository {

    private val _providers = MutableStateFlow(
        listOf(
            ProviderConfig(
                id = "openai",
                name = "OpenAI",
                type = ProviderType.OPENAI,
                model = "gpt-4",
                isActive = true
            ),
            ProviderConfig(
                id = "grok",
                name = "Grok",
                type = ProviderType.GROK,
                model = "grok-2",
                isActive = false
            ),
            ProviderConfig(
                id = "openrouter",
                name = "OpenRouter",
                type = ProviderType.OPENROUTER,
                model = "auto",
                isActive = false
            ),
            ProviderConfig(
                id = "custom",
                name = "Custom Provider",
                type = ProviderType.CUSTOM,
                isActive = false
            )
        )
    )
    val providers: StateFlow<List<ProviderConfig>> = _providers.asStateFlow()

    fun updateProvider(config: ProviderConfig) {
        _providers.value = _providers.value.map {
            if (it.id == config.id) config else it
        }
    }

    fun getActiveProvider(): ProviderConfig? {
        return _providers.value.find { it.isActive }
    }

    fun setActiveProvider(providerId: String) {
        _providers.value = _providers.value.map {
            it.copy(isActive = it.id == providerId)
        }
    }
}
