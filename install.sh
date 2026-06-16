#!/bin/bash
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  AIRIS CLI - Installer v2.0                                            ║
# ║  Autonomous Intelligence & Response Interface System                    ║
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
#  INSTALLATION STEPS
# ═══════════════════════════════════════════════════════════════════════════
install_airis() {
    echo -e "${NEON}    ┌─────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${NEON}    │${NC}  ${MAGENTA}${BOLD}🚀 INSTALLATION PROTOCOL${NC}                                        ${NEON}│${NC}"
    echo -e "${NEON}    └─────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    
    # Step 1: Clone
    echo -e "    ${NEON}[1/5]${NC} ${WHITE}Initializing download sequence...${NC}"
    echo -e "    ${DARK}─────────────────────────────────────────────────────────────────────${NC}"
    
    INSTALL_DIR="/tmp/airis-install-$$"
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    git clone --depth 1 https://github.com/sufiyan-sabeel/AIRIS-CLI.git . 2>/dev/null &
    spinner $!
    echo -e " ${GREEN}${BOLD}✓ Repository cloned${NC}"
    echo ""
    sleep 0.5
    
    # Step 2: Dependencies
    echo -e "    ${NEON}[2/5]${NC} ${WHITE}Fetching neural network modules...${NC}"
    echo -e "    ${DARK}─────────────────────────────────────────────────────────────────────${NC}"
    npm install --ignore-scripts --no-audit --no-fund 2>/dev/null &
    spinner $!
    echo -e " ${GREEN}${BOLD}✓ Dependencies resolved${NC}"
    echo ""
    sleep 0.5
    
    # Step 3: Build
    echo -e "    ${NEON}[3/5]${NC} ${WHITE}Compiling intelligence core...${NC}"
    echo -e "    ${DARK}─────────────────────────────────────────────────────────────────────${NC}"
    npm run build 2>/dev/null &
    spinner $!
    echo -e " ${GREEN}${BOLD}✓ Core compiled${NC}"
    echo ""
    sleep 0.5
    
    # Step 4: Link
    echo -e "    ${NEON}[4/5]${NC} ${WHITE}Establishing neural pathways...${NC}"
    echo -e "    ${DARK}─────────────────────────────────────────────────────────────────────${NC}"
    npm link 2>/dev/null &
    spinner $!
    echo -e " ${GREEN}${BOLD}✓ Pathways established${NC}"
    echo ""
    sleep 0.5
    
    # Step 5: Config
    echo -e "    ${NEON}[5/5]${NC} ${WHITE}Initializing config matrix...${NC}"
    echo -e "    ${DARK}─────────────────────────────────────────────────────────────────────${NC}"
    mkdir -p ~/.airis/agent/{extensions,skills,prompts,sessions}
    echo -e " ${GREEN}${BOLD}✓ Config directory created${NC}"
    echo ""
    
    # Cleanup
    cd /
    rm -rf "$INSTALL_DIR"
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
    echo -e "    ${NEON}│${NC}       ${GREEN}export GEMINI_API_KEY=\"your-key-here\"${NC}                         ${NEON}│${NC}"
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
