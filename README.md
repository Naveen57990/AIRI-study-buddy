# AIRI — Interactive Study Companion

A desktop-style study companion with an AI companion character named **Airi** who watches over your study sessions, keeps you focused, and reacts to you in English or తెలుగు (Telugu).

Built with **Vite + React (TypeScript)** + **Express**, with AI powered by **Ollama (moondream / tinyllama)** or **Google Gemini**.

---

## ✨ Features

### 🧑‍🎓 Study Environment
- Calming "desktop" UI with a live clock header and a warm glassmorphism theme
- **Floating work panels**: Goals, Todos, Notes, Calendar + Mood Journal, Spotify Music
- Custom **wallpaper picker** (gradients + your own uploads)
- Draggable **study timer**: Pomodoro (25 min) / Stopwatch / Custom (up to 180 min)

### 😊 Airi — the AI Companion
- Procedurally animated anime character drawn live on `<canvas>` — blinking, swaying hair, emotion-reactive particles (💖 💤 💢 ❓ …)
- Lip-syncs when she talks (macOS `say` voice + Web Audio)
- Grows with you via a **gamified affection system**: level 1–50, XP, daily check-ins, streaks, unlockable outfits & voice lines

### 🚀 AIRI HUB
| Tab | What it does |
|---|---|
| **Chat** | Conversation with Airi (Gemini/Ollama), optional search-grounding, persisted history |
| **Affection** | Level/XP/streak gamification, petting & praise |
| **Dashboard** | Study stats, focus minutes, distraction log, pomodoro |
| **PDF Hub** | Paste study notes → AI generates summary, formulas & flip flashcards |
| **Vision** | Webcam focus/distraction surveillance (see below) |
| **Memory** | Persistent student profile (name, goals, weak subjects, facts) |
| **Schedule** | Exams/study/assignment scheduler + daily journal |

### 🎥 Vision System
Webcam-based focus surveillance using **Ollama + moondream** (or Gemini) every **15 seconds**:
- Detects: `focused`, `reading`, `writing`, `distracted_phone`, `distracted_away`, `sleepy`, `absent`, `visitors`, `unknown`
- Phone-in-hand vs phone-on-desk awareness, with a 2-frame lock to stop hallucination flicker
- Speaks Telugu reminders on an alternating scan pattern with escalating tones
- **Session history** — every observation persisted with timestamp, confidence & recorded speech
- **AI analysis** — summarizes your session (focus %, distraction %, event counts)

### 🌐 Bilingual
Full **English / తెలుగు** toggle — affects chat, vision feedback, and TTS voice.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+
- macOS (for TTS voice) — `say`/`afconvert` are used
- [Ollama](https://ollama.com) (recommended) **or** a `GEMINI_API_KEY`

### Install
```bash
npm install
cp .env.example .env
```

### Environment
Set your provider in `.env`:

```dotenv
AI_PROVIDER="ollama"
OLLAMA_URL="http://localhost:11434"
OLLAMA_MODEL="tinyllama"     # chat model
VISION_MODEL="moondream"     # vision model (camera analysis)
GEMINI_API_KEY=""            # alternative to Ollama
```

Pull Ollama models if you use them:
```bash
ollama pull moondream
ollama pull tinyllama
```

### Run
```bash
npm run dev:all
```
- Frontend: **http://localhost:5173**
- Backend API: **http://localhost:3000**

*(Alternatively run `npm run server` and `npm run dev` in two terminals.)*

To run the production build instead of the Vite dev server:
```bash
npm run build
NODE_ENV=production npm run server   # serves dist/ on :3000
```

---

## 🧠 How the AI pipeline works

1. Browser captures a 320×240 webcam frame every 15 s → sends to `/api/vision/analyze`
2. Server tries **Ollama + moondream** (keyword/heuristic classification) → then **Gemini** (structured JSON) → offline demo as last resort
3. Each observation is stored via `/api/vision/observations`
4. `/api/vision/analysis` aggregates observations into a focus/distraction session summary

---

## 🗂 Data

All data persists to a local `server-data.json` (auto-created, **not committed**):
- Chat history, memory profile, notes, todos, goals, journal, calendar
- Distraction logs, vision observation history
- Affection/XP/streak state

---

## 🔌 API Overview (port 3000)

| Endpoint | Purpose |
|---|---|
| `POST /api/chat` | Speak with Airi |
| `POST /api/pdf/analyze` | Extract summary/formulas/flashcards from notes |
| `POST /api/tts/generate` | macOS TTS → WAV |
| `POST /api/vision/analyze` | Analyze a camera frame |
| `GET/POST/DELETE /api/vision/observations` | Session observation history |
| `POST /api/vision/analysis` | AI session summary |
| `GET/POST /api/memory` | Student profile |
| `GET/POST/DELETE /api/calendar`, `/api/todos`, `/api/notes`, `/api/goals` | App data |
| `GET/POST /api/distractions`, `/api/study/stats` | Study tracking |
| `GET/POST /api/affection/*` | XP, levels, daily check-in |

---

## 🐍 Optional: Python Vision Service

A self-contained FastAPI fallback (port 3001) using YOLOv8 + MediaPipe for person/phone/sleepiness detection:

```bash
cd server/vision && bash run.sh
```

---

## 📄 Attributions

- [shadcn/ui](https://ui.shadcn.com) components (MIT)
- Web fonts: Caveat, M PLUS Rounded 1c, Work Sans, Quicksand