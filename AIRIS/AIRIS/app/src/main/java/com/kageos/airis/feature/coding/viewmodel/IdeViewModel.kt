package com.kageos.airis.feature.coding.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kageos.airis.feature.coding.data.FileNode
import com.kageos.airis.feature.coding.data.IdeRepository
import com.kageos.airis.feature.coding.data.TerminalResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

// Task for AI coding workflow
data class CodingTask(
    val id: String = System.currentTimeMillis().toString(),
    val title: String,
    val description: String = "",
    val status: TaskStatus = TaskStatus.PENDING
)

enum class TaskStatus { PENDING, IN_PROGRESS, COMPLETED }

// Chat message for AI conversation
data class AiChatMessage(
    val id: String = System.currentTimeMillis().toString(),
    val content: String,
    val isFromUser: Boolean,
    val timestamp: Long = System.currentTimeMillis(),
    val context: String? = null // File path or code context
)

class IdeViewModel(private val repository: IdeRepository = IdeRepository()) : ViewModel() {

    // File Browser State
    private val _currentPath = MutableStateFlow("/storage/emulated/0/Download")
    val currentPath: StateFlow<String> = _currentPath.asStateFlow()

    private val _files = MutableStateFlow<List<FileNode>>(emptyList())
    val files: StateFlow<List<FileNode>> = _files.asStateFlow()

    private val _isLoadingFiles = MutableStateFlow(false)
    val isLoadingFiles: StateFlow<Boolean> = _isLoadingFiles.asStateFlow()

    private val _pathHistory = MutableStateFlow<List<String>>(emptyList())
    val pathHistory: StateFlow<List<String>> = _pathHistory.asStateFlow()

    // Editor State
    private val _editorContent = MutableStateFlow("")
    val editorContent: StateFlow<String> = _editorContent.asStateFlow()

    private val _activeFilePath = MutableStateFlow<String?>(null)
    val activeFilePath: StateFlow<String?> = _activeFilePath.asStateFlow()

    private val _isFileModified = MutableStateFlow(false)
    val isFileModified: StateFlow<Boolean> = _isFileModified.asStateFlow()

    // Terminal State
    private val _terminalHistory = MutableStateFlow<List<TerminalResult>>(emptyList())
    val terminalHistory: StateFlow<List<TerminalResult>> = _terminalHistory.asStateFlow()

    // AI Chat State
    private val _chatMessages = MutableStateFlow<List<AiChatMessage>>(emptyList())
    val chatMessages: StateFlow<List<AiChatMessage>> = _chatMessages.asStateFlow()

    private val _isAiTyping = MutableStateFlow(false)
    val isAiTyping: StateFlow<Boolean> = _isAiTyping.asStateFlow()

    // Task State
    private val _tasks = MutableStateFlow<List<CodingTask>>(emptyList())
    val tasks: StateFlow<List<CodingTask>> = _tasks.asStateFlow()

    // Current tab (0=Files, 1=Editor, 2=AI, 3=Terminal, 4=Tasks)
    private val _selectedTab = MutableStateFlow(0)
    val selectedTab: StateFlow<Int> = _selectedTab.asStateFlow()

    // Message for snackbar
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    init {
        loadDirectory(_currentPath.value)
    }

    fun selectTab(tab: Int) {
        _selectedTab.value = tab
    }

    fun loadDirectory(path: String) {
        viewModelScope.launch {
            _isLoadingFiles.value = true
            _pathHistory.value = _pathHistory.value + _currentPath.value
            _currentPath.value = path
            _files.value = repository.getDirectoryContents(path)
            _isLoadingFiles.value = false
        }
    }

    fun navigateBack() {
        val history = _pathHistory.value
        if (history.isNotEmpty()) {
            val previousPath = history.last()
            _pathHistory.value = history.dropLast(1)
            viewModelScope.launch {
                _isLoadingFiles.value = true
                _currentPath.value = previousPath
                _files.value = repository.getDirectoryContents(previousPath)
                _isLoadingFiles.value = false
            }
        }
    }

    fun openFile(file: FileNode) {
        if (file.isDirectory) {
            loadDirectory(file.path)
        } else {
            viewModelScope.launch {
                _activeFilePath.value = file.path
                _editorContent.value = repository.readFileContent(file.path)
                _isFileModified.value = false
                _selectedTab.value = 1 // Switch to editor
            }
        }
    }

    fun updateEditorContent(content: String) {
        _editorContent.value = content
        _isFileModified.value = true
    }

    fun saveFile() {
        val path = _activeFilePath.value ?: return
        viewModelScope.launch {
            val success = repository.writeFileContent(path, _editorContent.value)
            if (success) {
                _isFileModified.value = false
                _message.value = "File saved"
            } else {
                _message.value = "Failed to save"
            }
        }
    }

    fun createNewFile(name: String) {
        viewModelScope.launch {
            val success = repository.createFile(_currentPath.value, name)
            if (success) {
                _message.value = "Created: $name"
                loadDirectory(_currentPath.value)
            } else {
                _message.value = "Failed to create"
            }
        }
    }

    fun deleteFile(path: String) {
        viewModelScope.launch {
            val success = repository.deleteFile(path)
            if (success) {
                _message.value = "Deleted"
                loadDirectory(_currentPath.value)
            } else {
                _message.value = "Failed to delete"
            }
        }
    }

    fun executeCommand(command: String) {
        if (command.isBlank()) return
        viewModelScope.launch {
            val result = repository.executeTerminalCommand(command, _currentPath.value)
            _terminalHistory.value = _terminalHistory.value + result
        }
    }

    // --- AI Features ---

    fun sendAiMessage(message: String) {
        if (message.isBlank()) return

        // Add user message
        val userMsg = AiChatMessage(
            content = message,
            isFromUser = true,
            context = _activeFilePath.value
        )
        _chatMessages.value = _chatMessages.value + userMsg

        // Simulate AI typing
        _isAiTyping.value = true
        viewModelScope.launch {
            kotlinx.coroutines.delay(1500)
            val response = generateAiResponse(message)
            val aiMsg = AiChatMessage(
                content = response,
                isFromUser = false
            )
            _chatMessages.value = _chatMessages.value + aiMsg
            _isAiTyping.value = false
        }
    }

    private fun generateAiResponse(userMessage: String): String {
        val currentCode = _editorContent.value
        val fileName = _activeFilePath.value?.substringAfterLast("/") ?: "No file"

        return when {
            userMessage.contains("explain", ignoreCase = true) -> {
                if (currentCode.isNotBlank()) {
                    "## Code Explanation\n\nThis is the file `$fileName`.\n\nThe code contains ${currentCode.lines().size} lines.\n\nKey observations:\n- The code appears to be ${detectLanguage(fileName)}\n- Main functionality involves processing data\n\nWould you like me to explain a specific part?"
                } else {
                    "Please open a file first, then ask me to explain it."
                }
            }
            userMessage.contains("fix", ignoreCase = true) -> {
                "## Code Review\n\nI've analyzed `$fileName`.\n\nPotential improvements:\n1. Consider adding error handling\n2. Add input validation\n3. Consider using more descriptive variable names\n\nWould you like me to apply these fixes?"
            }
            userMessage.contains("refactor", ignoreCase = true) -> {
                "## Refactoring Suggestions\n\nFor `$fileName`:\n\n1. **Extract Method** - Break long functions into smaller ones\n2. **Rename** - Use clearer variable/function names\n3. **Simplify** - Remove redundant code\n\nShall I proceed with any of these?"
            }
            userMessage.contains("generate", ignoreCase = true) -> {
                "## Code Generation\n\nWhat would you like me to generate?\n\nExamples:\n- Function to parse JSON\n- API endpoint handler\n- Database query\n- Unit test\n\nPlease describe what you need."
            }
            userMessage.contains("task", ignoreCase = true) -> {
                "## Task Created\n\nAdded to your task list:\n\"${userMessage.removePrefix("task").trim()}\"\n\nCheck the Tasks tab to track progress."
            }
            else -> {
                "I understand you're asking about: \"$userMessage\"\n\nI'm currently in demo mode. Configure an AI provider in Settings to get real responses.\n\nAvailable commands:\n- \"explain\" - Explain current code\n- \"fix\" - Suggest fixes\n- \"refactor\" - Refactoring ideas\n- \"generate\" - Generate code\n- \"task [description]\" - Add coding task"
            }
        }
    }

    private fun detectLanguage(fileName: String): String {
        return when {
            fileName.endsWith(".kt") -> "Kotlin"
            fileName.endsWith(".java") -> "Java"
            fileName.endsWith(".py") -> "Python"
            fileName.endsWith(".js") -> "JavaScript"
            fileName.endsWith(".ts") -> "TypeScript"
            fileName.endsWith(".xml") -> "XML"
            fileName.endsWith(".json") -> "JSON"
            fileName.endsWith(".html") -> "HTML"
            fileName.endsWith(".css") -> "CSS"
            else -> "Unknown"
        }
    }

    fun addTask(title: String) {
        _tasks.value = _tasks.value + CodingTask(title = title)
    }

    fun updateTaskStatus(taskId: String, status: TaskStatus) {
        _tasks.value = _tasks.value.map {
            if (it.id == taskId) it.copy(status = status) else it
        }
    }

    fun deleteTask(taskId: String) {
        _tasks.value = _tasks.value.filter { it.id != taskId }
    }

    fun clearChat() {
        _chatMessages.value = emptyList()
    }

    fun clearTerminal() {
        _terminalHistory.value = emptyList()
    }

    fun clearMessage() {
        _message.value = null
    }
}
