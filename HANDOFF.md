# Quorum — Handoff Notes

**Last updated:** 2026-03-03

---

## What This Project Is

Quorum is a Chrome extension that runs multiple AI agents on a question and returns a consensus answer. Users sign in with Google, ask a question (text or image), N agents answer in parallel, and an arbiter evaluates agreement.

---

## Current State

### Completed & Tested ✅
- Google OAuth end-to-end (Web application client type, chromiumapp.org redirect)
- JWT issued, stored in chrome.storage.local, synced to server on every mount
- Supabase schema deployed with 3-tier constraint
- Free tier model gating (403 → upgrade prompt)
- Free tier usage limit (429 → upgrade prompt)
- Stripe checkout working end-to-end: webhook fires correctly, tier updates in DB
- Stripe webhook ordering bug fixed: `checkout.session.completed` now sets tier immediately (subscription events fire before checkout.session, so they can't be relied on alone)
- 3-tier plan system implemented (Free / Standard / Pro)
- Input cap: 2000 char question limit
- Output cap: 1500 max_tokens per agent
- Upgrade-pending polling: if popup closes during checkout, tier updates automatically on next popup open
- CLAUDE.md updated

### Still Needs Testing ⚠️
- **Full Stripe flow with new Standard and Pro price IDs** — the backend `.env` may still have the old `STRIPE_PRICE_ID`; needs `STRIPE_STANDARD_PRICE_ID` and `STRIPE_PRO_PRICE_ID`
- **Standard tier model gating** — standard users should be blocked from Pro models (gpt-5.x, opus, gemini-3-pro)
- **Per-tier usage limits** — free=20, standard=200, pro=500
- **Plan picker UI** — clicking Upgrade shows a modal to choose Standard ($5) or Pro ($15)
- **UsageDisplay for all tiers** — now shows for standard and pro users too (not just free)

---

## Tier Structure

| Tier | Price | Uses/month | Models |
|------|-------|-----------|--------|
| free | $0 | 20 | gpt-4.1-mini, claude-haiku-4-5, gemini-2.5-flash |
| standard | $5/mo | 200 | Free + gpt-4.1, claude-sonnet-4-6, gemini-3-flash-preview |
| pro | $15/mo | 500 | All models |

---

## Setup — What's Already Done

- Supabase: schema deployed, constraint updated to `('free', 'standard', 'pro')`, existing `paid` user migrated to `pro`
- Google OAuth: configured, working
- Stripe: test mode, CLI listener used for local webhooks

---

## What Still Needs To Be Done Before Testing

### 1. Create Stripe Products (if not done yet)
In Stripe Dashboard (test mode) → Catalog → Products:
- **Quorum Standard** — $5/mo recurring → copy `price_` ID
- **Quorum Pro** — $15/mo recurring → copy `price_` ID

### 2. Update `backend/.env`
Remove `STRIPE_PRICE_ID` and add:
```bash
STRIPE_STANDARD_PRICE_ID=price_<standard>
STRIPE_PRO_PRICE_ID=price_<pro>
```

### 3. Rebuild the Extension
```bash
cd extension && npm run build
```
Then reload in `chrome://extensions/` using the **refresh button** (not remove+re-add, or extension ID changes and OAuth breaks).

### 4. Restart Backend
```bash
cd backend
source .venv/Scripts/activate
python app.py
# In separate terminal:
stripe listen --forward-to localhost:5000/billing/webhook
```
The `stripe listen` command prints a new `whsec_...` each run — make sure it matches `STRIPE_WEBHOOK_SECRET` in `backend/.env`.

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

1. **`success_url` is hardcoded** to `https://quorum.app/success` in `backend/billing/stripe_client.py`. The tab will land on a broken URL after payment — this is fine for testing, the webhook fires regardless. Fix before going live.

2. **`/validate-key` endpoint** is dead code in `app.py` — harmless, remove when convenient.

3. **`getProviderFromModel` and `getHostedApiKey`** are still exported from `storage.js` but unused.

4. **Standard user upgrade path**: when a standard user clicks Upgrade, the plan picker only shows the Pro option (the Standard card is hidden since they're already on Standard). This is handled correctly in `App.jsx` — the `auth.user?.tier === 'free'` check on the Standard button ensures it's only shown to free users.

5. **JWT expiry and silent refresh**: `auth.js` attempts a non-interactive `launchWebAuthFlow` when the JWT expires. If it fails (user not signed in), they're signed out to LoginScreen.

6. **Extension ID for OAuth**: The registered `chromiumapp.org` redirect URI must match the actual loaded extension ID. Do not remove and re-add — use the refresh button. If you reinstall, update the redirect URI in Google Cloud Console.

7. **Supabase `maybe_single()` behaviour**: In supabase-py >= 2.10, returns `None` (not a result with `data=None`) when no row found. `db.py` handles this correctly.

---

## Key Architecture Notes

### Tier Gating — Must Keep In Sync
Free/Standard model sets are defined in **two places**:
- `backend/auth/middleware.py`: `FREE_TIER_MODELS`, `STANDARD_TIER_MODELS` (server-side enforcement)
- `extension/src/utils/storage.js`: `FREE_TIER_MODELS`, `STANDARD_TIER_MODELS`, `isModelAccessible()` (UI gating)

Monthly limits:
- `backend/auth/middleware.py`: `FREE_TIER_MONTHLY_LIMIT=20`, `STANDARD_TIER_MONTHLY_LIMIT=200`, `PRO_TIER_MONTHLY_LIMIT=500`

### Stripe Webhook Fix
`customer.subscription.created` fires **before** `checkout.session.completed`. This means the subscription event runs `update_user_tier(stripe_customer_id=...)` before the customer ID has been linked to the user — so it hits zero rows. The fix: `checkout.session.completed` now calls both `set_stripe_customer_id` AND `update_user_tier` in sequence. Subsequent subscription events will also correctly update tier since the customer ID is now set.

### Upgrade-Pending Polling
When the user clicks Upgrade, Chrome closes the popup (because a new tab opens). The `setInterval` polling is destroyed. Fix:
1. `handleSelectPlan` in `App.jsx` sets `chrome.storage.local.set({ quorum_upgrade_pending: Date.now() })`
2. On mount, if flag is set and tier is still free, polling resumes for the remaining window (up to 10 min from when upgrade was started)
3. Flag is cleared when tier becomes standard/pro

### Stripe → User Tier Update Flow
```
checkout.session.completed
  → set_stripe_customer_id(user_id, customer_id)
  → update_user_tier(customer_id, tier='standard'|'pro')   ← determined by metadata.plan

customer.subscription.created/updated
  → update_user_tier(customer_id, tier based on status+plan)  ← works only if customer_id already linked

customer.subscription.deleted
  → update_user_tier(customer_id, tier='free')
```

### To Reset a Test User
In Supabase Table Editor → `users`:
- Set `tier` to `free`
- Clear `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`

---

## File Map for Key Changes

| File | What Changed |
|------|-------------|
| `backend/auth/middleware.py` | 3 tier model sets, per-tier monthly limits, `get_tier_limits()` helper |
| `backend/auth/routes.py` | `/auth/me` uses `get_tier_limits()` for correct limit per tier |
| `backend/billing/routes.py` | Accepts `plan` param, sets correct tier in webhook, fixed ordering bug |
| `backend/billing/stripe_client.py` | Accepts `plan`, reads `STRIPE_STANDARD_PRICE_ID`/`STRIPE_PRO_PRICE_ID` |
| `backend/schemas/models.py` | question `max_length` = 2000 |
| `backend/orchestration/agents.py` | `max_tokens` = 1500 per agent |
| `extension/src/utils/storage.js` | `STANDARD_TIER_MODELS`, model `tier` fields, `isModelAccessible()` |
| `extension/src/utils/api.js` | `createCheckoutSession` accepts `plan` param |
| `extension/src/App.jsx` | Plan picker modal, upgrade-pending polling on mount, usage display for all tiers |
| `extension/src/components/Header.jsx` | Upgrade button for free+standard, tier label shows Standard/Pro/Free |
| `extension/src/components/SettingsPanel.jsx` | Model gating uses `isModelAccessible()`, badges say Standard/Pro |
| `extension/src/components/LoginScreen.jsx` | 3-tier comparison (Free / Standard / Pro) |
