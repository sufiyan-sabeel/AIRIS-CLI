package com.kageos.airis.ui.screens.chat

import androidx.lifecycle.ViewModel
import com.kageos.airis.core.di.AppContainer
import com.kageos.airis.core.model.ChatMessage
import kotlinx.coroutines.delay

class ChatViewModel(private val container: AppContainer) : ViewModel() {
    val chatRepository = container.chatRepository

    suspend fun sendMessage(content: String) {
        chatRepository.addMessage(
            ChatMessage(content = content, isFromUser = true)
        )
        delay(800)
        chatRepository.addMessage(
            ChatMessage(
                content = "This is a demo response. Connect a provider in Settings to get real AI responses.",
                isFromUser = false
            )
        )
    }
}
