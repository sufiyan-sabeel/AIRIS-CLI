package com.kageos.airis.core.bridge

interface VoiceEngine {
    fun speak(text: String)
    fun stopSpeaking()
    fun isSpeaking(): Boolean
    fun isAvailable(): Boolean
    fun setSpeechRate(rate: Float)
    fun setPitch(pitch: Float)
}
