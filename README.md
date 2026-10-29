# Genesis — AI-Powered HighLevel App Builder

Describe an app in plain English. Genesis streams a working Vue 3 app from Claude, shows it live in a sandboxed preview wired to **real HighLevel data** (contacts, conversations, calendars), and lets you edit, version, diff and restore it.

- **Live app (Firebase Hosting):** <https://genesis-appbuilder.web.app> (sign up with any email, then *Connect HighLevel*)
- **API base URL:** <https://genesis-api-six.vercel.app/api> (health: `/api/health`). This is the same Express app as the `api` Cloud Function, hosted on Vercel because Cloud Functions need the Blaze plan (see Deployment notes).
- **Loom walkthrough:** <https://www.loom.com/share/d7cc46fb2f8647b8aaa22e84079b1094>

## Reviewer quick start (about 5 minutes)

Prereqs: **Node 22** and **Java 11+** (for the Firebase emulators: `brew install openjdk` on macOS).

```bash
npm i -g firebase-tools
cp .env.example .env     # paste HL_CLIENT_SECRET + LLM_API_KEY (sent separately); the rest is pre-filled
npm run install:all
npm run setup
npm run dev              # open http://localhost:3000
```

Locally, Auth + Firestore run in the Firebase emulators, so no Firebase account or login is needed. Without the two keys the app still runs, but HighLevel connect and AI generation are disabled; use the live link for those.

---

## HighLevel setup

1. **Create a developer account and app.** Go to <https://marketplace.gohighlevel.com> → *My Apps* → *Create App*. Choose type **Private**, distribution **Sub-account**.
2. **Add scopes** (*Advanced settings → Auth*): `contacts.readonly contacts.write conversations.readonly conversations.write conversations/message.readonly conversations/message.write calendars.readonly calendars/events.readonly locations.readonly`.
3. **Add redirect URIs:**
   - `http://localhost:3000/oauth/callback` (local)
   - `https://<site>.web.app/oauth/callback` (production)

   HighLevel rejects URIs containing the word "highlevel", so pick a hosting site name without it.
4. **Create a client key** (*Auth → Client keys*). Copy the Client ID and Secret into `.env` as `HL_CLIENT_ID` / `HL_CLIENT_SECRET`.
5. **Set the version ID.** While the app is in *Draft*, the install URL needs it. Copy it from the app URL into `HL_VERSION_ID`.
6. **Set up a sandbox account.** Agency view → *Sub-accounts → Create* a test sub-account, and add a few contacts and a calendar with appointments. Click **Connect HighLevel** in Genesis and pick that sub-account on the HighLevel chooser.

The authorize URL is `https://marketplace.gohighlevel.com/v2/oauth/chooselocation`. Tokens are location-scoped.

## Local setup (Firebase emulators)

Prereqs: Node 22, Java 11+ (`brew install openjdk`), Firebase CLI (`npm i -g firebase-tools`).

```bash
cp .env.example .env          # fill in Firebase web config, HL client id/secret, Anthropic key
npm run install:all
npm run setup                 # generates functions/.env, functions/.secret.local, frontend/.env.local
npm run dev                   # Auth + Firestore + Functions emulators, TS watcher, Vite on :3000
```

Open <http://localhost:3000>. Emulator UI: <http://127.0.0.1:4001>. No `firebase login` is needed for local dev.

`npm run dev` wraps `firebase emulators:start --only auth,firestore,functions` (with `--import/--export-on-exit .emulator-data`, so users and projects survive restarts), a `tsc --watch` for functions, and Vite. To run the pieces by hand:

```bash
npm --prefix functions run build
firebase emulators:start --only auth,firestore,functions --project highlevel-app-builder-7c1d1
npm --prefix frontend run dev
```

In the HighLevel Marketplace app settings, add the redirect URI `http://localhost:3000/oauth/callback` (and the production one below).

| Command | What it does |
| --- | --- |
| `npm test` | Backend (51) + frontend (6) unit tests |
| `npm run test:rules` | Firestore security-rules tests (needs the emulator running) |
| `npm run typecheck` / `npm run build` | Strict TS for both packages / production build |

### Choosing an AI provider (free options included)

Set `LLM_PROVIDER` in `.env`, then run `npm run setup`:

| Provider | Cost | Key | Notes |
| --- | --- | --- | --- |
| `ollama` | Free, local | none | `ollama create genesis-qwen -f scripts/ollama.Modelfile`, then `LLM_MODEL=genesis-qwen`. Local dev only. |
| `gemini` | Free tier | `LLM_API_KEY` from aistudio.google.com/apikey | Default model `gemini-3.6-flash`; works in production |
| `groq` / `openrouter` | Free tiers | `LLM_API_KEY` | OpenAI-compatible |
| `anthropic` | Paid | `ANTHROPIC_API_KEY` | Best output quality |

## Features

| Area | Implementation |
| --- | --- |
| Auth | Firebase Auth (email/password); every API call verifies the ID token |
| Generation | Claude via `messages.stream`, relayed as **SSE** with live per-file streaming into Monaco |
| Iterative refinement | Each prompt sends current files + bounded chat history; the model emits only changed files |
| Cancel | Client abort + server cancel flag; partial output is persisted and snapshotted |
| HighLevel | OAuth 2.0 (location), encrypted tokens, proactive refresh, allow-listed API proxy |
| Preview | Sandboxed iframe; the generated app calls `HL.contacts.list()` etc. through a postMessage bridge |
| Projects | CRUD with soft delete, cursor pagination |
| Files | Tree, tabs, Monaco editing, ⌘S save, rename/delete |
| Versioning | Snapshot per generation + manual checkpoints; non-destructive restore; side-by-side diff per generation |
| Limits | Firestore-backed rate limits (generate 20/h, proxy 240/min, API 300/min), file/project size caps |

## Architecture

```
Browser (Vue 3 + shadcn-vue)
  ├─ Firebase Auth ── ID token ──┐
  ├─ fetch + SSE ────────────────┼─► Cloud Function `api` (Express, v2)
  └─ iframe sandbox ─postMessage─┘      ├─ Anthropic (stream)
       (generated app, no network)      ├─ HighLevel API (services.leadconnectorhq.com)
                                        └─ Firestore (Admin SDK)
HighLevel ── redirect ─► `oauthCallback` function ─► Firestore (encrypted tokens)
```

Firestore layout: `users/{uid}/projects/{pid}/{files,snapshots,messages,generations}`; server-only `hlConnections`, `oauthStates`, `rateLimits`.

### SSE protocol (`POST /api/projects/:id/generate`)

`meta` (generationId) → `status` (stage) → `token` (plan/summary text) → `file_start` / `file_delta` / `file_end` / `file_delete` → `done` (status, snapshotId, changes) | `error` (code, recoverable, partial). A comment heartbeat every 15s keeps proxies from closing the stream. If the connection drops, the client reconciles from the persisted generation doc.

### Architecture decisions

1. **Tag protocol instead of JSON for LLM output** (`<file path="…">…</file>`). It parses incrementally, so files stream into the editor token by token, and a truncated response still yields usable complete files.
2. **All writes go through Functions; clients only read.** Validation, quotas, snapshots and HL scoping live in one place, and the rules stay trivially auditable.
3. **Generated code never sees tokens or the network.** The iframe has an opaque origin (`sandbox="allow-scripts"`, no `allow-same-origin`), CSP `connect-src 'none'`, and a postMessage bridge to an **allow-listed** proxy that injects `locationId` and the `Version` header server-side.
4. **OAuth state is a random nonce, stored only as SHA-256, single-use (transactional), with a 10-minute TTL.** This prevents CSRF and replay.
5. **Tokens are encrypted with AES-256-GCM at rest.** The key is a Secret Manager secret. Refresh runs 5 minutes before expiry, with in-process dedupe and a Firestore lease so concurrent instances don't burn the rotating refresh token.
6. **Snapshot on every generation, plus a backup before every restore.** Restore can never lose work.
7. **A per-project generation lock and a cancel flag in Firestore.** These work across function instances, unlike in-memory state.
8. **A runtime of classic scripts (Vue global + Tailwind CDN) instead of a bundler.** There's no build step in the preview, so it renders instantly, and the LLM targets a small, well-documented surface.
9. **Context budgeting.** Files are truncated in priority order to a character budget, and history is bounded, so costs and latency stay predictable as projects grow.
10. **Express inside one v2 function** (540s timeout, concurrency 40). This suits long SSE streams, and the cold-start surface stays small.

### What I would improve

1. Move generation to a queue (Cloud Tasks) and stream from Firestore, so it survives client and instance loss.
2. Add a Babel/esbuild-wasm step in the preview to allow ES modules and SFCs.
3. Handle HL webhooks (contact created/updated) by pushing to the preview instead of polling `onChange`.
4. Support multiple HL locations per user and agency-level installs.
5. Add Playwright E2E tests against the emulators, and an eval suite for prompt regressions.

## Deployment notes

**Firebase project setup (one-time):**

1. Create a Firebase project.
2. Enable **Authentication → Email/Password**.
3. Create a **Firestore** database.
4. Add a web app and copy its config into the `VITE_FIREBASE_*` vars.
5. Add your hosting domain to *Auth → Authorized domains*.
6. Set the project ID in `.firebaserc`.

**CI/CD:** none yet. Deploys are manual through the scripts below. A GitHub Actions pipeline (typecheck → tests → rules tests on emulators → `deploy:free`) would be the next step.

**Manual steps:**

- Add the production redirect URI in the HighLevel app.
- Rotate `TOKEN_ENCRYPTION_KEY` only together with re-connecting HighLevel, because existing tokens become unreadable.
- Firestore TTL policies (`oauthStates`, `rateLimits`) need billing, so on Spark the expired documents are cleaned up lazily.

### Option A: free, no billing card (Firebase Spark + Vercel Hobby)

Firebase Spark serves Hosting, Auth and Firestore. The same Express API runs on Vercel through [functions/api/index.ts](functions/api/index.ts), authenticating to Firestore with a service account.

```bash
firebase login
npx vercel login          # free Hobby account, no card
npm run deploy:free       # uploads env to Vercel (values hidden), deploys API, builds SPA, deploys Hosting + rules
```

HighLevel still redirects to `https://<site>.web.app/oauth/callback`. That SPA route forwards the query to the API, which validates the state and exchanges the code.

### Option B: everything on Firebase (Blaze plan)

Add the Hosting rewrites `/api/**` → function `api` and `/oauth/callback` → function `oauthCallback` back to `firebase.json` (Spark can't deploy rewrites to functions), then:

The project needs the Blaze plan, which Functions and Secret Manager require.

```bash
firebase login
firebase use <project-id>
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set HL_CLIENT_SECRET
firebase functions:secrets:set TOKEN_ENCRYPTION_KEY   # use the value from .env
```

Set the production values in `functions/.env.<project-id>`:

```
HL_CLIENT_ID=…
HL_REDIRECT_URI=https://<project-id>.web.app/oauth/callback
FRONTEND_URL=https://<project-id>.web.app
ALLOWED_ORIGINS=https://<project-id>.web.app,https://<project-id>.firebaseapp.com
```

Build `frontend/.env.production` with the `VITE_FIREBASE_*` values (and **without** `VITE_USE_EMULATORS`), then run `npm run deploy`.

Add `https://<project-id>.web.app/oauth/callback` to the HL app's redirect URIs. Required scopes: `contacts.readonly contacts.write conversations.readonly conversations.write conversations/message.readonly conversations/message.write calendars.readonly calendars/events.readonly locations.readonly`.

## Security notes

- No secrets are committed. `.env.example` contains only public config (Firebase web config and HL client ID are public by design); secrets are delivered separately.
- CORS uses an allow-list (`ALLOWED_ORIGINS`), and security headers are set on Hosting and on API responses.
- Errors returned to clients are normalized; provider payloads are only logged.
- Inputs are validated with zod. File paths are restricted to a safe extension set with no traversal, and size caps apply.
