# Quorum Freemium Feature — Handoff Notes

**Last updated:** 2026-02-27

## What This Feature Is
Adds a freemium payment system to Quorum:
- **Free tier**: 20 uses/month, only 3 cheapest models (one per provider)
- **Paid tier**: $10/month via Stripe, unlimited uses, all models
- **Auth**: Google OAuth (Chrome identity API) → Quorum issues a 30-day JWT
- **Database**: Supabase (Postgres) for users + monthly usage counts
- **Self-hosted mode and Developer Settings panel have been removed entirely** — users only use Quorum's backend

---

## Current State: Everything Is Working Except Stripe Verification

### Completed & Tested ✅
- Supabase project created, schema deployed
- Google OAuth working (Web application client type, `chromiumapp.org` redirect URI)
- Sign in with Google flow works end-to-end
- JWT issued and stored in `chrome.storage.local`
- Tier synced from `/auth/me` on every popup mount (no sign-out needed after upgrade)
- Free tier model gating working (403 → upgrade prompt)
- Free tier usage limit working (429 → upgrade prompt)
- Stale Chrome storage issue resolved (Reset button clears mixed model configs)
- Sidebar fills full width responsively
- Popup loading spinner centered correctly
- Model select dropdown has custom arrow (appearance-none)
- Automatic tier polling after Stripe checkout (sidebar stays open → polls every 3s; popup reopens → checks on mount)
- CLAUDE.md, README.md, PRD.md all updated

### Still Needs Testing ⚠️
- **Stripe end-to-end**: Checkout opens, test card payment, webhook fires, tier upgrades automatically
  - Stripe CLI listener must be running: `stripe listen --forward-to localhost:5000/billing/webhook`
  - Test card: `4242 4242 4242 4242`, any future expiry, any CVC
  - After payment, extension should show Pro within ~3 seconds (sidebar) or on next popup open
  - Check `stripe listen` terminal for `checkout.session.completed` event
  - Check Supabase `users` table for `tier = 'paid'` and `stripe_customer_id` populated

---

## Setup — Already Done (Don't Redo)

### External Services Configured
- ✅ Supabase: project created, schema deployed, credentials in `backend/.env`
- ✅ Google OAuth: Web application client created, `chromiumapp.org` redirect URI added, client ID in `extension/.env` and `extension/manifest.json`
- ✅ Stripe: product + price created, secret key added to `backend/.env`, `stripe listen` used for local webhook

### Environment Files
Both env files exist and are populated:
- `backend/.env` — Supabase, JWT, Google, Stripe, AI provider keys
- `extension/.env` — `VITE_HOSTED_BACKEND_URL`, `VITE_GOOGLE_CLIENT_ID`

### Key env var name (gotcha)
The code in `backend/auth/db.py` reads `SUPABASE_SECRET_KEY` (not `SUPABASE_SERVICE_KEY`). Make sure `backend/.env` uses `SUPABASE_SECRET_KEY`.

---

## How To Run

```bash
# Terminal 1 — Backend
cd backend
source .venv/Scripts/activate
python app.py

# Terminal 2 — Stripe webhook listener
stripe listen --forward-to localhost:5000/billing/webhook

# Extension
cd extension && npm run build
# Load unpacked from extension/dist at chrome://extensions
```

---

## Known Issues / Watch Out For

1. **Stripe `success_url`** is hardcoded to `https://quorum.app/success` in `backend/billing/stripe_client.py`. Update before going live.

2. **Webhook events** needed: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. The Stripe CLI listener forwards all events by default.

3. **JWT expiry and silent refresh**: `auth.js` attempts a non-interactive `launchWebAuthFlow` when the JWT expires. If it fails, the user is signed out and sees the LoginScreen.

4. **Extension ID for OAuth**: The registered `chromiumapp.org` redirect URI must match the actual loaded extension ID. Do not remove and re-add the extension — use the refresh button. If you need to reinstall, update the redirect URI in Google Cloud Console.

5. **`/validate-key` endpoint** is dead code in `app.py` — harmless, remove when convenient.

6. **`getProviderFromModel` and `getHostedApiKey`** are still exported from `storage.js` but unused. Remove when cleaning up.

7. **Supabase `maybe_single()` behaviour**: In supabase-py >= 2.10, `maybe_single().execute()` returns `None` (not a result object with `data=None`) when no row is found. `db.py` already handles this with `if result is None or result.data is None`.

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
- Free-tier models defined in **two places** (must be kept in sync):
  - `backend/auth/middleware.py`: `FREE_TIER_MODELS` set (enforced server-side)
  - `extension/src/utils/storage.js`: `FREE_TIER_MODELS` set + `tier: 'free'` on model objects (UI gating)
- Monthly limit: `FREE_TIER_MONTHLY_LIMIT = 20` in `backend/auth/middleware.py`

### Stripe → User Tier Update
The Stripe webhook (`POST /billing/webhook`) handles:
- `checkout.session.completed` → links Stripe `customer_id` to our user via `metadata.user_id`
- `customer.subscription.created/updated` (status: active/trialing) → sets `tier = 'paid'`
- `customer.subscription.deleted` → sets `tier = 'free'`

### Automatic Tier Sync (Extension)
Two mechanisms ensure tier updates without sign-out:
1. **On mount** (`App.jsx`): calls `/auth/me` and updates tier in state if it changed (handles popup reopen)
2. **After upgrade click** (`handleUpgrade`): polls `/auth/me` every 3s for up to 10 minutes (handles sidebar staying open)

### To Reset a Test User
In Supabase Table Editor → `users`:
- Set `tier` back to `free`
- Clear `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`
