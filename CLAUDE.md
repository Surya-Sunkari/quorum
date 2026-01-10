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
│   ├── requirements.txt          # Python dependencies
│   ├── orchestration/
│   │   ├── orchestrator.py       # Main multi-agent flow
│   │   ├── agents.py             # AnswerAgent implementation
│   │   └── arbiter.py            # ArbiterAgent for consensus
│   ├── providers/
│   │   ├── base.py               # Provider interface
│   │   └── openai_provider.py    # OpenAI implementation (supports vision)
│   └── schemas/
│       └── models.py             # Pydantic request/response models
├── extension/
│   ├── src/
│   │   ├── App.jsx               # Main React component
│   │   ├── main.jsx              # Entry point (imports KaTeX CSS)
│   │   ├── index.css             # Tailwind + KaTeX styles
│   │   ├── components/
│   │   │   ├── Header.jsx        # Header with settings & sidebar buttons
│   │   │   ├── QuestionInput.jsx # Text input + image paste/upload
│   │   │   ├── AnswerCard.jsx    # Result display with LaTeX rendering
│   │   │   ├── MathText.jsx      # LaTeX rendering component (KaTeX)
│   │   │   ├── SettingsPanel.jsx # Settings UI
│   │   │   ├── StatusBadge.jsx   # Consensus status indicator
│   │   │   ├── LoadingState.jsx  # Loading animation
│   │   │   └── ErrorMessage.jsx  # Error display
│   │   └── utils/
│   │       ├── storage.js        # Chrome storage + session state helpers
│   │       └── api.js            # Backend API client
│   ├── public/
│   │   └── background.js         # Service worker for side panel
│   ├── manifest.json             # Chrome MV3 manifest (with sidePanel)
│   ├── vite.config.js            # Build configuration
│   └── package.json              # Node dependencies (includes KaTeX)
└── PRD.md
```

## Project Overview

Quorum is a Chrome extension that provides consensus-based answers from multiple AI agents. Users ask a question (text or image), N independent agents answer in parallel, and an arbiter agent determines agreement. If agreement ratio ≥ threshold, return consensus; otherwise, run reconciliation rounds.

## Architecture

**Frontend:** Chrome Extension (Manifest V3)
- Popup UI (React/Vite/Tailwind)
- Side panel support (opens in browser sidebar)
- Background service worker for side panel management
- Chrome storage for settings and session state
- KaTeX for LaTeX math rendering
- Image paste/upload support

**Backend:** Flask API
- `POST /ask` - Main question endpoint
- `POST /validate-key` - API key validation
- `GET /health` - Health check
- Provider-agnostic orchestration layer
- OpenAI provider with vision support for images

## Key Features

- **Multi-agent consensus:** N agents answer independently, arbiter clusters answers
- **Image support:** Paste screenshots or upload images (uses OpenAI vision)
- **LaTeX rendering:** Math answers render properly with KaTeX
- **Side panel:** Open extension in browser sidebar for persistent use
- **Session persistence:** Question/image state syncs between popup and sidebar
- **Agreement ratio:** Calculated server-side (doesn't trust LLM math)

## API Contract

```
POST /ask
{
  "question": "string",
  "image": "data:image/png;base64,...",  // Optional
  "n_agents": 3,
  "agreement_ratio": 0.67,
  "max_rounds": 2,
  "model": "openai:gpt-4.1-mini",
  "api_key": "user_key",
  "return_agent_outputs": false
}
```

## Available Models

- `openai:gpt-4.1-mini` (default, fast)
- `openai:gpt-4.1`
- `openai:gpt-5-mini`
- `openai:gpt-5.1`
- `openai:gpt-5.2`
- `openai:o3-mini` (reasoning)

## Defaults

- N (agents): 3
- R (agreement ratio): 0.67
- max_rounds: 2
- model: openai:gpt-4.1-mini
- return_agent_outputs: false

## Validation Limits

- N: 1-10
- R: 0.0-1.0
- max_rounds: 0-5

## Security Requirements

- API keys stored locally in Chrome storage, sent only over HTTPS
- Backend must never persist or log API keys
- No server-side storage of prompts/answers by default
