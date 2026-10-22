#!/bin/bash

# HighLevel App Builder - Quick Start Script
# This script automates initial setup

set -e

echo "🚀 HighLevel App Builder - Quick Start"
echo "======================================"
echo ""

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm run install-all > /dev/null 2>&1

# Step 2: Check .env file
if [ ! -f .env ]; then
    echo "⚠️  .env file not found"
    echo "📋 Copying .env.example to .env"
    cp .env.example .env
    echo "✅ .env created (you need to fill in credentials)"
else
    echo "✅ .env file exists"
fi

# Step 3: Check Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo "⚠️  Firebase CLI not installed"
    echo "📝 Please run: npm install -g firebase-tools"
else
    echo "✅ Firebase CLI installed"
fi

# Step 4: Start Firebase emulator
echo ""
echo "🔥 Starting Firebase Emulator..."
echo "Press Ctrl+C to stop"
echo ""

firebase emulators:start &
EMULATOR_PID=$!

# Step 5: Start frontend dev server in background
sleep 2
echo ""
echo "⚡ Starting frontend dev server (in 3 seconds)..."
sleep 3

cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "======================================"
echo "✅ Development environment ready!"
echo "======================================"
echo ""
echo "Frontend:  http://localhost:3000"
echo "Firestore: http://localhost:4000"
echo "Auth:      http://localhost:9099"
echo "Functions: http://localhost:5001"
echo ""
echo "📚 Next steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Sign up for an account"
echo "3. Create a project"
echo "4. Try generating code with AI!"
echo ""
echo "Press Ctrl+C to stop everything"
echo ""

# Wait for processes
wait $EMULATOR_PID $FRONTEND_PID

