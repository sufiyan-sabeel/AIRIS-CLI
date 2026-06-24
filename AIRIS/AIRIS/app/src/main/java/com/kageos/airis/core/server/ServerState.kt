package com.kageos.airis.core.server

sealed class ServerState {
    data object Offline : ServerState()
    data object Starting : ServerState()
    data class Online(
        val uptime: Long = 0L,
        val memoryUsed: Int = 0,
        val memoryTotal: Int = 0,
        val pid: Int = 0,
        val nodeVersion: String = "",
        val platform: String = ""
    ) : ServerState()
    data class Error(val message: String) : ServerState()
}
