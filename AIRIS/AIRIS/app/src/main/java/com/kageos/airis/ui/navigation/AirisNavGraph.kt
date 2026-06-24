package com.kageos.airis.ui.navigation

import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.kageos.airis.core.di.AppContainer
import com.kageos.airis.ui.screens.auth.SignInScreen
import com.kageos.airis.ui.screens.splash.SplashScreen
import com.kageos.airis.ui.screens.welcome.WelcomeScreen
import com.kageos.airis.ui.screens.home.HomeScreen
import com.kageos.airis.ui.screens.chat.ChatScreen
import com.kageos.airis.ui.screens.automation.AutomationScreen
import com.kageos.airis.ui.screens.tasks.TasksScreen
import com.kageos.airis.ui.screens.logs.LogsScreen
import com.kageos.airis.ui.screens.settings.SettingsScreen
import com.kageos.airis.ui.screens.providers.ProvidersScreen
import com.kageos.airis.ui.screens.permissions.PermissionsScreen
import com.kageos.airis.ui.screens.ide.IdeScreen
import com.kageos.airis.feature.coding.ui.RealIdeScreen

@Composable
fun AirisNavGraph(
    navController: NavHostController,
    container: AppContainer,
    startDestination: String = Screen.Splash.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination,
        enterTransition = { fadeIn() },
        exitTransition = { fadeOut() }
    ) {
        composable(Screen.Splash.route) {
            SplashScreen(
                container = container,
                onNavigateToWelcome = {
                    navController.navigate(Screen.Welcome.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToHome = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Welcome.route) {
            WelcomeScreen(
                container = container,
                onNavigateToHome = {
                    navController.navigate(Screen.SignIn.route) {
                        popUpTo(Screen.Welcome.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.SignIn.route) {
            SignInScreen(
                container = container,
                onSignInSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.SignIn.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Home.route) {
            HomeScreen(
                container = container,
                onNavigateToChat = { navController.navigate(Screen.Chat.route) },
                onNavigateToAutomation = { navController.navigate(Screen.Automation.route) },
                onNavigateToTasks = { navController.navigate(Screen.Tasks.route) },
                onNavigateToLogs = { navController.navigate(Screen.Logs.route) },
                onNavigateToSettings = { navController.navigate(Screen.Settings.route) },
                onNavigateToProviders = { navController.navigate(Screen.Providers.route) },
                onNavigateToPermissions = { navController.navigate(Screen.Permissions.route) },
                onNavigateToIde = { navController.navigate(Screen.Ide.route) }
            )
        }

        composable(Screen.Chat.route) {
            ChatScreen(
                container = container,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Automation.route) {
            AutomationScreen(
                container = container,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Tasks.route) {
            TasksScreen(
                container = container,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Logs.route) {
            LogsScreen(
                container = container,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Settings.route) {
            SettingsScreen(
                container = container,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToPermissions = { navController.navigate(Screen.Permissions.route) }
            )
        }

        composable(Screen.Providers.route) {
            ProvidersScreen(
                container = container,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Permissions.route) {
            PermissionsScreen(
                container = container,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Ide.route) {
            RealIdeScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
