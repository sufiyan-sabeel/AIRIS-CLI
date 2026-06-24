# AIRIS - Android v1

Personal AI assistant and automation app built with Kotlin, Jetpack Compose, and Material 3.

## Features

- **AI Chat** - Local chat UI with provider configuration (OpenAI, Grok, OpenRouter, Custom)
- **Automation** - Task manager with history and execution simulation
- **IDE/Coding** - Project file browser, terminal, AI coding assistant (all placeholders)
- **Settings** - Theme selector, integration toggles, permission management
- **Permissions** - Safe permission request flow with user consent
- **Logs** - System and activity log viewer

## Design

- Graphite/slate/soft-blue color palette
- AMOLED dark mode with 4 theme options
- Material 3 with smooth animations
- Professional Gen-Z style UI
- Rounded cards, clean spacing

## Architecture

- MVVM with StateFlow
- Clean package structure (core/ui/domain pattern)
- Repository pattern with in-memory state
- Manual dependency injection via AppContainer
- Coroutines for async operations

## Package Structure

```
com.kageos.airis/
├── AirisApp.kt              (Application class)
├── MainActivity.kt          (Compose entry point)
├── core/
│   ├── bridge/              (Future module interfaces)
│   ├── data/                (DataStore preferences)
│   ├── di/                  (AppContainer DI)
│   ├── model/               (Data classes)
│   └── repository/          (Repository implementations)
└── ui/
    ├── theme/               (Color, Type, Theme)
    ├── navigation/          (Routes, NavGraph)
    ├── components/          (Shared UI components)
    └── screens/
        ├── splash/
        ├── welcome/
        ├── home/
        ├── chat/
        ├── automation/
        ├── tasks/
        ├── logs/
        ├── settings/
        ├── providers/
        ├── permissions/
        └── ide/
```

## Screens (11)

1. Splash Screen - Animated logo, auto-navigate
2. Welcome Screen - Onboarding pager with dots
3. Home Dashboard - Quick actions + feature cards
4. Chat Screen - Local AI chat with bubble UI
5. Automation Screen - Task list with add/run/delete
6. Task Queue Screen - History with status indicators
7. Logs Screen - Filterable log viewer
8. Settings Screen - Theme selector + integration toggles
9. Providers Screen - API key configuration UI
10. Permissions Screen - Permission status and requests
11. IDE Screen - Coding assistant placeholders

## Future Module Stubs (Interfaces)

- `AiProvider` - AI service abstraction
- `AutomationBridge` - Device automation
- `VoiceEngine` - TTS/STT (Vosk, Piper)
- `TelegramBridge` - Telegram bot control
- `FileAccessManager` - Local file operations
- `NotificationReader` - Notification access
- `ScreenCaptureManager` - Screen recording
- `CodingAgentBridge` - Code generation
- `TerminalBridge` - Shell command execution
- `ExtensionManager` - Plugin management

## Build

### AndroidIDE (on device)

1. Open the project in AndroidIDE
2. Wait for Gradle sync to complete
3. Tap Build > Build APK
4. APK output: `app/build/outputs/apk/debug/app-debug.apk`

### Command Line

```bash
cd /storage/emulated/0/Download/AIRIS-CLI/AIRIS/AIRIS
chmod +x gradlew
./gradlew assembleDebug
```

### Requirements

- Android SDK 34 (compile/target)
- Min SDK 26
- JDK 17
- Gradle 8.7
- AGP 8.5.2
- Kotlin 1.9.24

## Permissions (Safe v1)

- `INTERNET` - AI provider communication
- `POST_NOTIFICATIONS` - Task notifications
- `RECORD_AUDIO` - Voice input (future)

No dangerous permissions requested by default. All dangerous actions require explicit user consent.

## Safety Rules

- No real phone calls
- No SMS sending
- No payment/banking
- No hardcoded API keys
- No secrets in code
- User confirmation for all dangerous actions

## Roadmap

### v2

- Real AI provider integration
- Telegram bot bridge
- Voice assistant (TTS via Android TextToSpeech)
- File explorer with project management
- Terminal with real shell execution

### v3

- ADB bridge for device automation
- Accessibility service integration
- Screen recording/capture
- Extension marketplace
- AI coding assistant with file editing
- Build tools for projects

### v4

- Vosk STT integration
- Piper TTS integration
- Advanced automation workflows
- Multi-device sync
- Plugin system

## Tech Stack

- Kotlin 1.9.24
- Jetpack Compose (BOM 2024.06.00)
- Material 3
- Navigation Compose 2.7.7
- DataStore Preferences 1.1.1
- Lifecycle ViewModel Compose 2.8.4
- Coroutines
- StateFlow
