package com.kageos.airis.feature.dashboard.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kageos.airis.core.server.BackendManager
import com.kageos.airis.core.server.ServerState
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class DashboardViewModel : ViewModel() {

    private val _serverState = MutableStateFlow<ServerState>(ServerState.Offline)
    val serverState: StateFlow<ServerState> = _serverState.asStateFlow()

    private val _isPolling = MutableStateFlow(false)
    val isPolling: StateFlow<Boolean> = _isPolling.asStateFlow()

    init {
        startPolling()
    }

    private fun startPolling() {
        viewModelScope.launch {
            _isPolling.value = true
            while (isActive) {
                val current = _serverState.value
                if (current is ServerState.Starting) {
                    delay(1000)
                    continue
                }
                val status = BackendManager.checkStatus()
                _serverState.value = status
                delay(5000)
            }
            _isPolling.value = false
        }
    }

    fun startServer() {
        if (_serverState.value is ServerState.Starting) return
        _serverState.value = ServerState.Starting
        viewModelScope.launch {
            val result = BackendManager.startServer()
            _serverState.value = result
        }
    }

    fun stopServer() {
        if (_serverState.value is ServerState.Starting) return
        viewModelScope.launch {
            _serverState.value = ServerState.Starting
            val result = BackendManager.stopServer()
            _serverState.value = result
        }
    }

    fun refreshStatus() {
        viewModelScope.launch {
            val status = BackendManager.checkStatus()
            _serverState.value = status
        }
    }
}
