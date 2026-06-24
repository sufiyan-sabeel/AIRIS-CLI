package com.kageos.airis.feature.dashboard.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kageos.airis.core.server.ServerState
import com.kageos.airis.feature.dashboard.viewmodel.DashboardViewModel

@Composable
fun ServerControlCard(
    serverState: ServerState,
    viewModel: DashboardViewModel,
    modifier: Modifier = Modifier
) {
    val cardColor by animateColorAsState(
        targetValue = when (serverState) {
            is ServerState.Online -> MaterialTheme.colorScheme.surfaceContainer
            is ServerState.Starting -> MaterialTheme.colorScheme.surfaceContainer
            is ServerState.Error -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
            is ServerState.Offline -> MaterialTheme.colorScheme.surfaceContainer
        },
        animationSpec = tween(400),
        label = "cardColor"
    )

    Card(
        modifier = modifier
            .fillMaxWidth()
            .shadow(
                elevation = when (serverState) {
                    is ServerState.Online -> 8.dp
                    is ServerState.Starting -> 4.dp
                    else -> 0.dp
                },
                shape = RoundedCornerShape(20.dp),
                ambientColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
            ),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = cardColor)
    ) {
        Column(
            modifier = Modifier.padding(24.dp)
        ) {
            HeaderSection(serverState, viewModel)

            Spacer(modifier = Modifier.height(20.dp))

            when (serverState) {
                is ServerState.Online -> MetricsSection(serverState)
                is ServerState.Starting -> StartingSection()
                is ServerState.Error -> ErrorSection(serverState.message)
                is ServerState.Offline -> OfflineSection()
            }

            Spacer(modifier = Modifier.height(20.dp))

            ActionSection(serverState, viewModel)
        }
    }
}

@Composable
private fun HeaderSection(
    serverState: ServerState,
    viewModel: DashboardViewModel
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.Dns,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(28.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "AIRIS Backend",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                StatusDot(serverState)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = when (serverState) {
                        is ServerState.Online -> "Online"
                        is ServerState.Starting -> "Starting..."
                        is ServerState.Error -> "Error"
                        is ServerState.Offline -> "Offline"
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        IconButton(onClick = { viewModel.refreshStatus() }) {
            Icon(
                imageVector = Icons.Default.Refresh,
                contentDescription = "Refresh status",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
private fun StatusDot(state: ServerState) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")

    val dotColor by animateColorAsState(
        targetValue = when (state) {
            is ServerState.Online -> Color(0xFF4CAF50)
            is ServerState.Starting -> Color(0xFFFFC107)
            is ServerState.Error -> MaterialTheme.colorScheme.error
            is ServerState.Offline -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
        },
        animationSpec = tween(400),
        label = "dotColor"
    )

    val pulseAlpha by if (state is ServerState.Starting) {
        infiniteTransition.animateFloat(
            initialValue = 0.4f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(800, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "pulseAlpha"
        )
    } else {
        animateFloatAsState(
            targetValue = 1f,
            animationSpec = tween(400),
            label = "staticAlpha"
        )
    }

    val glowRadius by if (state is ServerState.Online) {
        infiniteTransition.animateFloat(
            initialValue = 4.dp.value,
            targetValue = 8.dp.value,
            animationSpec = infiniteRepeatable(
                animation = tween(2000, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "glowRadius"
        )
    } else {
        animateFloatAsState(
            targetValue = 0f,
            animationSpec = tween(400),
            label = "noGlow"
        )
    }

    Box(
        modifier = Modifier
            .size((10 + glowRadius).dp)
            .clip(CircleShape)
            .background(dotColor.copy(alpha = 0.2f)),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(dotColor.copy(alpha = pulseAlpha))
        )
    }
}

@Composable
private fun MetricsSection(state: ServerState.Online) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        MetricCard(
            label = "Uptime",
            value = formatUptime(state.uptime),
            modifier = Modifier.weight(1f)
        )
        MetricCard(
            label = "Memory",
            value = "${state.memoryUsed} MB",
            modifier = Modifier.weight(1f)
        )
        MetricCard(
            label = "PID",
            value = "${state.pid}",
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun MetricCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun StartingSection() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(20.dp),
            strokeWidth = 2.dp,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = "Server is starting up...",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun ErrorSection(message: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f))
            .padding(16.dp)
    ) {
        Text(
            text = "Error",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onErrorContainer
        )
    }
}

@Composable
private fun OfflineSection() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Server is not running. Press Start to launch.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun ActionSection(
    serverState: ServerState,
    viewModel: DashboardViewModel
) {
    val buttonColor by animateColorAsState(
        targetValue = when (serverState) {
            is ServerState.Online -> MaterialTheme.colorScheme.error
            is ServerState.Starting -> MaterialTheme.colorScheme.onSurfaceVariant
            else -> MaterialTheme.colorScheme.primary
        },
        animationSpec = tween(400),
        label = "buttonColor"
    )

    val isEnabled = serverState !is ServerState.Starting

    Button(
        onClick = {
            when (serverState) {
                is ServerState.Online -> viewModel.stopServer()
                is ServerState.Offline -> viewModel.startServer()
                is ServerState.Error -> viewModel.startServer()
                is ServerState.Starting -> {}
            }
        },
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp),
        enabled = isEnabled,
        colors = ButtonDefaults.buttonColors(
            containerColor = buttonColor,
            disabledContainerColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
        ),
        shape = RoundedCornerShape(14.dp)
    ) {
        if (serverState is ServerState.Starting) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary
            )
            Spacer(modifier = Modifier.width(8.dp))
        }
        Icon(
            imageVector = when (serverState) {
                is ServerState.Online -> Icons.Default.Stop
                else -> Icons.Default.PlayArrow
            },
            contentDescription = null,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = when (serverState) {
                is ServerState.Online -> "Stop Server"
                is ServerState.Starting -> "Starting..."
                is ServerState.Error -> "Retry Start"
                is ServerState.Offline -> "Start Server"
            },
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
    }
}

private fun formatUptime(seconds: Long): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return String.format("%02d:%02d:%02d", h, m, s)
}
