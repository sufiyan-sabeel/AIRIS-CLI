package com.kageos.airis.core.bridge

interface NotificationReader {
    fun getRecentNotifications(count: Int = 10): List<String>
    fun isAvailable(): Boolean
    fun requestPermission()
}
