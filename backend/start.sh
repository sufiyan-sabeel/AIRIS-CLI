#!/bin/bash
# AIRIS Backend Startup Script
# Usage: ./start.sh [--background]

cd "$(dirname "$0")"

echo "[AIRIS] Starting backend server..."

if [ "$1" = "--background" ] || [ "$1" = "-d" ]; then
    nohup node dist/index.js > logs/server.log 2>&1 &
    echo "[AIRIS] Server started in background (PID: $!)"
    echo "[AIRIS] Logs: tail -f logs/server.log"
    echo "[AIRIS] Health: node -e \"require('http').get('http://127.0.0.1:3000/health',r=>{r.on('data',c=>process.stdout.write(c));r.on('end',()=>process.exit())})\""
else
    node dist/index.js
fi
