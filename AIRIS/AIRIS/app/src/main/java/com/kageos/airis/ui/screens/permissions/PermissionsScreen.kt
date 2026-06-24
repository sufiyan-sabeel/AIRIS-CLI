package com.kageos.airis.ui.screens.permissions

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.kageos.airis.core.di.AppContainer
import com.kageos.airis.core.model.PermissionItem
import com.kageos.airis.ui.components.ConfirmActionDialog
import com.kageos.airis.ui.components.PlaceholderSwitch

@Composable
fun PermissionsScreen(
    container: AppContainer,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    var showPhoneConfirm by remember { mutableStateOf(false) }

    val permissions = listOf(
        PermissionItem(
            id = "internet",
            name = "Internet Access",
            description = "Required for AI provider communication",
            isGranted = true,
            isRequired = true
        ),
        PermissionItem(
            id = "notifications",
            name = "Notifications",
            description = "Receive task completion notifications",
            isGranted = ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED,
            isRequired = false
        ),
        PermissionItem(
            id = "microphone",
            name = "Microphone",
            description = "Voice input for AI chat",
            isGranted = ContextCompat.checkSelfPermission(
                context, Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED,
            isDangerous = true
        ),
        PermissionItem(
            id = "storage",
            name = "File Access",
            description = "Access local project files for coding assistant",
            isGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    context, Manifest.permission.READ_MEDIA_IMAGES
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                ContextCompat.checkSelfPermission(
                    context, Manifest.permission.READ_EXTERNAL_STORAGE
                ) == PackageManager.PERMISSION_GRANTED
            },
            isDangerous = true
        ),
        PermissionItem(
            id = "phone",
            name = "Phone Calls",
            description = "Make phone calls via AI commands (requires confirmation)",
            isGranted = ContextCompat.checkSelfPermission(
                context, Manifest.permission.CALL_PHONE
            ) == PackageManager.PERMISSION_GRANTED,
            isDangerous = true
        )
    )

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { /* Handle result */ }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        Spacer(modifier = Modifier.height(40.dp))

        Text(
            text = "Permissions",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = "Manage app access rights",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        permissions.forEach { permission ->
            PermissionCard(
                permission = permission,
                onRequest = {
                    when (permission.id) {
                        "notifications" -> launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        "microphone" -> launcher.launch(Manifest.permission.RECORD_AUDIO)
                        "phone" -> showPhoneConfirm = true
                        "storage" -> {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                launcher.launch(Manifest.permission.READ_MEDIA_IMAGES)
                            } else {
                                launcher.launch(Manifest.permission.READ_EXTERNAL_STORAGE)
                            }
                        }
                    }
                }
            )
            Spacer(modifier = Modifier.height(8.dp))
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Safety info
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            ),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Safety Notice",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "AIRIS will never make phone calls, send SMS, or access private data without your explicit confirmation. Dangerous actions always require user consent.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(80.dp))
    }

    // Phone call confirmation
    if (showPhoneConfirm) {
        ConfirmActionDialog(
            title = "Phone Call Permission",
            message = "AIRIS needs phone call permission to make calls on your behalf. This will only happen when you explicitly request it.\n\nDo you want to grant this permission?",
            confirmText = "Grant Permission",
            onConfirm = {
                launcher.launch(Manifest.permission.CALL_PHONE)
                showPhoneConfirm = false
            },
            onDismiss = { showPhoneConfirm = false }
        )
    }
}

@Composable
fun PermissionCard(
    permission: PermissionItem,
    onRequest: () -> Unit
) {
    val icon = when (permission.id) {
        "notifications" -> Icons.Default.Notifications
        "microphone" -> Icons.Default.Mic
        "phone" -> Icons.Default.Phone
        "storage" -> Icons.Default.Lock
        else -> Icons.Default.CheckCircle
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            PlaceholderSwitch(
                icon = icon,
                title = permission.name,
                subtitle = permission.description,
                isEnabled = permission.isGranted,
                comingSoon = false,
                onToggle = { if (!permission.isGranted) onRequest() }
            )
            if (permission.isDangerous && !permission.isGranted) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Requires explicit user consent",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(start = 48.dp)
                )
            }
        }
    }
}
