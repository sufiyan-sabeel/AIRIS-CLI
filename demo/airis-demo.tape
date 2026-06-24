# AIRIS Demo Recording - VHS Tape File
# Install VHS: go install github.com/charmbracelet/vhs@latest
# Run: vhs demo/airis-demo.tape

output demo/screenshots/airis-demo.gif

set font-size 16
set theme Dracula
set width 100
set height 30
set margin 20
set render-speed 1
set fps 30

type "airis --help"
enter
sleep 3s

type "airis ship --help"
enter
sleep 2s

type "airis ship start \"Add a greeting function\""
enter
sleep 5s

type "airis ship status"
enter
sleep 2s

type "airis ship resume"
enter
sleep 8s

type "airis ship status"
enter
sleep 2s
