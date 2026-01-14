# Quorum

A Chrome extension that provides consensus-based answers from multiple AI agents. Ask a question (or paste a screenshot), and multiple independent AI agents will analyze it. An arbiter determines agreement and returns a consensus answer.

## Features

- **Multi-agent consensus:** Multiple AI agents answer independently for more reliable results
- **Multi-provider support:** Choose from OpenAI, Anthropic (Claude), or Google Gemini models
- **Image support:** Paste screenshots or upload images of questions
- **LaTeX rendering:** Math answers render beautifully with KaTeX
- **Side panel mode:** Open in browser sidebar for persistent access
- **Configurable:** Adjust number of agents, agreement threshold, and model

## Project Structure

```
quorum/
├── extension/          # Chrome Extension (React + Vite + Tailwind + KaTeX)
├── backend/            # Flask API server
├── README.md
├── CLAUDE.md
└── PRD.md
```

## Prerequisites

- Node.js 18+
- Python 3.10+
- API key for at least one provider:
  - OpenAI API key (`sk-...`)
  - Anthropic API key (`sk-ant-...`)
  - Google Gemini API key (`AIza...`)

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
2. Open "Developer Settings" and enter API key(s) for your preferred provider(s):
   - OpenAI, Anthropic (Claude), and/or Google Gemini
3. Select your preferred model from any provider with a configured key
4. Adjust agent count and agreement ratio as needed
5. Click "Save Settings"

## Usage

### Text Questions
Type your question in the text area and click "Ask" or press Ctrl+Enter.

### Image Questions
- **Paste:** Copy a screenshot and paste (Ctrl+V) into the text area
- **Upload:** Click the image icon to select a file

### Side Panel
Click the sidebar icon (next to settings) to open Quorum in the browser's side panel. Your current question and image will be preserved.

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

## Available Models

Models use the format `provider:model-name` in API requests.

### OpenAI

| Model | Description |
|-------|-------------|
| `openai:gpt-4.1-mini` | Fast and cheap (default) |
| `openai:gpt-4.1` | Balanced performance |
| `openai:gpt-5-mini` | Fast, more capable |
| `openai:gpt-5.1` | High capability |
| `openai:gpt-5.2` | Latest and most capable |

### Anthropic (Claude)

| Model | Description |
|-------|-------------|
| `anthropic:claude-opus-4-5-20251101` | Most capable Claude model |
| `anthropic:claude-sonnet-4-5-20250929` | Balanced performance |
| `anthropic:claude-haiku-4-5-20251001` | Fast and efficient |

### Google Gemini

| Model | Description |
|-------|-------------|
| `gemini:gemini-3-pro-preview` | Most capable Gemini |
| `gemini:gemini-3-flash-preview` | Fast, high capability |
| `gemini:gemini-2.5-flash` | Fast and efficient |

## Testing Checklist

- [ ] Backend starts without errors on `http://localhost:5000`
- [ ] Extension loads in Chrome without errors
- [ ] Settings panel opens and saves correctly
- [ ] API key validation works ("Test Key" button)
- [ ] Text questions return consensus answers
- [ ] Image paste/upload works
- [ ] LaTeX math renders correctly
- [ ] Side panel opens with state preserved
- [ ] Debug mode shows per-agent outputs
- [ ] Error states display helpful messages

## API Endpoints

### POST /ask

Request:
```json
{
  "question": "What is the integral of x^2?",
  "image": "data:image/png;base64,...",
  "n_agents": 3,
  "agreement_ratio": 0.67,
  "max_rounds": 2,
  "model": "openai:gpt-4.1-mini",
  "api_key": "sk-...",
  "return_agent_outputs": false
}
```

Response:
```json
{
  "status": "consensus_reached",
  "answer": "The integral of $x^2$ is $\\frac{x^3}{3} + C$",
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

### POST /validate-key

Validates an API key for any supported provider (OpenAI, Anthropic, or Gemini).

### GET /health

Returns `{"status": "ok"}` for health checks.

## Configuration

### Extension Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Number of Agents | 3 | 1-10 | How many AI agents answer the question |
| Agreement Ratio | 67% | 0-100% | Required agreement for consensus |
| Max Rounds | 2 | 0-5 | Maximum reconciliation rounds |
| Model | openai:gpt-4.1-mini | - | Model to use (provider:model format) |
| Debug Mode | Off | - | Show per-agent outputs |

### API Keys (Developer Settings)

| Provider | Key Format | Required For |
|----------|------------|--------------|
| OpenAI | `sk-...` | OpenAI models |
| Anthropic | `sk-ant-...` | Claude models |
| Google Gemini | `AIza...` | Gemini models |

### Backend Environment Variables

See `.env.example`:
- `FLASK_HOST` - Server host (default: 0.0.0.0)
- `FLASK_PORT` - Server port (default: 5000)
- `FLASK_DEBUG` - Enable debug mode (default: true)
- `MAX_AGENTS` - Maximum allowed agents (default: 10)
- `MAX_ROUNDS` - Maximum allowed rounds (default: 5)
