#!/usr/bin/env bash
# Free deployment (no billing card needed):
#   - Firebase Spark: Hosting (SPA), Auth, Firestore rules/indexes
#   - Vercel Hobby:   the Express API (functions/), incl. SSE generation and HighLevel OAuth
# Prereqs (one time): `firebase login` and `npx vercel login`.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_ID=highlevel-app-builder-7c1d1
SITE=genesis-appbuilder
SITE_URL="https://$SITE.web.app"
VERCEL_PROJECT=genesis-api
VERCEL="npx --yes vercel@latest"

env_get() { grep -E "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//'; }

$VERCEL whoami >/dev/null 2>&1 || { echo "Run: npx vercel login"; exit 1; }

echo "▸ Building API"
(cd functions && npm run build >/dev/null)

echo "▸ Linking Vercel project ($VERCEL_PROJECT)"
(cd functions && $VERCEL link --yes --project "$VERCEL_PROJECT" >/dev/null)

set_env() { # name value — values are piped, never echoed
  [[ -z "$2" ]] && return 0
  (cd functions && $VERCEL env rm "$1" production --yes >/dev/null 2>&1 || true)
  (cd functions && printf '%s' "$2" | $VERCEL env add "$1" production >/dev/null)
  echo "  ✓ $1"
}

echo "▸ Uploading environment (values hidden)"
set_env FIREBASE_PROJECT_ID "$PROJECT_ID"
set_env FIREBASE_CLIENT_EMAIL "$(env_get FIREBASE_CLIENT_EMAIL .env)"
set_env FIREBASE_PRIVATE_KEY "$(env_get FIREBASE_PRIVATE_KEY .env)"
set_env HL_CLIENT_ID "$(env_get HL_CLIENT_ID functions/.env)"
set_env HL_VERSION_ID "$(env_get HL_VERSION_ID functions/.env)"
set_env HL_REDIRECT_URI "$SITE_URL/oauth/callback"
set_env FRONTEND_URL "$SITE_URL"
set_env ALLOWED_ORIGINS "$SITE_URL,https://$SITE.firebaseapp.com"
set_env LLM_PROVIDER "$(env_get LLM_PROVIDER .env)"
set_env LLM_MODEL "$(env_get LLM_MODEL .env)"
set_env LLM_MAX_TOKENS "$(env_get LLM_MAX_TOKENS .env)"
set_env LLM_API_KEY "$(env_get LLM_API_KEY functions/.secret.local)"
set_env ANTHROPIC_API_KEY "$(env_get ANTHROPIC_API_KEY functions/.secret.local)"
set_env HL_CLIENT_SECRET "$(env_get HL_CLIENT_SECRET functions/.secret.local)"
set_env TOKEN_ENCRYPTION_KEY "$(env_get TOKEN_ENCRYPTION_KEY functions/.secret.local)"

echo "▸ Deploying API to Vercel"
API_URL=$(cd functions && $VERCEL deploy --prod --yes 2>/dev/null | tail -1)
# Use the stable production alias rather than the per-deployment URL.
API_URL="${API_URL:-https://genesis-api-six.vercel.app}"
for i in $(seq 1 20); do curl -sf -m 10 "$API_URL/api/health" >/dev/null && break; sleep 3; done
curl -sf -m 10 "$API_URL/api/health" >/dev/null || { echo "API health check failed at $API_URL"; exit 1; }
echo "  ✓ $API_URL/api/health"

echo "▸ Building frontend (API → $API_URL/api)"
(cd frontend && VITE_API_BASE="$API_URL/api" npm run build >/dev/null)

echo "▸ Deploying Hosting + Firestore rules/indexes"
firebase deploy --only hosting,firestore --project "$PROJECT_ID" --non-interactive 2>&1 | grep -E "✔|Error|Hosting URL" || true

echo
echo "✅ Live: $SITE_URL   (API: $API_URL)"
