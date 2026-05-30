#!/bin/sh

# Start the Python AI Engine in the background on port 8000
echo "Starting Python AI Engine on port 8000..."
cd /app/ai-engine
# Use 0.0.0.0 so it binds to IPv4 explicitly (safer inside Docker)
uvicorn main:app --host 0.0.0.0 --port 8000 &

# Navigate to Node server directory
cd /app/server

# Ensure Node connects to local Python backend
export AI_ENGINE_URL="http://localhost:8000"
export NODE_BACKEND_URL="http://localhost:${PORT:-5001}"

# Start the Node.js backend in the foreground on the Render PORT
echo "Starting Node.js Backend on port ${PORT:-5001}..."
node index.js
