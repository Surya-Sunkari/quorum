# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

### Backend
```bash
cd backend

# Recommended: uv
uv venv
source .venv/Scripts/activate  # Windows
uv pip install -r requirements.txt

# Alternative: standard venv
python -m venv venv
source venv/Scripts/activate  # Windows
pip install -r requirements.txt

python app.py  # Runs on http://localhost:5000
```

### Stripe Webhook Listener (required for billing)
```bash
stripe listen --forward-to localhost:5000/billing/webhook
```

### Extension
```bash
cd extension
npm install
npm run build  # Creates dist/ folder
npm run dev    # Watch mode for development
```

### Backend Tests
```bash
cd backend
uv pip install -r requirements-test.txt
pytest -v --tb=short                    # Run all tests
pytest --cov=. --cov-report=term-missing # With coverage
pytest tests/auth/test_middleware.py     # Run a specific file
```

### Frontend Tests
```bash
cd extension
npm install
npx vitest run          # Run all tests
npx vitest              # Watch mode
npx vitest run --coverage # With coverage
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
│   ├── requirements-test.txt     # Test dependencies (pytest, pytest-cov)
│   ├── pytest.ini                # Pytest configuration
│   ├── .env                      # Backend secrets (not committed)
│   ├── tests/                    # Backend test suite (179 tests)
│   │   ├── conftest.py           # Shared fixtures (app, client, mock_supabase, JWT)
│   │   ├── test_app.py           # Flask endpoint tests
│   │   ├── test_schemas.py       # Pydantic model tests
│   │   ├── auth/                 # Auth module tests
│   │   ├── billing/              # Billing module tests
│   │   ├── providers/            # Provider tests (OpenAI, Anthropic, Gemini)
│   │   └── orchestration/        # Agent, arbiter, orchestrator tests
│   ├── auth/
│   │   ├── routes.py             # /auth/google, /auth/me endpoints
│   │   ├── middleware.py         # require_auth decorator, free-tier enforcement
│   │   ├── db.py                 # Supabase user/usage operations
│   │   ├── google.py             # Google OAuth token verification
│   │   └── jwt_utils.py          # JWT issue/verify helpers
│   ├── billing/
│   │   └── routes.py             # /billing/create-checkout, /billing/webhook
│   ├── orchestration/
│   │   ├── orchestrator.py       # Main multi-agent flow
│   │   ├── agents.py             # AnswerAgent implementation
│   │   └── arbiter.py            # ArbiterAgent for consensus
│   ├── providers/
│   │   ├── base.py               # Provider interface
│   │   ├── openai_provider.py    # OpenAI implementation (supports vision)
│   │   ├── anthropic_provider.py # Anthropic Claude implementation
│   │   └── gemini_provider.py    # Google Gemini implementation
│   └── schemas/
│       └── models.py             # Pydantic request/response models
├── extension/
│   ├── src/
│   │   ├── App.jsx               # Main React component (auth state, upgrade polling)
│   │   ├── main.jsx              # Entry point (imports KaTeX CSS)
│   │   ├── index.css             # Tailwind + KaTeX styles (responsive sidebar)
│   │   ├── test-setup.js          # Test setup (chrome API mocks, KaTeX mock)
│   │   ├── __tests__/             # Frontend test suite (126 tests)
│   │   │   ├── utils/             # storage, api, auth tests
│   │   │   └── components/        # All component tests
│   │   ├── components/
│   │   │   ├── Header.jsx        # Header with user menu, tier badge, upgrade button
│   │   │   ├── LoginScreen.jsx   # Google sign-in screen with tier comparison
│   │   │   ├── UsageDisplay.jsx  # Free tier usage counter
│   │   │   ├── QuestionInput.jsx # Text input + image paste/upload
│   │   │   ├── AnswerCard.jsx    # Result display with LaTeX rendering
│   │   │   ├── MathText.jsx      # LaTeX rendering component (KaTeX)
│   │   │   ├── SettingsPanel.jsx # Settings UI (model gating for free tier)
│   │   │   ├── StatusBadge.jsx   # Consensus status indicator
│   │   │   ├── LoadingState.jsx  # Loading animation
│   │   │   └── ErrorMessage.jsx  # Error display (upgrade prompts on 403/429)
│   │   └── utils/
│   │       ├── storage.js        # Chrome storage + session state helpers
│   │       ├── api.js            # Backend API client
│   │       └── auth.js           # Google OAuth flow, JWT storage, silent refresh
│   ├── public/
│   │   └── background.js         # Service worker for side panel
│   ├── manifest.json             # Chrome MV3 manifest (oauth2 block for identity)
│   ├── .env                      # VITE_GOOGLE_CLIENT_ID, VITE_HOSTED_BACKEND_URL
│   ├── vite.config.js            # Build configuration
│   └── package.json              # Node dependencies (includes KaTeX)
└── PRD.md
```

## Project Overview

Quorum is a Chrome extension that provides consensus-based answers from multiple AI agents. Users sign in with Google, ask a question (text or image), N independent agents answer in parallel, and an arbiter agent determines agreement. Three tiers: Free (20/mo, 3 models), Standard ($5/mo, 200/mo, mid-tier models), Pro ($15/mo, 500/mo, all models).

## Architecture

**Frontend:** Chrome Extension (Manifest V3)
- Popup UI (React/Vite/Tailwind) — fixed 400×600px
- Side panel support — fills full sidebar width responsively
- Google OAuth via `chrome.identity.launchWebAuthFlow` (Web application client type)
- JWT stored in `chrome.storage.local`, synced to server on every mount
- Automatic tier update polling after Stripe checkout
- KaTeX for LaTeX math rendering
- Image paste/upload support

**Backend:** Flask API
- `POST /auth/google` - Exchange Google access token for Quorum JWT
- `GET /auth/me` - Get current user profile + usage
- `POST /billing/create-checkout` - Create Stripe Checkout session
- `POST /billing/webhook` - Handle Stripe webhook events (tier upgrades)
- `POST /ask` - Main question endpoint (requires auth)
- `GET /health` - Health check
- Provider-agnostic orchestration layer
- Supabase for user/usage persistence
- Free tier enforced server-side via `require_auth` middleware

## Key Features

- **Auth:** Google Sign-In, JWT sessions (30-day), silent refresh
- **Freemium:** Free (20/mo, 3 models), Standard ($5/mo, 200/mo, mid-tier), Pro ($15/mo, 500/mo, all models)
- **Multi-agent consensus:** N agents answer independently, arbiter clusters answers
- **Multi-provider support:** OpenAI, Anthropic (Claude), and Google Gemini models
- **Mixed-model mode:** Run agents from different models simultaneously in the same quorum
- **Image support:** Paste screenshots or upload images (vision support across providers)
- **LaTeX rendering:** Math answers render properly with KaTeX
- **Side panel:** Open extension in browser sidebar, adapts to sidebar width
- **Session persistence:** Question/image state syncs between popup and sidebar
- **Agreement ratio:** Calculated server-side (doesn't trust LLM math)
- **Smart arbiter:** Arbiter always uses GPT-5.2 (falls back to best available model)

## API Contract

All `/ask` and `/auth/me` requests require `Authorization: Bearer <jwt>` header.

### Single Model Mode
```json
POST /ask
Authorization: Bearer <jwt>
{
  "question": "string",
  "image": "data:image/png;base64,...",  // Optional
  "n_agents": 3,
  "agreement_ratio": 0.67,
  "max_rounds": 2,
  "model": "openai:gpt-4.1-mini",
  "return_agent_outputs": false
}
```

### Mixed Model Mode
```json
POST /ask
Authorization: Bearer <jwt>
{
  "question": "string",
  "image": "data:image/png;base64,...",  // Optional
  "agreement_ratio": 0.67,
  "max_rounds": 2,
  "return_agent_outputs": false,
  "mixed_models": [
    { "model": "openai:gpt-4.1-mini", "count": 2 },
    { "model": "anthropic:claude-haiku-4-5", "count": 1 }
  ]
}
```

### Auth Errors
- `401` — Missing/expired/invalid JWT
- `403` + `code: UPGRADE_REQUIRED` — Model requires Standard or Pro tier
- `429` + `code: USAGE_LIMIT_REACHED` — Monthly limit hit for current tier

## Available Models

Models use the format `provider:model-name`. Tier access marked with *(free), **(standard), ***(pro).

### OpenAI
- `openai:gpt-4.1-mini` * (default, fast)
- `openai:gpt-4.1` ** (balanced)
- `openai:gpt-5-mini` *** (fast, capable)
- `openai:gpt-5.1` *** (high capability)
- `openai:gpt-5.2` *** (latest)

### Anthropic (Claude)
- `anthropic:claude-haiku-4-5` * (fast)
- `anthropic:claude-sonnet-4-6` ** (balanced)
- `anthropic:claude-opus-4-6` *** (most capable)

### Google Gemini
- `gemini:gemini-2.5-flash` * (fast)
- `gemini:gemini-3-flash-preview` ** (fast, capable)
- `gemini:gemini-3-pro-preview` *** (most capable)

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
- question: max 2000 characters
- agent max_tokens: 1500 per response

## Backend Environment Variables (`backend/.env`)

```bash
# Supabase
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SECRET_KEY=<service-role-key>

# JWT
JWT_SECRET=<random-hex-32>
JWT_EXPIRY_DAYS=30

# Google OAuth (Web application client type)
GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STANDARD_PRICE_ID=price_...   # $5/mo Standard plan
STRIPE_PRO_PRICE_ID=price_...        # $15/mo Pro plan

# AI Provider keys (backend-managed, not user-supplied)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
```

## Extension Environment Variables (`extension/.env`)

```bash
VITE_HOSTED_BACKEND_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=<web-application-client-id>.apps.googleusercontent.com
```

## Google OAuth Setup Notes

- Use **Web application** OAuth client type (NOT Chrome Extension) — required for `chrome.identity.launchWebAuthFlow`
- Add `https://<extension-id>.chromiumapp.org/` as an authorized redirect URI
- The extension ID must be stable — do not remove and re-add the extension (use the reload button)
- The `oauth2` block in `manifest.json` is only used by `chrome.identity.getAuthToken` (not used here)

## Security Requirements

- API keys are backend-managed (stored in `backend/.env`), never sent to or from the extension
- JWT tokens stored in `chrome.storage.local`, sent as Bearer tokens over HTTPS
- Backend never persists or logs JWT secrets or provider API keys
- No server-side storage of prompts/answers by default
- Free tier limits enforced server-side in `require_auth` middleware

## Testing Requirements

**Important:** When adding new features or changing existing functionality, always update or add corresponding tests:

- **Backend changes:** Add/update tests in `backend/tests/`. Follow the existing patterns in `conftest.py` for fixtures. Mock all external services (Supabase, Stripe, AI providers, Google OAuth). Run `pytest -v --tb=short` to verify.
- **Frontend changes:** Add/update tests in `extension/src/__tests__/`. Use React Testing Library for components and mock chrome APIs via the setup in `test-setup.js`. Run `npx vitest run` to verify.
- **New API endpoints:** Add route tests and update middleware tests if auth/tier logic changes.
- **New components:** Add a corresponding `ComponentName.test.jsx` in `__tests__/components/`.
- **New utils:** Add a corresponding `utilName.test.js` in `__tests__/utils/`.
- **Run all tests before committing** to ensure nothing is broken.

## Documentation Maintenance

**Important:** After making significant changes to the codebase, update this file (CLAUDE.md) and README.md to reflect:
- New features or capabilities
- Changes to available models or providers
- API contract changes
- New dependencies or requirements
- Architecture changes
