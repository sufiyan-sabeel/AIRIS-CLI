package com.kageos.airis

import android.app.Application
import com.kageos.airis.core.di.AppContainer
import com.kageos.airis.core.model.LogLevel
import com.kageos.airis.core.repository.LogRepository

class AirisApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)

        // Log app startup
        LogRepository.getInstance().addLog(
            LogLevel.INFO,
            "App",
            "AIRIS v1.0.0 started"
        )
        LogRepository.getInstance().addLog(
            LogLevel.INFO,
            "App",
            "Package: $packageName"
        )
    }
}
