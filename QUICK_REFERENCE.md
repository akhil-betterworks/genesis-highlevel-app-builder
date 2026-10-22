# Quick Reference Card

**Fast lookup for common tasks**

## 📋 Setup Checklist (One-Time)

```bash
# 1. Get credentials
# - Firebase: https://console.firebase.google.com
# - Anthropic: https://console.anthropic.com
# - Update .env file

# 2. Install
firebase login
npm run install-all

# 3. Initialize Firebase
firebase init

# 4. Start (2 terminals)
Terminal 1: firebase emulators:start
Terminal 2: cd frontend && npm run dev

# 5. Visit http://localhost:3000
```

## 🔗 Important URLs (Development)

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Vue.js app |
| **Firestore** | http://localhost:8080 | Database viewer |
| **Auth** | http://localhost:9099 | Users & sessions |
| **Functions** | http://localhost:5001 | Backend API |
| **Hub** | http://localhost:4000 | Emulator dashboard |

## 🏗️ Project Structure

```
better/
├── frontend/          # Vue 3 SPA (port 3000)
│   └── src/
│       ├── pages/     # 6 page components
│       ├── services/  # Firebase, Auth, API
│       └── components/ # UI components
├── functions/         # Cloud Functions (port 5001)
│   └── src/
│       ├── routes/    # API endpoints
│       └── utils/     # Helpers
└── [docs]            # 11+ documentation files
```

## 📝 Common Commands

### Development
```bash
# Start emulator
firebase emulators:start

# Start frontend
cd frontend && npm run dev

# Type check
npm run type-check

# Stop everything
Ctrl+C
```

### Building
```bash
# Build frontend
cd frontend && npm run build

# Build functions
cd functions && npm run build
```

### Deployment
```bash
# Deploy all
firebase deploy

# Deploy only frontend
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions
```

### Testing
```bash
# See function logs
firebase functions:log

# Check emulator data
# Open http://localhost:4000
```

## 🔐 .env Variables Needed

| Variable | Where to Get | Example |
|----------|-------------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase Console | `AIzaSy...` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Console | `highlevel-app-builder` |
| `ANTHROPIC_API_KEY` | Anthropic Console | `sk-ant-...` |
| `HIGHLEVEL_CLIENT_ID` | Provided ✅ | `6ad9edaddf6c2500a18f558c-mvjfqiej` |
| `HIGHLEVEL_CLIENT_SECRET` | Provided ✅ | `8ba35eb8-c900-49e1-b256-2f66e27850fe` |
| `FIREBASE_PRIVATE_KEY` | Service Account JSON | Copy exactly |

## 🧪 Test Scenarios (5 min)

### Quick Test
1. Sign up: `test@example.com` / `password123`
2. Create project: `Test Project`
3. Click project → open editor
4. Send prompt: `"Show hello world"`
5. See code appear ✅

## 🐛 Quick Fixes

| Problem | Fix |
|---------|-----|
| Port 5001 in use | `lsof -i :5001` then `kill -9 PID` |
| Module not found | `npm run install-all` |
| .env not working | Restart dev server |
| Emulator won't start | `rm -rf firebase-emulator-data/` |
| Firestore empty | Check data at http://localhost:8080 |

## 📚 Documentation Map

| Document | Use When |
|----------|----------|
| README.md | Need project overview |
| FIREBASE_SETUP.md | Setting up Firebase |
| LOCAL_TESTING_GUIDE.md | Testing locally |
| SETUP_GUIDE.md | Detailed setup instructions |
| API_INTEGRATION.md | Understanding APIs |
| DEPLOYMENT_CHECKLIST.md | Deploying to production |
| TROUBLESHOOTING.md | Something broke |
| CONTRIBUTING.md | Writing code |

## 🎯 First 30 Minutes

1. **Create Firebase project** (5 min)
   - https://console.firebase.google.com
   - Enable Auth, Firestore

2. **Get credentials** (5 min)
   - Copy web config from Firebase
   - Download service account key
   - Get Anthropic API key from console.anthropic.com

3. **Update .env** (2 min)
   - Edit `/Users/akhilsharama/Desktop/better/.env`
   - Paste credentials

4. **Install & start** (10 min)
   ```bash
   firebase login
   npm run install-all
   firebase emulators:start
   # New terminal:
   cd frontend && npm run dev
   ```

5. **Test** (3 min)
   - Visit http://localhost:3000
   - Sign up
   - Create project
   - Done! ✅

## 🚀 Next Milestones

- [ ] Setup Firebase (see FIREBASE_SETUP.md)
- [ ] Test locally (see LOCAL_TESTING_GUIDE.md)
- [ ] Deploy (see DEPLOYMENT_CHECKLIST.md)
- [ ] Record Loom video
- [ ] Submit for review

## 💬 Need Help?

- **Setup issues?** → FIREBASE_SETUP.md
- **Testing issues?** → LOCAL_TESTING_GUIDE.md
- **Code issues?** → TROUBLESHOOTING.md
- **Architecture?** → PROJECT_SUMMARY.md
- **API details?** → API_INTEGRATION.md

---

**Print this card!** Bookmark it for quick reference during development.

Last Updated: 2024-01-15
