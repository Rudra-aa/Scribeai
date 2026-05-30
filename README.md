# ScribeAI

![ScribeAI](https://img.shields.io/badge/Status-Production%20Ready-success)
![Security](https://img.shields.io/badge/Security-Audited-blue)

ScribeAI is a modern, enterprise-grade AI transcription, translation, and summarization platform. It ingests video and audio files, generates high-accuracy transcripts via Whisper v3, provides real-time translation across 50+ languages, and leverages LLMs for intelligent meeting summaries.

## 🏗 Architecture

ScribeAI is built on a distributed 3-tier architecture:

### 1. Frontend (Client)
- **Framework:** React + Vite
- **Styling:** Tailwind CSS + Framer Motion
- **3D Graphics:** React Three Fiber + Three.js
- **State/Routing:** React Router v6

### 2. Backend (Gateway Node)
- **Framework:** Node.js + Express
- **Database:** MongoDB Atlas (Mongoose ORM)
- **Real-time Engine:** Socket.io
- **Security:** Helmet, Express Rate Limit, bcrypt, JWT, CORS

### 3. AI Engine (Microservice)
- **Framework:** FastAPI (Python)
- **Transcription:** `faster-whisper`
- **Translation / LLM:** Groq API
- **TTS:** `edge-tts`
- **Concurrency:** `asyncio` + WebSockets

---

## 🔒 Security Posture

ScribeAI enforces strict security controls:
- **Zero Exposed Secrets:** Credentials exist only in environment variables (see `.env.example`).
- **Brute Force Mitigation:** Authentication endpoints are protected by `express-rate-limit`.
- **HTTP Hardening:** `helmet` is deployed on the Node gateway to protect headers.
- **Payload Limits:** Strict 1MB JSON limits to prevent denial of service (DoS) attacks.
- **Masked Errors:** Stack traces and internal database errors are sanitized in production.

---

## 🚀 Environment Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/scribeai.git
   cd scribeai
   ```

2. **Environment Variables:**
   Copy the example environment file and fill in your secrets.
   ```bash
   cp .env.example .env
   ```
   *Note: Do not commit `.env`!*

---

## 🛠 Local Development Guide

To run the full stack locally, you need three terminal windows:

**1. Start the Node.js Backend**
```bash
cd server
npm install
npm run start
```
*(Runs on port 5001. Seeds a default admin account automatically.)*

**2. Start the AI Engine (FastAPI)**
```bash
cd ai-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*(Runs on port 8000. Ensure you have ffmpeg installed locally.)*

**3. Start the React Frontend**
```bash
cd client
npm install
npm run dev
```
*(Runs on port 5173. The UI will connect to the backend gateway.)*

---

## ☁️ Deployment Guide

### Deploying the Frontend (Vercel)
1. Import the repository into Vercel.
2. Set the Root Directory to `client`.
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Add Frontend environment variables in the Vercel dashboard.

### Deploying the Node Backend (Render / Railway)
1. Create a new Web Service.
2. Set Root Directory to `server`.
3. Build Command: `npm install`
4. Start Command: `npm run start`
5. Add `MONGO_URI`, `JWT_SECRET`, and `PORT` environment variables.

### Deploying the AI Engine (Render / Railway / GCP)
1. Create a new Web Service or Docker container.
2. Set Root Directory to `ai-engine`.
3. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Make sure to provision a service with adequate RAM (minimum 2GB for Whisper models).
5. Add `GROQ_API_KEY` and other Python environment variables.

---

## 🛟 Troubleshooting

- **MongoDB Timeout:** Ensure your local IP address is whitelisted in your MongoDB Atlas Network Access settings.
- **Missing PyMongo:** If your editor shows a `missing-import` for python dependencies, make sure your editor's Python interpreter is set to `./ai-engine/venv/bin/python`.
- **Websocket Disconnects:** If running behind an Nginx reverse proxy, ensure `Upgrade: websocket` headers are properly forwarded to the Node backend.
