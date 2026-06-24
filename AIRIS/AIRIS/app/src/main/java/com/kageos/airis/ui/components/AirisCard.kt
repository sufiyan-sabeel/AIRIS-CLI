package com.kageos.airis.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun AirisCard(
    modifier: Modifier = Modifier,
    elevation: Float = 0f,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = elevation.dp
        ),
        content = content
    )
}

@Composable
fun AirisCardPadded(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    AirisCard(modifier = modifier) {
        Column(
            modifier = Modifier.padding(16.dp),
            content = content
        )
    }
}
