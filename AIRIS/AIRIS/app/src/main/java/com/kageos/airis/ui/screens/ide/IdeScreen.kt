package com.kageos.airis.ui.screens.ide

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kageos.airis.core.di.AppContainer
import com.kageos.airis.ui.components.ComingSoonBadge

@Composable
fun IdeScreen(
    container: AppContainer,
    onNavigateBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        Spacer(modifier = Modifier.height(40.dp))

        Text(
            text = "IDE & Coding",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = "Code, build, and ship with AI",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Project section
        Text(
            text = "Project",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(8.dp))

        IdeFeatureCard(
            icon = Icons.Default.Folder,
            title = "Open Project Folder",
            subtitle = "Browse and open local projects",
            comingSoon = true
        )
        Spacer(modifier = Modifier.height(8.dp))
        IdeFeatureCard(
            icon = Icons.Default.Code,
            title = "File Explorer",
            subtitle = "Navigate project files and directories",
            comingSoon = true
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Tools section
        Text(
            text = "Tools",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(8.dp))

        IdeFeatureCard(
            icon = Icons.Default.Terminal,
            title = "Terminal",
            subtitle = "Run commands and scripts",
            comingSoon = true
        )
        Spacer(modifier = Modifier.height(8.dp))
        IdeFeatureCard(
            icon = Icons.Default.Build,
            title = "Build Tools",
            subtitle = "Compile and build your projects",
            comingSoon = true
        )

        Spacer(modifier = Modifier.height(20.dp))

        // AI section
        Text(
            text = "AI Assistant",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(8.dp))

        IdeFeatureCard(
            icon = Icons.Default.SmartToy,
            title = "AI Coding Assistant",
            subtitle = "Read files, propose changes, generate code",
            comingSoon = true
        )
        Spacer(modifier = Modifier.height(8.dp))
        IdeFeatureCard(
            icon = Icons.Default.History,
            title = "Task Manager",
            subtitle = "Track coding tasks: pending, in progress, done",
            comingSoon = true
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Extensions section
        Text(
            text = "Extensions",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(8.dp))

        IdeFeatureCard(
            icon = Icons.Default.Settings,
            title = "Extension Marketplace",
            subtitle = "Install plugins and extensions",
            comingSoon = true
        )

        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
fun IdeFeatureCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    comingSoon: Boolean = false
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    if (comingSoon) {
                        Spacer(modifier = Modifier.width(8.dp))
                        ComingSoonBadge()
                    }
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
