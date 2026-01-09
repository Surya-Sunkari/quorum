# Quorum

A Chrome extension that provides consensus-based answers from multiple AI agents.

## Project Structure

```
quorum/
├── extension/          # Chrome Extension (React + Vite + Tailwind)
├── backend/            # Flask API server
├── README.md
├── CLAUDE.md
└── PRD.md
```

## Prerequisites

- Node.js 18+
- Python 3.10+
- OpenAI API key

## Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt

# Copy env example (optional - API key comes from extension)
copy .env.example .env

# Run the server
python app.py
```

Backend runs at `http://localhost:5000`

### 2. Extension Setup

```bash
cd extension
npm install
npm run build
```

### 3. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension/dist` folder
5. Click the Quorum extension icon in toolbar

### 4. Configure Extension

1. Click the settings icon in the extension popup
2. Enter your OpenAI API key
3. Adjust agent count, agreement ratio, and other settings as needed
4. Click "Save Settings"

## Development

### Backend (with auto-reload)

```bash
cd backend
python app.py
```

### Extension (watch mode)

```bash
cd extension
npm run dev
```

After changes, reload the extension in `chrome://extensions/`

## Testing Checklist

- [ ] Backend starts without errors on `http://localhost:5000`
- [ ] Extension loads in Chrome without errors
- [ ] Settings panel opens and saves correctly
- [ ] API key validation works ("Test Key" button)
- [ ] Submitting a question shows loading states
- [ ] Answer displays with status badge and agreement ratio
- [ ] Debug mode shows per-agent outputs
- [ ] Error states display helpful messages
- [ ] Settings persist after closing/reopening extension

## API Endpoints

### POST /ask

Request:
```json
{
  "question": "What is 2+2?",
  "n_agents": 3,
  "agreement_ratio": 0.67,
  "max_rounds": 2,
  "model": "openai:gpt-4o-mini",
  "api_key": "sk-...",
  "return_agent_outputs": false
}
```

Response:
```json
{
  "status": "consensus_reached",
  "answer": "4",
  "agreement_ratio_achieved": 1.0,
  "agreement_threshold": 0.67,
  "winning_cluster_size": 3,
  "n_agents": 3,
  "rounds_used": 1,
  "confidence": 0.95,
  "disagreement_summary": "",
  "agent_outputs": []
}
```

### GET /health

Returns `{"status": "ok"}` for health checks.
