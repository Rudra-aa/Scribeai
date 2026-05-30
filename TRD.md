# TRD — Technical Requirements Document
## ScribeAI v1.0

**Author:** Engineering Team  
**Status:** Active Development  
**Last Updated:** 2026-05-30

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                    │
│  React 19 + Vite 8 + Tailwind CSS + Framer Motion      │
│  Three.js / React Three Fiber (landing 3D only)        │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / WebSocket
                         ▼
┌─────────────────────────────────────────────────────────┐
│                Node.js Backend (Express)                │
│  Port 5001 · REST API + Socket.io                      │
│  JWT Auth · Firebase Admin SDK · Job Queue             │
└───────────────┬────────────────────────┬────────────────┘
                │ Firebase SDK           │ HTTP
                ▼                        ▼
┌───────────────────────┐  ┌─────────────────────────────┐
│  Firebase (Google)    │  │   Python AI Engine          │
│  Firestore (DB)       │  │   FastAPI · Uvicorn         │
│  Storage (files)      │  │   Whisper AI · FFmpeg       │
│  Auth (users)         │  │   Port 8000                 │
└───────────────────────┘  └─────────────────────────────┘
```

---

## 2. Frontend Stack

| Package | Version | Purpose |
|---|---|---|
| react | 19.2.6 | UI framework |
| react-dom | 19.2.6 | DOM rendering |
| react-router-dom | 6.22 | Client routing |
| framer-motion | 12.40 | Animations |
| three | 0.184 | 3D WebGL |
| @react-three/fiber | 9.6 | React bindings for Three.js |
| @react-three/drei | 10.7 | Three.js helpers (Points, etc.) |
| maath | — | Math utilities for 3D (particle sphere) |
| lucide-react | 0.344 | Icon system |
| socket.io-client | 4.7 | Real-time job progress |
| clsx | 2.1 | Conditional classnames |
| tailwind-merge | 3.6 | Tailwind class conflict resolution |
| tailwindcss | 3.4 | Utility CSS |
| vite | 8.0 | Build tool |

---

## 3. Frontend Architecture

### Route Structure
```
/ (Landing)         — Public, eager loaded
/auth               — Public, lazy loaded
/dashboard          — Private*, lazy loaded
/live               — Private*, lazy loaded

* Route-level auth guard pending implementation
```

### Code Splitting Strategy
```js
// vite.config.js — manualChunks
'three-vendor'   → three, @react-three/fiber, @react-three/drei, maath (~600KB)
'motion-vendor'  → framer-motion (~100KB)
'react-vendor'   → react, react-dom, react-router-dom (~130KB)
```

### Component Architecture
```
src/
├── components/
│   ├── layout/
│   │   ├── Navbar.jsx       # Fixed glass navbar, mobile drawer
│   │   └── Footer.jsx       # 4-column footer grid
│   ├── landing/
│   │   ├── HeroScene.jsx    # Hero section with parallax + mockup
│   │   ├── LandingSections.jsx # All below-fold sections
│   │   └── SpatialCanvas.jsx   # WebGL particle background
│   └── shared/              # (future: Button, Badge, Modal)
├── pages/
│   ├── Landing.jsx          # Orchestrates landing components
│   ├── Auth.jsx             # Two-column auth UI
│   ├── Dashboard.jsx        # Full app workspace (1448 lines)
│   └── LiveMeeting.jsx      # Live speech transcription
├── utils/
│   └── cn.js                # clsx + tailwind-merge helper
└── styles/
    └── app.css              # Dashboard CSS (legacy classes)
```

### State Management
- **Local state only**: `useState`, `useEffect`, `useRef` in each page
- **No global store**: By design for current scale
- **Authentication**: JWT stored in `localStorage`, read by all pages
- **Real-time**: Socket.io events update local React state in Dashboard

---

## 4. Backend Stack (Node.js)

| Technology | Purpose |
|---|---|
| Express.js | REST API framework |
| Socket.io | Bi-directional job progress events |
| Firebase Admin SDK | Auth verification, Firestore writes |
| Multer | File upload middleware |
| Axios | HTTP calls to Python AI engine |
| JWT (jsonwebtoken) | Token generation / verification |

### Key API Endpoints
```
POST   /api/auth/register    — Create account
POST   /api/auth/login       — Login → JWT
POST   /api/jobs             — Submit new transcription job
GET    /api/jobs             — List user's jobs
GET    /api/jobs/:id         — Single job details (notes, status)
DELETE /api/jobs/:id         — Delete job + file
GET    /api/download/:id/md  — Download Markdown notes
GET    /api/download/:id/srt — Download SRT subtitles
GET    /api/download/:id/vtt — Download VTT subtitles
GET    /api/download/:id/video — Download original/subtitled video
GET    /api/download/:id/audio — Download audio summary
GET    /api/health           — Backend health check
```

### Socket.io Events
```
job:progress  { jobId, percent, label, status }
job:done      { jobId, notes }
job:error     { jobId, error }
```

---

## 5. AI Engine (Python)

| Technology | Purpose |
|---|---|
| FastAPI | API framework |
| Uvicorn | ASGI server |
| OpenAI Whisper | Audio transcription (medium model) |
| FFmpeg | Audio extraction from video, subtitle burn-in |
| Pyannote (planned) | Speaker diarisation |

### Processing Pipeline
```
1. Receive video/audio file path from Node.js
2. FFmpeg: extract audio track → WAV 16kHz mono
3. Whisper: transcribe WAV → text segments with timestamps
4. Format: generate SRT, VTT, Markdown
5. Optionally: translate segments via Whisper translate mode
6. Burn subtitles into video with FFmpeg
7. Return file paths + text to Node.js via HTTP
8. Node.js emits socket events to browser
```

---

## 6. Database Schema (Firestore)

### Collection: `users`
```js
{
  uid: string,         // Firebase Auth UID
  name: string,
  email: string,
  plan: 'free' | 'pro',
  createdAt: timestamp
}
```

### Collection: `jobs`
```js
{
  id: string,          // UUID
  userId: string,      // Firebase UID
  fileName: string,
  language: string,    // Source language code
  targetLanguage: string | null,
  status: 'pending' | 'processing' | 'done' | 'error',
  notes: string | null,
  srtText: string | null,
  vttText: string | null,
  audioSummaryPath: string | null,
  subtitledVideoPath: string | null,
  error: string | null,
  createdAt: timestamp
}
```

---

## 7. Deployment Architecture

```
User Browser
     │
     │ HTTPS
     ▼
  Vercel (CDN)
  /client/dist (static)
     │
     │ API calls (:5001)
     ▼
  Railway / Render
  Node.js Backend
     │              │
     │ Firebase      │ HTTP (:8000)
     ▼              ▼
  Firebase       Modal / Cloud Run
  (Firestore)    Python AI Engine
  (Storage)      (GPU required for Whisper medium+)
```

---

## 8. Security Considerations

- JWT stored in `localStorage` (acceptable for current threat model; consider httpOnly cookie migration for v2)
- All file downloads require valid JWT token as query param
- Files stored in Firebase Storage with user-scoped rules
- Python engine is internal-only (not public-facing)
- CORS restricted to frontend origin in Node.js
- Whisper processes locally — audio never sent to OpenAI
