# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
python app.py  # Runs on http://localhost:5000
```

### Extension
```bash
cd extension
npm install
npm run build  # Creates dist/ folder
npm run dev    # Watch mode for development
```

### Load Extension in Chrome
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `extension/dist`

## Project Structure

```
quorum/
├── backend/
│   ├── app.py                    # Flask server entry point
│   ├── orchestration/
│   │   ├── orchestrator.py       # Main multi-agent flow
│   │   ├── agents.py             # AnswerAgent implementation
│   │   └── arbiter.py            # ArbiterAgent for consensus
│   ├── providers/
│   │   ├── base.py               # Provider interface
│   │   └── openai_provider.py    # OpenAI implementation
│   └── schemas/
│       └── models.py             # Pydantic request/response models
├── extension/
│   ├── src/
│   │   ├── App.jsx               # Main React component
│   │   ├── components/           # UI components
│   │   └── utils/
│   │       ├── storage.js        # Chrome storage helpers
│   │       └── api.js            # Backend API client
│   ├── manifest.json             # Chrome MV3 manifest
│   └── vite.config.js            # Build configuration
└── PRD.md
```

## Project Overview

Quorum is a Chrome extension that provides consensus-based answers from multiple AI agents. Users ask a question, N independent agents answer in parallel, and an arbiter agent determines agreement. If agreement ratio ≥ threshold, return consensus; otherwise, run reconciliation rounds.

## Architecture

**Frontend:** Chrome Extension (Manifest V3)
- Popup UI (React/Vite)
- Background service worker
- Chrome storage for settings (API keys, N, R, max_rounds)

**Backend:** Flask API
- Single endpoint: `POST /ask`
- Provider-agnostic orchestration layer (designed for future Microsoft Agent Framework integration)
- Provider adapter pattern for model abstraction (MVP: OpenAI)

## Key Components

**AnswerAgent (×N):** Independently answers user question. Returns structured JSON with `answer`, `confidence` (0-1), `assumptions`, `short_rationale`.

**ArbiterAgent:** Clusters answers semantically, computes agreement ratio (largest cluster / N), produces consensus answer. Returns `status`, `agreement_ratio`, `consensus_answer`, `disagreement_summary`, `reconcile_instructions`.

**Reconciliation Loop:** If ratio < threshold and rounds < max_rounds, agents receive arbiter feedback and resubmit. Loop until consensus or max rounds.

## API Contract

```
POST /ask
{
  "question": "string",
  "n_agents": 5,
  "agreement_ratio": 0.8,
  "max_rounds": 2,
  "model": "openai:<model-id>",
  "api_key": "user_key",
  "return_agent_outputs": true
}
```

## Defaults

- N (agents): 3
- R (agreement ratio): 0.67
- max_rounds: 2
- return_agent_outputs: false

## Validation Limits

- N: 1-10
- R: 0.0-1.0
- max_rounds: 0-5

## Security Requirements

- API keys stored locally in Chrome storage, sent only over HTTPS
- Backend must never persist or log API keys
- No server-side storage of prompts/answers by default
