package com.kageos.airis.core.model

data class ProviderConfig(
    val id: String = System.currentTimeMillis().toString(),
    val name: String,
    val type: ProviderType,
    val apiKey: String = "",
    val baseUrl: String = "",
    val model: String = "",
    val isActive: Boolean = false
)

enum class ProviderType {
    OPENAI, GROK, OPENROUTER, CUSTOM
}
