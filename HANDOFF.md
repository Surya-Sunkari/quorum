# Quorum Freemium Feature — Handoff Notes

## What This Feature Is
Adds a freemium payment system to Quorum:
- **Free tier**: 20 uses/month, only 3 cheapest models (one per provider)
- **Paid tier**: $10/month via Stripe, unlimited uses, all models
- **Auth**: Google OAuth (Chrome identity API) → Quorum issues a 30-day JWT
- **Database**: Supabase (Postgres) for users + monthly usage counts
- **Self-hosted mode and Developer Settings panel have been removed entirely** — users only use Quorum's backend

---

## Current State: What Has Been Implemented

### Backend — fully coded, needs env vars + Supabase
| File | Status | Notes |
|------|--------|-------|
| `backend/auth/__init__.py` | Done | Empty package init |
| `backend/auth/db.py` | Done | Supabase client + user/usage DB ops |
| `backend/auth/jwt_utils.py` | Done | HS256 JWT issue/verify (30-day expiry) |
| `backend/auth/google.py` | Done | Verifies Google access tokens via tokeninfo API |
| `backend/auth/middleware.py` | Done | `@require_auth` decorator, free-tier enforcement |
| `backend/auth/routes.py` | Done | `POST /auth/google`, `GET /auth/me` |
| `backend/billing/__init__.py` | Done | Empty package init |
| `backend/billing/stripe_client.py` | Done | Stripe Checkout sessions + webhook parsing |
| `backend/billing/routes.py` | Done | `POST /billing/create-checkout`, `POST /billing/webhook` |
| `backend/app.py` | Done | Blueprints registered, `/ask` has `@require_auth` + usage increment |
| `backend/schemas/models.py` | Done | `api_key`/`api_keys` now optional (backend uses env var keys) |
| `backend/orchestration/orchestrator.py` | Done | Reads keys from `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` env vars |
| `backend/requirements.txt` | Done | Added `PyJWT==2.8.0`, `stripe==9.12.0`, `supabase==2.4.2` |

### Extension — fully coded, needs env vars + Google setup
| File | Status | Notes |
|------|--------|-------|
| `extension/manifest.json` | Done | Added `identity` permission + `oauth2` block — **client_id is `__GOOGLE_CLIENT_ID__` placeholder** |
| `extension/src/utils/auth.js` | Done | Google OAuth flow, JWT storage, silent refresh |
| `extension/src/utils/storage.js` | Done | Added `tier` field to models, `FREE_TIER_MODELS` set, removed all API key / backend URL settings |
| `extension/src/utils/api.js` | Done | Auth header on `askQuestion`, new `getUserInfo()`, `createCheckoutSession()` |
| `extension/src/components/LoginScreen.jsx` | Done | "Sign in with Google" screen with free/pro tier comparison |
| `extension/src/components/UsageDisplay.jsx` | Done | Usage progress bar (only shown to free users) |
| `extension/src/App.jsx` | Done | Auth state management, login gate, 401/403/429 error handling |
| `extension/src/components/Header.jsx` | Done | User avatar menu, tier badge, upgrade button, sign out |
| `extension/src/components/SettingsPanel.jsx` | Done | Developer Settings removed, `Pro` badge on paid models, tier gating |
| `extension/src/components/ErrorMessage.jsx` | Done | Added `onUpgrade` CTA button prop |

---

## What Still Needs To Be Done (Manual Setup)

### 1. Supabase Project

1. Create a Supabase project at https://supabase.com
2. Go to **SQL Editor** and run the full schema below:

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

3. Go to **Project Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key (under "Project API keys") → `SUPABASE_SERVICE_KEY` (NOT the anon key)

### 2. Google Cloud Console (OAuth)

1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Click **Create Credentials → OAuth 2.0 Client ID**
3. Application type: **Chrome App**
4. Application ID: paste your extension's Chrome ID (from `chrome://extensions` after loading unpacked)
5. Copy the generated **Client ID**
6. In `extension/manifest.json`, replace `__GOOGLE_CLIENT_ID__` with the real client ID
7. Create `extension/.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
   VITE_HOSTED_BACKEND_URL=http://localhost:5000
   ```

> **Note on extension ID stability**: For development, the extension ID changes each time you load it unpacked unless you set a `"key"` in the manifest. To get a stable ID: go to `chrome://extensions`, click "Pack extension", use the generated `.pem` key to derive the key field. Or just update the Google Cloud Console each time during early development.

### 3. Stripe Setup

1. Create a Stripe account or use existing
2. Go to **Products → Add product** → create a recurring price: $10/month
3. Copy the **Price ID** (starts with `price_`)
4. For webhooks:
   - **Local dev**: Use [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:5000/billing/webhook`
   - **Production**: Add a webhook endpoint in Stripe Dashboard pointing to `https://your-domain.com/billing/webhook`
   - Events to send: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Copy the **Webhook signing secret** (starts with `whsec_`)

### 4. Backend `.env` File

Create `backend/.env`:
```bash
# Supabase
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SECRET_KEY=<service_role_key>

# JWT
JWT_SECRET=<run: python -c "import secrets; print(secrets.token_hex(32))">
JWT_EXPIRY_DAYS=30

# Google OAuth (for verifying tokens on the backend)
GOOGLE_CLIENT_ID=<same-client-id>.apps.googleusercontent.com

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Quorum's hosted API keys (used by the orchestrator)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
```

### 5. Install New Python Dependencies

```bash
cd backend
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 6. Build and Test the Extension

```bash
cd extension
npm install
npm run dev    # or npm run build
```

Load unpacked at `chrome://extensions` → select `extension/dist`

---

## Key Architecture Notes

### Auth Flow
```
Extension                          Backend                      External
  │                                   │                             │
  ├─ chrome.identity.launchWebAuthFlow ──────────────────────────►  │ Google OAuth
  │◄─ Google access token ─────────────────────────────────────────  │
  │                                   │                             │
  ├─ POST /auth/google {access_token} ►│                             │
  │                                   ├─ GET tokeninfo ────────────►│ Google tokeninfo
  │                                   │◄─ {sub, email} ─────────────│
  │                                   ├─ upsert user in Supabase    │
  │                                   ├─ issue JWT (30 days)        │
  │◄─ {token, user} ─────────────────  │                             │
  │                                   │                             │
  ├─ POST /ask  Authorization: Bearer <jwt> ►│                      │
  │                                   ├─ verify JWT                 │
  │                                   ├─ load user from Supabase    │
  │                                   ├─ check tier + usage         │
  │                                   ├─ run orchestration          │
  │                                   ├─ increment usage count      │
  │◄─ AskResponse ───────────────────  │                             │
```

### Tier Gating
- Free-tier models defined in **two places** (kept in sync):
  - `backend/auth/middleware.py`: `FREE_TIER_MODELS` set (enforced server-side)
  - `extension/src/utils/storage.js`: `FREE_TIER_MODELS` set + `tier: 'free'` on model objects (used for UI gating)
- Monthly limit: `FREE_TIER_MONTHLY_LIMIT = 20` in `backend/auth/middleware.py`

### Stripe → User Tier Update
The Stripe webhook (`POST /billing/webhook`) handles:
- `checkout.session.completed` → links Stripe `customer_id` to our user via `metadata.user_id`
- `customer.subscription.created/updated` (status: active/trialing) → sets `tier = 'paid'`
- `customer.subscription.deleted` → sets `tier = 'free'`

The extension picks up tier changes on the next request (backend loads fresh user from DB on every `/ask`).

### Stripe Checkout `success_url`
Currently hardcoded to `https://quorum.app/success` in `backend/billing/stripe_client.py`. Update this to your actual domain before going live.

---

## Potential Issues / Watch Out For

1. **`/validate-key` endpoint** is still in `app.py` but no longer has `@require_auth` and is no longer called from the UI. It's harmless dead code — remove it when convenient.

2. **`getProviderFromModel` and `getHostedApiKey`** are still exported from `storage.js` but no longer used in the extension. Can be removed when cleaning up.

3. **JWT expiry and silent refresh**: `auth.js` attempts a non-interactive `launchWebAuthFlow` when the JWT expires. This works when the user is already signed into Chrome with their Google account. If it fails, the user is signed out and sees the LoginScreen.

4. **Extension ID for OAuth**: The `oauth2.client_id` in `manifest.json` must match the Chrome App OAuth client registered in Google Cloud Console with the exact extension ID. During development with an unpacked extension, the ID may differ from production (Chrome Web Store). You may need two OAuth clients (one for dev, one for prod).

5. **httpx version pin**: `requirements.txt` pins `httpx>=0.27.0,<0.28.0` for compatibility with older dependencies. `supabase==2.4.2` may have its own httpx requirements — if there are conflicts, try upgrading the supabase version or relaxing the pin.

6. **Stripe webhook must be publicly accessible**: For local testing, run `stripe listen --forward-to localhost:5000/billing/webhook` with the Stripe CLI. The CLI prints a webhook signing secret to use in `.env`.

---

## File Structure of New/Modified Files

```
backend/
├── auth/
│   ├── __init__.py
│   ├── db.py              ← Supabase client + user/usage operations
│   ├── google.py          ← Verifies Google OAuth tokens
│   ├── jwt_utils.py       ← Issues/verifies app JWTs
│   ├── middleware.py      ← @require_auth decorator + FREE_TIER constants
│   └── routes.py          ← /auth/google + /auth/me
├── billing/
│   ├── __init__.py
│   ├── stripe_client.py   ← Stripe Checkout session + webhook parsing
│   └── routes.py          ← /billing/create-checkout + /billing/webhook
├── orchestration/
│   └── orchestrator.py    ← Modified: reads API keys from env vars
├── schemas/
│   └── models.py          ← Modified: api_key/api_keys optional
├── app.py                 ← Modified: blueprints, @require_auth, usage increment
└── requirements.txt       ← Modified: added PyJWT, stripe, supabase

extension/
├── manifest.json          ← Modified: identity permission, oauth2 block (replace __GOOGLE_CLIENT_ID__)
├── .env                   ← Create: VITE_GOOGLE_CLIENT_ID, VITE_HOSTED_BACKEND_URL
└── src/
    ├── App.jsx            ← Modified: auth state, login gate, error handling
    ├── utils/
    │   ├── auth.js        ← New: Google OAuth + JWT storage + silent refresh
    │   ├── storage.js     ← Modified: tier fields, FREE_TIER_MODELS, no API key settings
    │   └── api.js         ← Modified: auth header, getUserInfo, createCheckoutSession
    └── components/
        ├── LoginScreen.jsx    ← New: Sign in with Google screen
        ├── UsageDisplay.jsx   ← New: usage progress bar for free users
        ├── Header.jsx         ← Modified: user menu, tier badge, upgrade button
        ├── SettingsPanel.jsx  ← Modified: removed Developer Settings, Pro model gating
        └── ErrorMessage.jsx   ← Modified: onUpgrade CTA prop
```
