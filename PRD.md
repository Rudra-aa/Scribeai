# PRD — Product Requirements Document
## ScribeAI v1.0

**Author:** Engineering Team  
**Status:** Active Development  
**Last Updated:** 2026-05-30

---

## 1. Vision

ScribeAI exists to eliminate the language and transcription barrier for anyone who learns, researches, or creates with video. The product transforms raw audio into structured, exportable intelligence — automatically, in any language, in minutes.

> *"Stop writing. Start learning."*

---

## 2. Goals

| Goal | Metric |
|---|---|
| Reduce transcription time by 95% | <3 min per hour of audio |
| Support diverse language users | 50+ languages |
| Achieve professional accuracy | 98% WER (Word Error Rate accuracy) |
| Zero friction onboarding | No credit card required for free tier |
| Enable real-time collaboration | <200ms live translation latency |

---

## 3. User Personas

### Persona 1 — The Student
- **Name:** Aisha, 22, University student
- **Pain:** Misses key points during fast lectures in a non-native language
- **Goal:** Convert lecture recordings into structured notes she can review
- **Feature priority:** Upload → Notes, Multi-language, Fast processing

### Persona 2 — The Researcher
- **Name:** Dr. Marcus, 34, Academic researcher
- **Pain:** Spends hours manually transcribing interviews
- **Goal:** Accurate text output from field interviews in mixed languages
- **Feature priority:** Accuracy, Speaker diarisation, Export to Markdown

### Persona 3 — The Creator
- **Name:** Priya, 28, YouTube creator
- **Pain:** Subtitle generation is tedious and expensive
- **Goal:** Auto-generate accurate SRT/VTT captions for every upload
- **Feature priority:** SRT/VTT export, All formats, Batch processing

### Persona 4 — The Remote Team Lead
- **Name:** James, 39, Product Manager
- **Pain:** Meeting recordings go unwatched; action items get lost
- **Goal:** Searchable, speaker-labeled transcripts from every meeting
- **Feature priority:** Speaker diarisation, Real-time translation, Teams plan

---

## 4. Features

### Core (v1.0)
- [x] Video upload (MP4, MOV, AVI, MKV, WebM, up to 500 MB)
- [x] YouTube URL processing
- [x] AI transcription (Whisper, 50+ languages)
- [x] AI-generated structured notes (Markdown)
- [x] SRT subtitle generation
- [x] VTT subtitle generation
- [x] Subtitled video download
- [x] Translation to any target language
- [x] Real-time live translation (browser Speech API)
- [x] Auth (JWT, register/login/reset)
- [x] Job history and management
- [x] Delete transcript / file

### Planned (v1.1)
- [ ] Speaker diarisation (Pyannote)
- [ ] Batch upload (multiple files)
- [ ] Collaborative transcript editing
- [ ] Slack / Notion export integration
- [ ] API access (developer plan)
- [ ] Auto-chapter generation
- [ ] Podcast mode (RSS feed → auto-transcript)

---

## 5. Roadmap

### Q2 2026 — Foundation
- Full redesign to AI OS design language ✅
- Code splitting and performance optimization ✅
- Architecture cleanup ✅

### Q3 2026 — Growth
- Speaker diarisation (Pyannote integration)
- Team workspaces
- Batch processing
- Stripe billing integration

### Q4 2026 — Scale
- API access
- Notion/Slack integrations
- Auto-chapters
- White-label option

---

## 6. Out of Scope (v1.0)
- Mobile apps (iOS/Android)
- Real-time collaborative editing
- Video conferencing integration (Zoom/Meet API)
- Custom vocabulary training
