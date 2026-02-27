# Quorum

A Chrome extension that provides consensus-based answers from multiple AI agents. Ask a question (or paste a screenshot), and multiple independent AI agents will analyze it. An arbiter determines agreement and returns a consensus answer.

## Features

- **Multi-agent consensus:** Multiple AI agents answer independently for more reliable results
- **Multi-provider support:** Choose from OpenAI, Anthropic (Claude), or Google Gemini models
- **Mixed-model mode:** Run agents from different models/providers simultaneously in the same quorum
- **Image support:** Paste screenshots or upload images of questions
- **LaTeX rendering:** Math answers render beautifully with KaTeX
- **Side panel mode:** Open in browser sidebar for persistent access, adapts to sidebar width
- **Freemium:** Free tier (20 uses/month, 3 models) — Pro tier ($10/mo, unlimited)
- **Google Sign-In:** Secure auth via Google OAuth, no passwords
- **Smart arbiter:** Uses GPT-5.2 for consensus evaluation (with intelligent fallback)

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
- Python 3.10+ (with [uv](https://github.com/astral-sh/uv) recommended)
- A Google Cloud project with OAuth 2.0 credentials (Web application type)
- A Supabase project
- A Stripe account (test mode is fine for development)
- API keys for AI providers (stored in backend, not the extension):
  - OpenAI API key (`sk-...`)
  - Anthropic API key (`sk-ant-...`)
  - Google Gemini API key (`AIza...`)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the schema in **SQL Editor**:

```sql
CREATE TABLE public.users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id              TEXT NOT NULL UNIQUE,
  email                  TEXT NOT NULL UNIQUE,
  tier                   TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  subscription_status    TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.usage (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period   TEXT NOT NULL,
  count    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, period)
);

CREATE INDEX idx_usage_user_period ON public.usage(user_id, period);
CREATE INDEX idx_users_google_id   ON public.users(google_id);
CREATE INDEX idx_users_stripe      ON public.users(stripe_customer_id);

CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID, p_period TEXT)
RETURNS INTEGER AS $$
DECLARE new_count INTEGER;
BEGIN
  INSERT INTO public.usage(user_id, period, count) VALUES (p_user_id, p_period, 1)
  ON CONFLICT (user_id, period) DO UPDATE SET count = usage.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
```

3. From **Project Settings → API**, copy the **Project URL** and **service_role** key.

### 2. Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com), create an OAuth 2.0 Client ID
2. Application type: **Web application**
3. Add an authorized redirect URI: `https://<your-extension-id>.chromiumapp.org/`
4. Copy the Client ID

### 3. Stripe

1. Go to [stripe.com](https://stripe.com), stay in **test mode**
2. Create a product: **Quorum Pro**, $10/month recurring — copy the `price_` ID
3. Copy your **secret key** (`sk_test_...`)
4. Run the webhook listener locally: `stripe listen --forward-to localhost:5000/billing/webhook` — copy the `whsec_` secret

### 4. Backend Setup

Create `backend/.env`:
```bash
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SECRET_KEY=<service-role-key>
JWT_SECRET=<random-hex-32>
JWT_EXPIRY_DAYS=30
GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
```

Then install and run:
```bash
cd backend
uv venv
source .venv/Scripts/activate  # Windows (use source .venv/bin/activate on Mac/Linux)
uv pip install -r requirements.txt
python app.py
```

Backend runs at `http://localhost:5000`

### 5. Extension Setup

Create `extension/.env`:
```bash
VITE_HOSTED_BACKEND_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=<web-application-client-id>.apps.googleusercontent.com
```

Then build:
```bash
cd extension
npm install
npm run build
```

### 6. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension/dist` folder
5. Click the Quorum extension icon in toolbar

## Usage

### Sign In
Click "Sign in with Google" and authorize with your Google account. Free tier gives you 20 uses/month with access to 3 models.

### Text Questions
Type your question in the text area and click "Ask" or press Ctrl+Enter.

### Image Questions
- **Paste:** Copy a screenshot and paste (Ctrl+V) into the text area
- **Upload:** Click the image icon to select a file

### Side Panel
Click the sidebar icon (next to settings) to open Quorum in the browser's side panel. Your current question and image will be preserved. The panel adapts to the sidebar width.

### Mixed Model Mode
Enable "Mixed Models" in settings to run agents from multiple providers simultaneously:
1. Toggle "Mixed Models" in the Agent Configuration section
2. Set the number of agents for each model you want to use (minimum 1 per model)
3. Total agents across all models cannot exceed 10

### Upgrading to Pro
Click the **Upgrade** button in the header or settings. A Stripe Checkout page will open. After payment, the extension automatically detects the upgrade within a few seconds.

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

Free tier models are marked with *.

### OpenAI

| Model | Description |
|-------|-------------|
| `openai:gpt-4.1-mini` * | Fast (default) |
| `openai:gpt-4.1` | Balanced |
| `openai:gpt-5-mini` | Fast, capable |
| `openai:gpt-5.1` | High capability |
| `openai:gpt-5.2` | Latest |

### Anthropic (Claude)

| Model | Description |
|-------|-------------|
| `anthropic:claude-haiku-4-5` * | Fast |
| `anthropic:claude-sonnet-4-6` | Balanced |
| `anthropic:claude-opus-4-6` | Most capable |

### Google Gemini

| Model | Description |
|-------|-------------|
| `gemini:gemini-2.5-flash` * | Fast |
| `gemini:gemini-3-flash-preview` | Fast, capable |
| `gemini:gemini-3-pro-preview` | Most capable |

## API Endpoints

All endpoints except `/health` require `Authorization: Bearer <jwt>`.

### POST /auth/google
Exchange a Google access token for a Quorum JWT.

### GET /auth/me
Get current user profile and usage info.

### POST /billing/create-checkout
Create a Stripe Checkout session for Pro upgrade.

### POST /billing/webhook
Stripe webhook handler (tier upgrades on payment).

### POST /ask

#### Single Model Mode
```json
{
  "question": "What is the integral of x^2?",
  "n_agents": 3,
  "agreement_ratio": 0.67,
  "max_rounds": 2,
  "model": "openai:gpt-4.1-mini",
  "return_agent_outputs": false
}
```

#### Mixed Model Mode
```json
{
  "question": "What is the integral of x^2?",
  "agreement_ratio": 0.67,
  "max_rounds": 2,
  "return_agent_outputs": true,
  "mixed_models": [
    { "model": "openai:gpt-4.1-mini", "count": 2 },
    { "model": "anthropic:claude-haiku-4-5", "count": 1 }
  ]
}
```

### GET /health
Returns `{"status": "ok"}` for health checks.

## Configuration

### Extension Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Number of Agents | 3 | 1-10 | How many AI agents answer the question |
| Agreement Ratio | 67% | 0-100% | Required agreement for consensus |
| Max Rounds | 2 | 0-5 | Maximum reconciliation rounds |
| Model | openai:gpt-4.1-mini | — | Model to use (free tier: 3 options) |
| Mixed Models | Off | — | Enable mixed-model mode |
| Debug Mode | Off | — | Show per-agent outputs |

## Testing Checklist

- [ ] Backend starts without errors on `http://localhost:5000`
- [ ] Extension loads in Chrome without errors
- [ ] Google Sign-In flow completes successfully
- [ ] Free tier usage counter displays correctly
- [ ] Free tier blocks paid models with upgrade prompt
- [ ] Free tier blocks at 20 uses with upgrade prompt
- [ ] Text questions return consensus answers
- [ ] Image paste/upload works
- [ ] LaTeX math renders correctly
- [ ] Side panel opens with state preserved and fills width
- [ ] Stripe Checkout opens on Upgrade click
- [ ] Tier upgrades automatically after payment (no sign-out required)
- [ ] Pro tier allows all models
- [ ] Debug mode shows per-agent outputs
