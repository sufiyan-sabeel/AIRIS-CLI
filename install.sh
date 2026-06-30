#!/bin/bash
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  AIRIS CLI - Cross-Platform Installer v2.0                             ║
# ║  Autonomous Intelligence & Response Interface System                    ║
# ║  Supports: Linux, macOS, Termux, FreeBSD, Alpine, Windows (MSYS/Git)   ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
set -e

# ═══════════════════════════════════════════════════════════════════════════
#  ANSI COLOR PALETTE
# ═══════════════════════════════════════════════════════════════════════════
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
DARK='\033[2;37m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
BLINK='\033[5m'

# Neon Cyan Glow
NEON='\033[38;5;51m'
NEON_DIM='\033[38;5;87m'
NEON_BG='\033[48;5;236m'

# ═══════════════════════════════════════════════════════════════════════════
#  CLEAR & HIDE CURSOR
# ═══════════════════════════════════════════════════════════════════════════
clear
echo -ne "\033[?25l"  # Hide cursor

# Trap to restore cursor on exit
trap 'echo -ne "\033[?25h"' EXIT

# ═══════════════════════════════════════════════════════════════════════════
#  ANIMATION FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

# Spinning loader (POSIX-compatible)
spinner() {
    pid=$1
    delay=0.1
    spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while kill -0 "$pid" 2>/dev/null; do
        i=0
        while [ $i -lt ${#spin} ]; do
            i=$((i + 1))
            char=$(printf "$spin" | cut -c$i)
            printf "\r    %s" "$char"
            sleep $delay
        done
    done
    printf "\r    \033[38;5;51m✓\033[0m"
}

# Typing effect (POSIX-compatible)
typing() {
    text="$1"
    delay=${2:-0.03}
    i=0
    while [ $i -lt ${#text} ]; do
        i=$((i + 1))
        char=$(printf "$text" | cut -c$i)
        printf "%s" "$char"
        sleep $delay
    done
}

# Progress bar
progress() {
    local current=$1
    local total=$2
    local width=40
    local pct=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    printf "\r    ${NEON}["
    printf "%0.s━" $(seq 1 $filled 2>/dev/null) || true
    printf "${DARK}"
    printf "%0.s─" $(seq 1 $empty 2>/dev/null) || true
    printf "${NEON}] ${WHITE}%3d%%${NC}" $pct
}

# ═══════════════════════════════════════════════════════════════════════════
#  HUD FRAME
# ═══════════════════════════════════════════════════════════════════════════
print_hud_frame() {
    echo ""
    echo -e "${NEON}    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${NC}"
    echo -e "${NEON}    ┃${NC}                                                                       ${NEON}┃${NC}"
}

print_hud_frame_bottom() {
    echo -e "${NEON}    ┃${NC}                                                                       ${NEON}┃${NC}"
    echo -e "${NEON}    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════
#  PIXEL ART RENDERER
# ═══════════════════════════════════════════════════════════════════════════
render_pixel_logo() {
    # 5x7 pixel maps for A I R I S
    local -A A=(
        [0,1]=1 [0,2]=1 [0,3]=1
        [1,0]=1 [1,4]=1
        [2,0]=1 [2,4]=1
        [3,0]=1 [3,1]=1 [3,2]=1 [3,3]=1 [3,4]=1
        [4,0]=1 [4,4]=1
        [5,0]=1 [5,4]=1
        [6,0]=1 [6,4]=1
    )
    
    local -A I=(
        [0,0]=1 [0,1]=1 [0,2]=1 [0,3]=1 [0,4]=1
        [1,2]=1
        [2,2]=1
        [3,2]=1
        [4,2]=1
        [5,2]=1
        [6,0]=1 [6,1]=1 [6,2]=1 [6,3]=1 [6,4]=1
    )
    
    local -A R=(
        [0,0]=1 [0,1]=1 [0,2]=1 [0,3]=1
        [1,0]=1 [1,4]=1
        [2,0]=1 [2,4]=1
        [3,0]=1 [3,1]=1 [3,2]=1 [3,3]=1
        [4,0]=1 [4,2]=1
        [5,0]=1 [5,3]=1
        [6,0]=1 [6,4]=1
    )
    
    local -A S=(
        [0,1]=1 [0,2]=1 [0,3]=1 [0,4]=1
        [1,0]=1
        [2,0]=1
        [3,1]=1 [3,2]=1 [3,3]=1
        [4,4]=1
        [5,4]=1
        [6,0]=1 [6,1]=1 [6,2]=1 [6,3]=1
    )
    
    # Render each row
    for row in {0..6}; do
        echo -ne "    ${NEON}┃${NC}                          "
        for letter in A I R I S; do
            for col in {0..4}; do
                if [[ -n "${!letter[$row,$col]}" ]]; then
                    # Cyan accent on top/bottom rows
                    if [[ $row -eq 0 || $row -eq 3 || $row -eq 6 ]]; then
                        echo -ne "${NEON}██${NC}"
                    else
                        echo -ne "${WHITE}██${NC}"
                    fi
                else
                    echo -ne "  "
                fi
            done
            echo -ne "  "
        done
        echo -e "                         ${NEON}┃${NC}"
    done
}

# ═══════════════════════════════════════════════════════════════════════════
#  MAIN LOGO DISPLAY
# ═══════════════════════════════════════════════════════════════════════════
display_logo() {
    # Telemetry corners
    echo -e "${DARK}    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${NC}"
    echo -e "${DARK}    ┃ SYS:ONLINE  CPU:12%  MEM:847MB                                      ┃${NC}"
    echo -e "${DARK}    ┃ NET:SECURE  LAT:24ms              AIRIS OS v2.0.0 · JARVIS CORE    ┃${NC}"
    echo -e "${DARK}    ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${NC}"
    echo -e "${NEON}    ┃${NC}                                                                       ${NEON}┃${NC}"
    echo -e "${NEON}    ┃${NC}      ${DARK}┌─────────────────────────────────────────────────────┐${NC}          ${NEON}┃${NC}"
    echo -e "${NEON}    ┃${NC}      ${DARK}│${NC}                                                 ${DARK}│${NC}          ${NEON}┃${NC}"
    echo -e "${NEON}    ┃${NC}      ${DARK}│${NC}     ${NEON}╔═══════════════════════════════════════════╗${NC}     ${DARK}│${NC}          ${NEON}┃${NC}"
    echo -e "${NEON}    ┃${NC}      ${DARK}│${NC}     ${NEON}║${NC}                                           ${NEON}║${NC}     ${DARK}│${NC}          ${NEON}┃${NC}"
    
    # Render pixel art inside frame
    for row in {0..6}; do
        echo -ne "${NEON}    ┃${NC}      ${DARK}│${NC}     ${NEON}║${NC}   "
        for letter in A I R I S; do
            for col in {0..4}; do
                val=0
                case $letter in
                    A) case $row,$col in
                        0,1|0,2|0,3) val=1;; 1,0|1,4) val=1;; 2,0|2,4) val=1;;
                        3,0|3,1|3,2|3,3|3,4) val=1;; 4,0|4,4) val=1;;
                        5,0|5,4) val=1;; 6,0|6,4) val=1;;
                    esac;;
                    I) case $row,$col in
                        0,*|6,*) val=1;; *,2) val=1;;
                    esac;;
                    R) case $row,$col in
                        0,0|0,1|0,2|0,3) val=1;; 1,0|1,4) val=1;;
                        2,0|2,4) val=1;; 3,0|3,1|3,2|3,3) val=1;;
                        4,0|4,2) val=1;; 5,0|5,3) val=1;; 6,0|6,4) val=1;;
                    esac;;
                    S) case $row,$col in
                        0,1|0,2|0,3|0,4) val=1;; 1,0) val=1;; 2,0) val=1;;
                        3,1|3,2|3,3) val=1;; 4,4) val=1;; 5,4) val=1;;
                        6,0|6,1|6,2|6,3) val=1;;
                    esac;;
                esac
                
                if [[ $val -eq 1 ]]; then
                    if [[ $row -eq 0 || $row -eq 3 || $row -eq 6 ]]; then
                        echo -ne "${NEON}██${NC}"
                    else
                        echo -ne "${WHITE}██${NC}"
                    fi
                else
                    echo -ne "  "
                fi
            done
            echo -n "  "
        done
        echo -e "   ${NEON}║${NC}     ${DARK}│${NC}          ${NEON}┃${NC}"
    done
    
    echo -e "${NEON}    ┃${NC}      ${DARK}│${NC}     ${NEON}║${NC}                                           ${NEON}║${NC}     ${DARK}│${NC}          ${NEON}┃${NC}"
    echo -e "${NEON}    ┃${NC}      ${DARK}│${NC}     ${NEON}╚═══════════════════════════════════════════╝${NC}     ${DARK}│${NC}          ${NEON}┃${NC}"
    echo -e "${NEON}    ┃${NC}      ${DARK}│${NC}                                                 ${DARK}│${NC}          ${NEON}┃${NC}"
    echo -e "${NEON}    ┃${NC}      ${DARK}└─────────────────────────────────────────────────────┘${NC}          ${NEON}┃${NC}"
    echo -e "${NEON}    ┃${NC}                                                                       ${NEON}┃${NC}"
    
    # Divider with diamonds
    echo -e "${NEON}    ┃${NC}  ${NEON}◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈${NC}   ${NEON}┃${NC}"
    
    # Subtitle
    echo -e "${NEON}    ┃${NC}            ${NEON}AUTONOMOUS INTELLIGENCE & RESPONSE INTERFACE${NC}              ${NEON}┃${NC}"
    echo -e "${NEON}    ┃${NC}                   ${DARK}// next-gen agentic ai terminal //${NC}                  ${NEON}┃${NC}"
    echo -e "${NEON}    ┃${NC}                                                                       ${NEON}┃${NC}"
    
    # Status row
    echo -e "${NEON}    ┃${NC}     ${GREEN}${BLINK}●${NC} ${WHITE}SYSTEM ONLINE${NC}     ${NEON}◈${NC} ${WHITE}AGENT READY${NC}      ${MAGENTA}⬡${NC} ${WHITE}BUILD MODE${NC}          ${NEON}┃${NC}"
    echo -e "${NEON}    ┃${NC}                                                                       ${NEON}┃${NC}"
    echo -e "${DARK}    ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${NC}"
    echo -e "${DARK}    ┃ ENC:AES-256  AUTH:OK               MODE:AGENT CTX:128K TKN:0      ┃${NC}"
    echo -e "${DARK}    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════
#  SYSTEM INFO DISPLAY
# ═══════════════════════════════════════════════════════════════════════════
display_system_info() {
    echo -e "${NEON}    ┌─────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${NEON}    │${NC}  ${WHITE}${BOLD}⚡ SYSTEM DIAGNOSTICS${NC}                                            ${NEON}│${NC}"
    echo -e "${NEON}    ├─────────────────────────────────────────────────────────────────────┤${NC}"
    echo -e "${NEON}    │${NC}                                                                     ${NEON}│${NC}"
    echo -e "${NEON}    │${NC}    ${CYAN}▸${NC} OS:        ${WHITE}$(uname -s)${NC} $(uname -r)                             ${NEON}│${NC}"
    echo -e "${NEON}    │${NC}    ${CYAN}▸${NC} Arch:      ${WHITE}$(uname -m)${NC}                                         ${NEON}│${NC}"
    echo -e "${NEON}    │${NC}    ${CYAN}▸${NC} Node.js:   ${WHITE}$(node -v 2>/dev/null || echo 'Not installed')${NC}                          ${NEON}│${NC}"
    echo -e "${NEON}    │${NC}    ${CYAN}▸${NC} npm:       ${WHITE}$(npm -v 2>/dev/null || echo 'Not installed')${NC}                          ${NEON}│${NC}"
    echo -e "${NEON}    │${NC}    ${CYAN}▸${NC} Shell:     ${WHITE}${BASH_VERSION:-Unknown}${NC}                                  ${NEON}│${NC}"
    echo -e "${NEON}    │${NC}                                                                     ${NEON}│${NC}"
    echo -e "${NEON}    └─────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════
#  PLATFORM DETECTION
# ═══════════════════════════════════════════════════════════════════════════
detect_platform() {
    local os arch variant=""
    
    case "$(uname -s)" in
        Linux*)
            os="linux"
            # Detect Termux/Android
            if [[ -n "$ANDROID_ROOT" ]] || [[ -d "/data/data/com.termux" ]] || [[ "$(id -un 2>/dev/null)" == *"termux"* ]]; then
                variant="termux"
            fi
            ;;
        Darwin*)    os="darwin" ;;
        MINGW*|MSYS*|CYGWIN*)  os="windows" ;;
        FreeBSD*)   os="freebsd" ;;
        *)
            echo -e "${RED}    ✗ Unsupported OS: $(uname -s)${NC}"
            exit 1
            ;;
    esac
    
    case "$(uname -m)" in
        x86_64|amd64)           arch="x64" ;;
        arm64|aarch64)          arch="arm64" ;;
        armv7l|armhf|armv6l)    arch="arm64" ;;  # Termux/Android/RPi
        i*86)                   arch="x64" ;;     # 32-bit x86 (use x64 compat)
        *)
            echo -e "${RED}    ✗ Unsupported architecture: $(uname -m)${NC}"
            exit 1
            ;;
    esac
    
    local platform="${os}-${arch}"
    [[ -n "$variant" ]] && platform="${platform}-${variant}"
    
    echo "$platform"
}

# ═══════════════════════════════════════════════════════════════════════════
#  INSTALL METHOD DETECTION
# ═══════════════════════════════════════════════════════════════════════════
detect_install_method() {
    local platform os arch install_dir="/usr/local/bin"
    
    os=$(echo "$platform" | cut -d'-' -f1)
    arch=$(echo "$platform" | cut -d'-' -f2)
    
    # Determine best install directory
    case "$os" in
        linux)
            # Check if we can write to /usr/local/bin
            if [[ -w "/usr/local/bin" ]] 2>/dev/null || [[ "$EUID" -eq 0 ]]; then
                install_dir="/usr/local/bin"
            elif [[ -d "$HOME/.local/bin" ]] && [[ -w "$HOME/.local/bin" ]] 2>/dev/null; then
                install_dir="$HOME/.local/bin"
            elif command -v termux-setup-storage &>/dev/null; then
                # Termux
                install_dir="$PREFIX/bin"
            else
                mkdir -p "$HOME/.local/bin" 2>/dev/null || true
                install_dir="$HOME/.local/bin"
            fi
            ;;
        darwin)
            if [[ -w "/usr/local/bin" ]] 2>/dev/null; then
                install_dir="/usr/local/bin"
            else
                install_dir="$HOME/.local/bin"
            fi
            ;;
        freebsd)
            install_dir="/usr/local/bin"
            ;;
        windows)
            install_dir="$HOME/.local/bin"
            mkdir -p "$install_dir" 2>/dev/null || true
            ;;
    esac
    
    echo "$install_dir"
}

# ═══════════════════════════════════════════════════════════════════════════
#  DEPENDENCY CHECK
# ═══════════════════════════════════════════════════════════════════════════
check_dependencies() {
    local missing=()
    
    if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
        missing+=("curl or wget")
    fi
    
    if ! command -v tar &> /dev/null; then
        missing+=("tar")
    fi
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo -e "    ${RED}${BOLD}✗ Missing dependencies: ${missing[*]}${NC}"
        echo ""
        echo -e "    ${GRAY}Install them with:${NC}"
        echo -e "    ${GRAY}  • Termux:      pkg install ${missing[*]}${NC}"
        echo -e "    ${GRAY}  • macOS:       xcode-select --install${NC}"
        echo -e "    ${GRAY}  • Ubuntu/Debian: sudo apt install ${missing[*]}${NC}"
        echo -e "    ${GRAY}  • Alpine:      apk add ${missing[*]}${NC}"
        echo -e "    ${GRAY}  • FreeBSD:     pkg install ${missing[*]}${NC}"
        echo ""
        exit 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
#  DOWNLOAD WITH RETRY
# ═══════════════════════════════════════════════════════════════════════════
download_file() {
    local url="$1" output="$2" retries=3 attempt=0
    
    while [[ $attempt -lt $retries ]]; do
        attempt=$((attempt + 1))
        
        if command -v curl &> /dev/null; then
            if curl -fsSL --progress-bar --retry 2 --retry-delay 1 -o "$output" "$url" 2>/dev/null; then
                verify_download "$output" "$url"
                return $?
            fi
        elif command -v wget &> /dev/null; then
            if wget -q --tries=2 --timeout=10 -O "$output" "$url" 2>/dev/null; then
                verify_download "$output" "$url"
                return $?
            fi
        fi
        
        if [[ $attempt -lt $retries ]]; then
            echo -e "    ${YELLOW}⚠ Retry $attempt/$retries...${NC}"
            sleep 1
        fi
    done
    
    return 1
}

# Verify downloaded file is a valid archive (not an HTML error page)
verify_download() {
    local file="$1" url="$2"
    
    if [[ ! -s "$file" ]]; then
        echo -e "    ${RED}Downloaded file is empty${NC}"
        return 1
    fi
    
    # Check if file starts with gzip magic bytes (tar.gz) or PK (zip)
    local magic
    magic=$(head -c 4 "$file" | xxd -p 2>/dev/null || head -c 4 "$file" | od -An -tx1 | tr -d ' ')
    case "$magic" in
        1f8b*|504b*)
            # Valid gzip or zip
            return 0
            ;;
        *)
            # Might be an HTML error page from GitHub
            if head -c 100 "$file" | grep -qi '<html\|<!doctype\|404\|not found' 2>/dev/null; then
                echo -e "    ${RED}Downloaded file appears to be an HTML error page, not a binary${NC}"
                echo -e "    ${GRAY}  URL may be incorrect or release may not exist for this platform${NC}"
                return 1
            fi
            # Could be valid, allow extraction to try
            return 0
            ;;
    esac
}

# ═══════════════════════════════════════════════════════════════════════════
#  INSTALLATION STEPS
# ═══════════════════════════════════════════════════════════════════════════
install_airis() {
    echo -e "${NEON}    ┌─────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${NEON}    │${NC}  ${MAGENTA}${BOLD}🚀 INSTALLATION PROTOCOL${NC}                                        ${NEON}│${NC}"
    echo -e "${NEON}    └─────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    
    # Check dependencies
    check_dependencies
    
    # Detect platform
    local platform install_dir
    platform=$(detect_platform)
    install_dir=$(detect_install_method)
    
    echo -e "    ${NEON}[i]${NC} ${WHITE}Platform:${NC}   ${CYAN}$platform${NC}"
    echo -e "    ${NEON}[i]${NC} ${WHITE}Install to:${NC} ${CYAN}$install_dir${NC}"
    echo ""
    
    # Step 1: Create install directory
    echo -e "    ${NEON}[1/5]${NC} ${WHITE}Creating install directory...${NC}"
    echo -e "    ${DARK}─────────────────────────────────────────────────────────────────────${NC}"
    mkdir -p "$install_dir"
    echo -e " ${GREEN}${BOLD}✓ Directory created${NC}"
    echo ""
    sleep 0.3
    
    # Step 2: Download binary
    echo -e "    ${NEON}[2/5]${NC} ${WHITE}Downloading AIRIS binary...${NC}"
    echo -e "    ${DARK}─────────────────────────────────────────────────────────────────────${NC}"
    
    local version="${AIRIS_VERSION:-latest}"
    local repo="sufiyan-sabeel/AIRIS-CLI"
    local download_url="https://github.com/$repo/releases/download/$version/airis-$platform.tar.gz"
    local tmp_dir="/tmp/airis-install-$$"
    mkdir -p "$tmp_dir"
    
    if ! download_file "$download_url" "$tmp_dir/airis.tar.gz"; then
        echo -e "    ${RED}${BOLD}✗ Failed to download binary${NC}"
        echo -e "    ${GRAY}  URL: $download_url${NC}"
        echo -e "    ${GRAY}  Check: https://github.com/$repo/releases${NC}"
        rm -rf "$tmp_dir"
        exit 1
    fi
    echo -e " ${GREEN}${BOLD}✓ Downloaded${NC}"
    echo ""
    sleep 0.3
    
    # Step 3: Extract
    echo -e "    ${NEON}[3/5]${NC} ${WHITE}Extracting archive...${NC}"
    echo -e "    ${DARK}─────────────────────────────────────────────────────────────────────${NC}"
    tar -xzf "$tmp_dir/airis.tar.gz" -C "$tmp_dir" 2>/dev/null
    echo -e " ${GREEN}${BOLD}✓ Extracted${NC}"
    echo ""
    sleep 0.3
    
    # Step 4: Install binary
    echo -e "    ${NEON}[4/5]${NC} ${WHITE}Installing binary...${NC}"
    echo -e "    ${DARK}─────────────────────────────────────────────────────────────────────${NC}"
    
    # Move airis directory contents to target
    if [[ -d "$tmp_dir/airis" ]]; then
        mv "$tmp_dir/airis"/* "$install_dir/" 2>/dev/null
    else
        mv "$tmp_dir"/* "$install_dir/" 2>/dev/null
    fi
    chmod +x "$install_dir/airis"
    echo -e " ${GREEN}${BOLD}✓ Installed to $install_dir/airis${NC}"
    echo ""
    sleep 0.3
    
    # Step 5: Config
    echo -e "    ${NEON}[5/5]${NC} ${WHITE}Initializing config matrix...${NC}"
    echo -e "    ${DARK}─────────────────────────────────────────────────────────────────────${NC}"
    mkdir -p ~/.airis/agent/{extensions,skills,prompts,sessions}
    echo -e " ${GREEN}${BOLD}✓ Config directory created${NC}"
    echo ""
    
    # Step 6: Verify installation
    echo -e "    ${NEON}[✓]${NC} ${WHITE}Verifying installation...${NC}"
    echo -e "    ${DARK}─────────────────────────────────────────────────────────────────────${NC}"
    if command -v airis &>/dev/null || [[ -x "$install_dir/airis" ]]; then
        local airis_cmd="${install_dir}/airis"
        command -v airis &>/dev/null && airis_cmd="airis"
        if "$airis_cmd" --version &>/dev/null; then
            local installed_version
            installed_version=$("$airis_cmd" --version 2>/dev/null || echo "unknown")
            echo -e " ${GREEN}${BOLD}✓ airis $installed_version verified${NC}"
        else
            echo -e " ${YELLOW}⚠ airis installed but --version check failed (may still work)${NC}"
        fi
    else
        echo -e " ${YELLOW}⚠ airis binary not found in PATH; you may need to add $install_dir to PATH${NC}"
    fi
    echo ""
    
    # Cleanup
    rm -rf "$tmp_dir"
    
    # Check PATH and suggest adding if needed
    case ":$PATH:" in
        *":$install_dir:"*) ;;
        *)
            local shell_name
            shell_name=$(basename "${SHELL:-/bin/bash}" 2>/dev/null || echo "bash")
            
            echo -e "    ${YELLOW}⚠ Add $install_dir to your PATH:${NC}"
            case "$shell_name" in
                zsh)
                    echo -e "    ${GRAY}  echo 'export PATH=\"\$PATH:$install_dir\"' >> ~/.zshrc${NC}"
                    ;;
                fish)
                    echo -e "    ${GRAY}  fish_add_path $install_dir${NC}"
                    ;;
                *)
                    echo -e "    ${GRAY}  echo 'export PATH=\"\$PATH:$install_dir\"' >> ~/.bashrc${NC}"
                    ;;
            esac
            echo ""
            ;;
    esac
}

# ═══════════════════════════════════════════════════════════════════════════
#  SUCCESS SCREEN
# ═══════════════════════════════════════════════════════════════════════════
display_success() {
    echo ""
    echo -e "${NEON}    ╔═══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${NEON}    ║${NC}                                                                       ${NEON}║${NC}"
    echo -e "${NEON}    ║${NC}    ${GREEN}${BOLD}██████╗ ███████╗██████╗ ██╗███████╗███████╗${NC}                       ${NEON}║${NC}"
    echo -e "${NEON}    ║${NC}    ${GREEN}${BOLD}██╔══██╗██╔════╝██╔══██╗██║██╔════╝██╔════╝${NC}                       ${NEON}║${NC}"
    echo -e "${NEON}    ║${NC}    ${GREEN}${BOLD}██████╔╝█████╗  ██║  ██║██║█████╗  ███████╗${NC}                       ${NEON}║${NC}"
    echo -e "${NEON}    ║${NC}    ${GREEN}${BOLD}██╔══██╗██╔══╝  ██║  ██║██║██╔══╝  ╚════██║${NC}                       ${NEON}║${NC}"
    echo -e "${NEON}    ║${NC}    ${GREEN}${BOLD}██║  ██║███████╗██████╔╝██║███████╗███████║${NC}                       ${NEON}║${NC}"
    echo -e "${NEON}    ║${NC}    ${GREEN}${BOLD}╚═╝  ╚═╝╚══════╝╚═════╝ ╚═╝╚══════╝╚══════╝${NC}                       ${NEON}║${NC}"
    echo -e "${NEON}    ║${NC}                                                                       ${NEON}║${NC}"
    echo -e "${NEON}    ║${NC}              ${NEON}◈${NC} ${WHITE}INSTALLATION COMPLETE${NC} ${NEON}◈${NC}                                  ${NEON}║${NC}"
    echo -e "${NEON}    ║${NC}                                                                       ${NEON}║${NC}"
    echo -e "${NEON}    ╚═══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "    ${NEON}┌─────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "    ${NEON}│${NC}  ${WHITE}${BOLD}🚀 QUICK START COMMANDS${NC}                                          ${NEON}│${NC}"
    echo -e "    ${NEON}├─────────────────────────────────────────────────────────────────────┤${NC}"
    echo -e "    ${NEON}│${NC}                                                                     ${NEON}│${NC}"
    echo -e "    ${NEON}│${NC}    ${CYAN}▸${NC} ${WHITE}airis --help${NC}          ${DARK}# Show command reference${NC}              ${NEON}│${NC}"
    echo -e "    ${NEON}│${NC}    ${CYAN}▸${NC} ${WHITE}airis --version${NC}       ${DARK}# Display version${NC}                     ${NEON}│${NC}"
    echo -e "    ${NEON}│${NC}    ${CYAN}▸${NC} ${WHITE}airis${NC}                  ${DARK}# Launch interactive mode${NC}              ${NEON}│${NC}"
    echo -e "    ${NEON}│${NC}    ${CYAN}▸${NC} ${WHITE}airis -p \"prompt\"${NC}      ${DARK}# Quick prompt mode${NC}                   ${NEON}│${NC}"
    echo -e "    ${NEON}│${NC}                                                                     ${NEON}│${NC}"
    echo -e "    ${NEON}│${NC}    ${YELLOW}⚠${NC}  ${WHITE}Set your API key before running:${NC}                              ${NEON}│${NC}"
    echo -e "    ${NEON}│${NC}       ${GREEN}export GEMINI_AAIRIS_KEY=\"your-key-here\"${NC}                         ${NEON}│${NC}"
    echo -e "    ${NEON}│${NC}                                                                     ${NEON}│${NC}"
    echo -e "    ${NEON}│${NC}    ${MAGENTA}◆${NC}  ${WHITE}Supported Providers:${NC}                                          ${NEON}│${NC}"
    echo -e "    ${NEON}│${NC}       ${NEON}•${NC} Google Gemini    ${NEON}•${NC} Anthropic Claude   ${NEON}•${NC} OpenAI GPT         ${NEON}│${NC}"
    echo -e "    ${NEON}│${NC}       ${NEON}•${NC} OpenRouter       ${NEON}•${NC} Mistral           ${NEON}•${NC} Groq               ${NEON}│${NC}"
    echo -e "    ${NEON}│${NC}                                                                     ${NEON}│${NC}"
    echo -e "    ${NEON}└─────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    
    echo -e "    ${DARK}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "    ${DARK}║  \"The future of coding is AI-assisted.\"                          ║${NC}"
    echo -e "    ${DARK}║                                                                   ║${NC}"
    echo -e "    ${DARK}║  GitHub: https://github.com/sufiyan-sabeel/AIRIS-CLI              ║${NC}"
    echo -e "    ${DARK}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════
#  MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════
main() {
    # Display logo
    display_logo
    
    # System info
    display_system_info
    
    # Check Node.js
    NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
    if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 22 ]; then
        echo -e "    ${RED}${BOLD}✗ FATAL ERROR: Node.js 22+ required${NC}"
        echo -e "    ${GRAY}  Current: $(node -v 2>/dev/null || echo 'Not installed')${NC}"
        echo -e "    ${GRAY}  Install: https://nodejs.org/${NC}"
        echo ""
        echo -ne "\033[?25h"  # Show cursor
        exit 1
    fi
    
    echo -e "    ${GREEN}${BOLD}✓ Node.js version validated${NC}"
    echo ""
    
    # Run installation
    install_airis
    
    # Display success
    display_success
    
    # Show cursor
    echo -ne "\033[?25h"
}

# Run
main
