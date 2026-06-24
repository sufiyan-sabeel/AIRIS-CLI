package com.kageos.airis.ui.components

import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat

@Composable
fun rememberPermissionHandler(
    permission: String,
    onGranted: () -> Unit = {},
    onDenied: () -> Unit = {}
): PermissionHandlerState {
    val context = LocalContext.current
    var isGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        )
    }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        isGranted = granted
        if (granted) onGranted() else onDenied()
    }

    return remember(permission) {
        PermissionHandlerState(
            permission = permission,
            isGranted = { isGranted },
            requestPermission = { launcher.launch(permission) }
        )
    }
}

class PermissionHandlerState(
    private val permission: String,
    private val isGranted: () -> Boolean,
    private val requestPermission: () -> Unit
) {
    fun check() = isGranted()
    fun request() = requestPermission()
}
