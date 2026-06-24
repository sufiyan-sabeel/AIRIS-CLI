package com.kageos.airis.feature.coding.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader

class IdeRepository {

    // --- Real File System Operations ---
    suspend fun getDirectoryContents(directoryPath: String): List<FileNode> = withContext(Dispatchers.IO) {
        val dir = File(directoryPath)
        if (!dir.exists() || !dir.isDirectory) return@withContext emptyList()

        dir.listFiles()?.map { file ->
            FileNode(
                name = file.name,
                path = file.absolutePath,
                isDirectory = file.isDirectory,
                size = if (file.isFile) file.length() else 0L,
                lastModified = file.lastModified()
            )
        }?.sortedWith(compareByDescending<FileNode> { it.isDirectory }.thenBy { it.name }) ?: emptyList()
    }

    suspend fun readFileContent(filePath: String): String = withContext(Dispatchers.IO) {
        val file = File(filePath)
        if (file.exists() && file.isFile) {
            try {
                file.readText()
            } catch (e: Exception) {
                "Error reading file: ${e.message}"
            }
        } else ""
    }

    suspend fun writeFileContent(filePath: String, content: String): Boolean = withContext(Dispatchers.IO) {
        try {
            File(filePath).writeText(content)
            true
        } catch (e: Exception) {
            false
        }
    }

    suspend fun createFile(path: String, name: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val file = File(path, name)
            if (name.endsWith("/")) {
                file.mkdirs()
            } else {
                file.createNewFile()
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    suspend fun deleteFile(path: String): Boolean = withContext(Dispatchers.IO) {
        try {
            File(path).deleteRecursively()
            true
        } catch (e: Exception) {
            false
        }
    }

    // --- Real Terminal Execution ---
    suspend fun executeTerminalCommand(command: String, workDir: String = "/"): TerminalResult = withContext(Dispatchers.IO) {
        try {
            val process = ProcessBuilder("sh", "-c", command)
                .directory(File(workDir))
                .redirectErrorStream(true)
                .start()

            val output = StringBuilder()
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                output.appendLine(line)
            }

            val exitCode = process.waitFor()
            TerminalResult(
                output = output.toString().trim(),
                exitCode = exitCode,
                isError = exitCode != 0
            )
        } catch (e: Exception) {
            TerminalResult(
                output = "Error: ${e.message}",
                exitCode = -1,
                isError = true
            )
        }
    }

    suspend fun getAvailableStoragePaths(): List<String> = withContext(Dispatchers.IO) {
        val paths = mutableListOf<String>()
        paths.add("/storage/emulated/0")
        paths.add("/sdcard")
        paths.add("/data/data/com.kageos.airis")
        paths
    }
}

data class FileNode(
    val name: String,
    val path: String,
    val isDirectory: Boolean,
    val size: Long,
    val lastModified: Long
)

data class TerminalResult(
    val output: String,
    val exitCode: Int,
    val isError: Boolean
)
