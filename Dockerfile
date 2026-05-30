FROM nikolaik/python-nodejs:python3.11-nodejs20-slim

# 1. Install system dependencies (ffmpeg for audio/video extraction)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Install Python dependencies for AI Engine
COPY ai-engine/requirements.txt ./ai-engine/
RUN pip install --no-cache-dir -r ai-engine/requirements.txt

# 3. Install Node.js dependencies for Backend
COPY server/package*.json ./server/
RUN cd server && npm install

# 4. Copy all application code
COPY . .

# 5. Make start script executable
RUN chmod +x start.sh

# Render uses the PORT env var for the public facing port.
# Node.js backend will use PORT (e.g., 10000)
# Python AI Engine will use 8000 internally.
EXPOSE $PORT
EXPOSE 8000

# 6. Start both services concurrently
CMD ["./start.sh"]
