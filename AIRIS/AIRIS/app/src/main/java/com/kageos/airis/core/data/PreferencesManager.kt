package com.kageos.airis.core.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.kageos.airis.core.model.ThemeOption
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "airis_settings")

class PreferencesManager(private val context: Context) {

    companion object {
        private val THEME_KEY = stringPreferencesKey("theme_option")
        private val WELCOME_SHOWN_KEY = stringPreferencesKey("welcome_shown")
        private val TELEGRAM_TOKEN_KEY = stringPreferencesKey("telegram_token")
        private val TELEGRAM_USER_ID_KEY = stringPreferencesKey("telegram_user_id")
        private val API_KEY_OPENAI = stringPreferencesKey("api_key_openai")
        private val API_KEY_GROK = stringPreferencesKey("api_key_grok")
        private val API_KEY_OPENROUTER = stringPreferencesKey("api_key_openrouter")
        private val API_KEY_CUSTOM = stringPreferencesKey("api_key_custom")
        private val BASE_URL_CUSTOM = stringPreferencesKey("base_url_custom")
        private val VOICE_ENABLED = stringPreferencesKey("voice_enabled")
        private val VOICE_RATE = stringPreferencesKey("voice_rate")
        private val VOICE_PITCH = stringPreferencesKey("voice_pitch")
        private val BACKEND_URL_KEY = stringPreferencesKey("backend_url")
        private val AUTH_TOKEN_KEY = stringPreferencesKey("auth_token")
        private val USER_UID_KEY = stringPreferencesKey("user_uid")
        private val USER_EMAIL_KEY = stringPreferencesKey("user_email")
        private val ACTIVE_PROVIDER_KEY = stringPreferencesKey("active_provider")
    }

    val themeOption: Flow<ThemeOption> = context.dataStore.data.map { prefs ->
        try {
            ThemeOption.valueOf(prefs[THEME_KEY] ?: ThemeOption.AMOLED_DARK.name)
        } catch (_: Exception) {
            ThemeOption.AMOLED_DARK
        }
    }

    val isWelcomeShown: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[WELCOME_SHOWN_KEY] == "true"
    }

    val telegramToken: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[TELEGRAM_TOKEN_KEY] ?: ""
    }

    val telegramUserId: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[TELEGRAM_USER_ID_KEY] ?: ""
    }

    val isVoiceEnabled: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[VOICE_ENABLED] == "true"
    }

    val voiceRate: Flow<Float> = context.dataStore.data.map { prefs ->
        prefs[VOICE_RATE]?.toFloatOrNull() ?: 1.0f
    }

    val voicePitch: Flow<Float> = context.dataStore.data.map { prefs ->
        prefs[VOICE_PITCH]?.toFloatOrNull() ?: 1.0f
    }

    suspend fun setTheme(option: ThemeOption) {
        context.dataStore.edit { prefs ->
            prefs[THEME_KEY] = option.name
        }
    }

    suspend fun setWelcomeShown() {
        context.dataStore.edit { prefs ->
            prefs[WELCOME_SHOWN_KEY] = "true"
        }
    }

    suspend fun setTelegramToken(token: String) {
        context.dataStore.edit { prefs ->
            prefs[TELEGRAM_TOKEN_KEY] = token
        }
    }

    suspend fun setTelegramUserId(userId: String) {
        context.dataStore.edit { prefs ->
            prefs[TELEGRAM_USER_ID_KEY] = userId
        }
    }

    suspend fun setApiKey(providerId: String, apiKey: String) {
        context.dataStore.edit { prefs ->
            val key = when (providerId) {
                "openai" -> API_KEY_OPENAI
                "grok" -> API_KEY_GROK
                "openrouter" -> API_KEY_OPENROUTER
                "custom" -> API_KEY_CUSTOM
                else -> return@edit
            }
            prefs[key] = apiKey
        }
    }

    fun getApiKey(providerId: String): Flow<String> = context.dataStore.data.map { prefs ->
        val key = when (providerId) {
            "openai" -> API_KEY_OPENAI
            "grok" -> API_KEY_GROK
            "openrouter" -> API_KEY_OPENROUTER
            "custom" -> API_KEY_CUSTOM
            else -> return@map ""
        }
        prefs[key] ?: ""
    }

    suspend fun setBaseUrl(baseUrl: String) {
        context.dataStore.edit { prefs ->
            prefs[BASE_URL_CUSTOM] = baseUrl
        }
    }

    fun getBaseUrl(): Flow<String> = context.dataStore.data.map { prefs ->
        prefs[BASE_URL_CUSTOM] ?: ""
    }

    suspend fun setVoiceEnabled(enabled: Boolean) {
        context.dataStore.edit { prefs ->
            prefs[VOICE_ENABLED] = enabled.toString()
        }
    }

    suspend fun setVoiceRate(rate: Float) {
        context.dataStore.edit { prefs ->
            prefs[VOICE_RATE] = rate.toString()
        }
    }

    suspend fun setVoicePitch(pitch: Float) {
        context.dataStore.edit { prefs ->
            prefs[VOICE_PITCH] = pitch.toString()
        }
    }

    val backendUrl: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[BACKEND_URL_KEY] ?: "http://192.168.1.100:3000"
    }

    suspend fun setBackendUrl(url: String) {
        context.dataStore.edit { prefs ->
            prefs[BACKEND_URL_KEY] = url
        }
    }

    val authToken: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[AUTH_TOKEN_KEY] ?: ""
    }

    suspend fun setAuthToken(token: String) {
        context.dataStore.edit { prefs ->
            prefs[AUTH_TOKEN_KEY] = token
        }
    }

    val userUid: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[USER_UID_KEY] ?: ""
    }

    suspend fun setUserUid(uid: String) {
        context.dataStore.edit { prefs ->
            prefs[USER_UID_KEY] = uid
        }
    }

    val userEmail: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[USER_EMAIL_KEY] ?: ""
    }

    suspend fun setUserEmail(email: String) {
        context.dataStore.edit { prefs ->
            prefs[USER_EMAIL_KEY] = email
        }
    }

    val activeProvider: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[ACTIVE_PROVIDER_KEY] ?: "openai"
    }

    suspend fun setActiveProvider(provider: String) {
        context.dataStore.edit { prefs ->
            prefs[ACTIVE_PROVIDER_KEY] = provider
        }
    }

    suspend fun clearAuth() {
        context.dataStore.edit { prefs ->
            prefs.remove(AUTH_TOKEN_KEY)
            prefs.remove(USER_UID_KEY)
            prefs.remove(USER_EMAIL_KEY)
        }
    }
}
