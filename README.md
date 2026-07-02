# SignalCode — Adaptive Interview Coach

SignalCode is a privacy-aware coding interview simulator. It combines a browser
IDE, lightweight on-device attention signals, a real-time coaching pipeline, and
an optional local or cloud LLM.

## What is included

- React + TypeScript interview room with Monaco Editor
- Browser camera processing with MediaPipe Face Landmarker
- FastAPI WebSocket coaching pipeline
- Ollama, Gemini, and deterministic mock AI providers
- SQLite session, event, and report persistence
- Adaptive difficulty and structured post-session reports
- Python and JavaScript execution in a sandboxed browser worker

Camera signals are deliberately labeled as *attention signals*, not emotions or
mental-health measurements. Video never leaves the browser.

## Quick start

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

The default provider is `mock`, so the app works without an API key.

For local Ollama:

```powershell
ollama pull llama3.2:3b
# Set AI_PROVIDER=ollama in backend/.env
```

For Gemini, set `AI_PROVIDER=gemini` and `GEMINI_API_KEY` in `backend/.env`.

### 2. Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Architecture

```text
Monaco code ─┐
Run results ─┼─ WebSocket ─ FastAPI ─ coach engine ─ Ollama / Gemini / mock
Face signals ┘                 │
                              SQLite
```

Code and attention updates are debounced. Routine feedback uses local
heuristics; the LLM is called only on explicit hint requests, failed runs, or
meaningful checkpoints. This keeps latency and API usage sane.

## Configuration

Backend variables are documented in `backend/.env.example`. Frontend variables
are documented in `frontend/.env.example`.

## Safety and privacy

- Raw camera frames stay in the browser.
- The backend receives only coarse numeric signals such as face presence and
  looking-away duration.
- The “focus score” is a UX indicator, not a medical or psychological score.
- Never expose a Gemini key in the frontend.

