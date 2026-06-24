package com.kageos.airis

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.kageos.airis.core.model.ThemeOption
import com.kageos.airis.ui.navigation.AirisNavGraph
import com.kageos.airis.ui.theme.AirisTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as AirisApp

        setContent {
            val themeOption by app.container.preferencesManager.themeOption.collectAsState(
                initial = ThemeOption.AMOLED_DARK
            )

            AirisTheme(themeOption = themeOption) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val navController = rememberNavController()
                    AirisNavGraph(
                        navController = navController,
                        container = app.container
                    )
                }
            }
        }
    }
}
