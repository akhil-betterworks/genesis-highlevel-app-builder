# Genesis — AI-Powered HighLevel App Builder

Describe an app in plain English. Genesis streams a working Vue 3 app from Claude, shows it live in a sandboxed preview wired to **real HighLevel data** (contacts, conversations, calendars), and lets you edit, version, diff and restore it.

- **Live app:** <https://genesis-appbuilder.web.app> (sign up with any email, then *Connect HighLevel*)
- **API (Vercel):** <https://genesis-api-six.vercel.app/api/health>
- **Loom walkthrough:** `<loom link>`

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

## Quick start (local, everything from the terminal)

Prereqs: Node 22, Java 11+ (`brew install openjdk`), Firebase CLI (`npm i -g firebase-tools`).

```bash
cp .env.example .env          # fill in Firebase web config, HL client id/secret, Anthropic key
npm run install:all
npm run setup                 # generates functions/.env, functions/.secret.local, frontend/.env.local
npm run dev                   # Auth + Firestore + Functions emulators, TS watcher, Vite on :3000
```

Open <http://localhost:3000>. Emulator UI: <http://127.0.0.1:4001>. No `firebase login` is needed for local dev.

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

### Key decisions

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

### What I'd improve with more time

1. Move generation to a queue (Cloud Tasks) and stream from Firestore, so it survives client and instance loss.
2. Add a Babel/esbuild-wasm step in the preview to allow ES modules and SFCs.
3. Handle HL webhooks (contact created/updated) by pushing to the preview instead of polling `onChange`.
4. Support multiple HL locations per user and agency-level installs.
5. Add Playwright E2E tests against the emulators, and an eval suite for prompt regressions.

## Deployment

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

- **Rotate the HighLevel client secret.** An earlier commit of `.env.example` contained real credentials. The current file is scrubbed, but git history still contains the old values.
- CORS uses an allow-list (`ALLOWED_ORIGINS`), and security headers are set on Hosting and on API responses.
- Errors returned to clients are normalized; provider payloads are only logged.
- Inputs are validated with zod. File paths are restricted to a safe extension set with no traversal, and size caps apply.
