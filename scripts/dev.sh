#!/usr/bin/env bash
# One command local dev: builds functions, starts Auth/Firestore/Functions emulators + Vite.
set -euo pipefail
cd "$(dirname "$0")/.."

# Firestore emulator needs Java 11+; prefer Homebrew's OpenJDK if java isn't on PATH.
if ! java -version >/dev/null 2>&1; then
  for j in /opt/homebrew/opt/openjdk /usr/local/opt/openjdk; do
    [[ -x "$j/bin/java" ]] && export JAVA_HOME="$j" PATH="$j/bin:$PATH" && break
  done
fi
java -version >/dev/null 2>&1 || { echo "Java 11+ is required (brew install openjdk)"; exit 1; }

PROJECT_ID="$(grep -E '^VITE_FIREBASE_PROJECT_ID=' frontend/.env.local | cut -d= -f2)"
[[ -n "$PROJECT_ID" ]] || { echo "Run: npm run setup"; exit 1; }

(cd functions && npm run build)
(cd functions && npx tsc -p tsconfig.build.json --watch --preserveWatchOutput >/dev/null) &
WATCH_PID=$!
# Persist local users/projects across restarts (otherwise browsers hold dead sessions).
mkdir -p .emulator-data
IMPORT=()
[[ -f .emulator-data/firebase-export-metadata.json ]] && IMPORT=(--import=./.emulator-data)
npx firebase emulators:start --only auth,firestore,functions --project "$PROJECT_ID" \
  ${IMPORT[@]+"${IMPORT[@]}"} --export-on-exit=./.emulator-data &
EMU_PID=$!
trap 'kill $WATCH_PID $EMU_PID 2>/dev/null' EXIT INT TERM

until curl -sf "http://127.0.0.1:5001/$PROJECT_ID/us-central1/api/health" >/dev/null; do sleep 1; done
echo "✓ API ready — starting frontend on http://localhost:3000"
cd frontend && npm run dev
