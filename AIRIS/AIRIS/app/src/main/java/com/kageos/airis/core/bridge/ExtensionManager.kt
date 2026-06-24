package com.kageos.airis.core.bridge

interface ExtensionManager {
    fun getInstalledExtensions(): List<String>
    fun isInstalled(extensionId: String): Boolean
    suspend fun install(extensionId: String): Result<Unit>
    suspend fun uninstall(extensionId: String): Result<Unit>
    fun getAvailableExtensions(): List<String>
}
