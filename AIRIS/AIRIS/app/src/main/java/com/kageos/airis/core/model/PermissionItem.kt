package com.kageos.airis.core.model

data class PermissionItem(
    val id: String,
    val name: String,
    val description: String,
    val isGranted: Boolean = false,
    val isRequired: Boolean = false,
    val isDangerous: Boolean = false
)
