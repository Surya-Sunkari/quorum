# Production Checklist

Everything needed before going live. Work top to bottom — later sections depend on earlier ones.

---

## 1. Infrastructure — decide where things live

- [ ] Choose a backend host (Railway, Render, Fly.io, etc.) and note the URL you'll get (e.g. `https://api.quorum.app`)
- [ ] Choose a frontend host (Vercel, Netlify, etc.) and note the URL (e.g. `https://quorum.app`)
- [ ] Buy / configure your domain and point DNS accordingly
- [ ] Make sure both hosts support HTTPS (they all do by default on the services above)

---

## 2. Supabase

- [ ] Confirm the `tier` constraint on the `users` table is `CHECK (tier IN ('free', 'standard', 'pro'))` — not the old `('free', 'paid')`
- [ ] Enable Supabase point-in-time recovery or scheduled backups if the plan supports it
- [ ] Review Row Level Security policies — the service role key bypasses RLS, which is correct for backend use, but double-check no anon access is possible

---

## 3. Stripe — switch from test to live

- [ ] Go to Stripe dashboard and toggle to **Live mode**
- [ ] Create live products: **Quorum Standard** ($5/mo) and **Quorum Pro** ($15/mo) — copy the `price_` IDs
- [ ] Copy the live **secret key** (`sk_live_...`)
- [ ] Register a production webhook endpoint in Stripe dashboard: `https://api.quorum.app/billing/webhook`
  - Events to listen for: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Copy the webhook signing secret (`whsec_...`) for the production endpoint
- [ ] Update `backend/.env` (production copy):
  ```
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...   ← from the dashboard endpoint, not stripe listen
  STRIPE_STANDARD_PRICE_ID=price_... ← live price ID
  STRIPE_PRO_PRICE_ID=price_...      ← live price ID
  ```
- [ ] Stop using `stripe listen` locally for production — the dashboard webhook handles it

---

## 4. Google OAuth

- [ ] In Google Cloud Console, add the production **frontend URL** as an authorized JavaScript origin (e.g. `https://quorum.app`) — needed for the GIS token client on the website
- [ ] Verify the extension's `chromiumapp.org` redirect URI is still registered and matches the loaded extension ID
- [ ] If publishing the extension to the Chrome Web Store, note that the extension ID will change — update the redirect URI before publishing

---

## 5. Backend — environment variables (production copy)

Fix the typo and update all values:

```bash
FLASK_HOST=0.0.0.0
FLASK_PORT=8080          # or whatever your host expects
FLASK_DEBUG=false        # ← must be false in production

FRONTEND_URL=https://quorum.app   # ← used for Stripe success/cancel URLs

SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SECRET_KEY=<service-role-key>

JWT_SECRET=<new strong random hex — do not reuse the dev secret>
JWT_EXPIRY_DAYS=30       # ← fix the typo (was JWT_EXPIRY_DATS in dev .env)
GOOGLE_CLIENT_ID=<same client id>

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STANDARD_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
```

---

## 6. Backend — code changes before deploy

- [ ] **Restrict CORS** — `app.py` line 25 currently uses `CORS(app)` which allows all origins. Lock it down:
  ```python
  CORS(app, origins=[
      "https://quorum.app",
      "chrome-extension://<your-extension-id>",
  ])
  ```
- [ ] **Remove traceback from 500 responses** — `app.py` lines 153–158 return the full traceback to the client. Remove `"traceback": tb` from the error JSON before deploying.
- [ ] **Remove `/validate-key` endpoint** — it's dead code (noted in HANDOFF.md, `app.py` lines 41–77)
- [ ] **Run with a production WSGI server** — don't use Flask's built-in dev server. Use gunicorn:
  ```bash
  pip install gunicorn
  gunicorn -w 4 -b 0.0.0.0:8080 app:app
  ```
  Add `gunicorn` to `requirements.txt`

---

## 7. Extension — environment variables and build

Update `extension/.env` for production:

```bash
VITE_HOSTED_BACKEND_URL=https://api.quorum.app
VITE_GOOGLE_CLIENT_ID=<same client id>
VITE_FRONTEND_URL=https://quorum.app
```

Then build:
```bash
cd extension && npm run build
```

---

## 8. Extension — Chrome Web Store submission

- [ ] Create a Chrome Web Store developer account ($5 one-time fee) if you don't have one
- [ ] Prepare store listing assets: icon (128px), screenshots (1280×800 or 640×400), promo tile
- [ ] Write a short store description
- [ ] Zip the `extension/dist` folder and upload
- [ ] Note the new extension ID assigned by the store — update the Google OAuth redirect URI to match (`https://<new-id>.chromiumapp.org/`)
- [ ] Submit for review (takes 1–3 business days typically)
- [ ] Once approved, update `frontend/.env` → `VITE_CHROME_EXTENSION_URL` with the real store URL

---

## 9. Frontend — environment variables and deploy

Update `frontend/.env` for production (set as env vars on your host, not committed):

```bash
VITE_BACKEND_URL=https://api.quorum.app
VITE_GOOGLE_CLIENT_ID=<same client id>
VITE_CHROME_EXTENSION_URL=https://chrome.google.com/webstore/detail/quorum/<extension-id>
```

Build:
```bash
cd frontend && npm run build
```

If deploying to Netlify or Vercel, configure SPA routing so all routes serve `index.html`:
- **Netlify:** add `frontend/public/_redirects` containing `/* /index.html 200`
- **Vercel:** add `vercel.json` with rewrites to `index.html`

---

## 10. Frontend — cleanup

- [ ] Remove unused exports from `extension/src/utils/storage.js`: `getProviderFromModel` and `getHostedApiKey` (noted in HANDOFF.md)
- [ ] Update `README.md` — it still says "Pro $10/mo" (old pricing) and doesn't mention Standard tier or the frontend website

---

## 11. End-to-end test in production before announcing

- [ ] Backend health check: `GET https://api.quorum.app/health` returns `{"status": "ok"}`
- [ ] Frontend loads at `https://quorum.app` with logo and correct extension link
- [ ] Google sign-in works on the website (pricing page)
- [ ] Stripe checkout completes with a live test card (`4242 4242 4242 4242`)
- [ ] `/success` page confirms tier upgrade
- [ ] Extension loads and `/ask` works against the production backend
- [ ] Free tier blocks at 20 uses with upgrade prompt
- [ ] Standard tier blocks Pro models
- [ ] `stripe listen` is NOT running — webhook comes from the dashboard endpoint

---

## Known issues to fix at any point

- [ ] **`JWT_EXPIRY_DATS` typo** in `backend/.env` (dev file has the typo — fix in production env)
- [ ] **Standard tier gating** still needs testing (standard users should be blocked from Pro models)
- [ ] **Per-tier usage limits** (free=20, standard=200, pro=500) need end-to-end verification
- [ ] **UsageDisplay for all tiers** — shows for standard and pro users but needs a test pass
