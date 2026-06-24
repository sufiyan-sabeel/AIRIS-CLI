package com.kageos.airis.core.bridge

interface ScreenCaptureManager {
    fun isCapturing(): Boolean
    fun startCapture(): Result<Unit>
    fun stopCapture(): Result<Unit>
    fun isAvailable(): Boolean
}
