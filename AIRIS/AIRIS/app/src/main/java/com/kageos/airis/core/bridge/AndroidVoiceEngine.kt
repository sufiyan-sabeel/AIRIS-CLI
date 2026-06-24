package com.kageos.airis.core.bridge

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

class AndroidVoiceEngine(context: Context) : VoiceEngine, TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = null
    private var isReady = false
    private var speechRate = 1.0f
    private var pitch = 1.0f

    init {
        tts = TextToSpeech(context, this)
    }

    override fun onInit(status: Int) {
        isReady = status == TextToSpeech.SUCCESS
        if (isReady) {
            tts?.language = Locale.US
            tts?.setSpeechRate(speechRate)
            tts?.setPitch(pitch)
        }
    }

    override fun speak(text: String) {
        if (isReady && text.isNotBlank()) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "airis_tts_${System.currentTimeMillis()}")
        }
    }

    override fun stopSpeaking() {
        tts?.stop()
    }

    override fun isSpeaking(): Boolean {
        return tts?.isSpeaking == true
    }

    override fun isAvailable(): Boolean = isReady

    override fun setSpeechRate(rate: Float) {
        speechRate = rate
        tts?.setSpeechRate(rate)
    }

    override fun setPitch(pitch: Float) {
        this.pitch = pitch
        tts?.setPitch(pitch)
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        isReady = false
    }
}
