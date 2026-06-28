# Installation Guide

## Requirements

- **Node.js** >= 22.19.0
- **npm** (AIRIS uses npm workspaces and a root `package-lock.json`)
- **Git** (for building from source)

## Linux

### One-liner Install

```bash
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh
```

This downloads the latest prebuilt binary for your platform (x64 or arm64).

### From Source

```bash
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm link
```

Do not build from Android shared storage (`/storage/emulated/0`, `/sdcard`, or `/mnt/sdcard`). Those filesystems do not reliably support the symlinks and package extraction behavior npm workspaces need, which can leave dependencies such as `cross-spawn` or `@typescript/native-preview` missing.

Use a Linux filesystem checkout instead:

```bash
cd ~
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm link
```

### System Dependencies

AIRIS requires standard POSIX utilities. On minimal installations, you may need:

```bash
# Debian/Ubuntu
sudo apt install git build-essential

# Fedora/RHEL
sudo dnf install git gcc-c++ make

# Arch
sudo pacman -S git base-devel
```

## macOS

### Homebrew (Recommended)

```bash
# Install Node.js if not present
brew install node

# Clone and build
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm link
```

### Apple Silicon

AIRIS supports both Apple Silicon (arm64) and Intel (x64) Macs. The build system detects your architecture automatically.

## Android (Termux)

AIRIS runs natively on Android through Termux:

```bash
# Install Termux from F-Droid (not Play Store -- the Play Store version is outdated)

# Update packages
pkg update && pkg upgrade

# Install dependencies
pkg install nodejs git

# Install AIRIS
npm install -g @sufiyan-sabeel/airis-cli

# Verify installation
airis --version
```

### Termux Notes

- Use Termux from F-Droid, not the Google Play Store version
- Grant storage permissions if you want to access files outside Termux
- Keep source checkouts under `$HOME`, not under shared storage paths such as `/storage/emulated/0` or `/mnt/sdcard`
- Some AI providers may have connectivity issues on mobile networks
- Local models (Ollama) require significant RAM; works best on devices with 6GB+ RAM

## Windows

### Using WSL (Recommended)

```bash
# Inside WSL (Ubuntu)
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | sh
```

### Native Windows

```bash
# Install Node.js from https://nodejs.org
# Clone and build
git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git
cd AIRIS-CLI
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm link
```

## Verifying Installation

```bash
# Check version
airis --version

# Run health check
airis doctor

# Start interactive mode
airis
```

## Updating

```bash
# If installed from source
cd AIRIS-CLI
git pull
npm install --ignore-scripts --no-audit --no-fund
npm run build

# If installed globally via npm
npm update -g @sufiyan-sabeel/airis-cli
```

## Troubleshooting

### "Node.js version too old"

AIRIS requires Node.js >= 22.19.0. Upgrade with:

```bash
# Using nvm
nvm install 22
nvm use 22

# Using n
n 22
```

### "Permission denied" on npm link

```bash
# Fix npm global permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

### Build fails on arm64

Ensure you have the correct native dependencies:

```bash
# Debian/Ubuntu arm64
sudo apt install build-essential python3
```
