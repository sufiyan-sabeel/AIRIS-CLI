package com.kageos.airis.ui.navigation

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object Welcome : Screen("welcome")
    object SignIn : Screen("sign_in")
    object Home : Screen("home")
    object Chat : Screen("chat")
    object Automation : Screen("automation")
    object Tasks : Screen("tasks")
    object Logs : Screen("logs")
    object Settings : Screen("settings")
    object Providers : Screen("providers")
    object Permissions : Screen("permissions")
    object Ide : Screen("ide")
}

val bottomBarScreens = listOf(
    Screen.Home,
    Screen.Chat,
    Screen.Automation,
    Screen.Settings
)
