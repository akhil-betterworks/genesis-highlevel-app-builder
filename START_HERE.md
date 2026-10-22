# 🚀 START HERE - Complete Startup Guide

Your environment is almost ready! Follow these final steps to start development.

## ✅ What's Done

- [x] `.env` file updated with all credentials
- [x] Firebase project configured
- [x] Anthropic API key added
- [x] All dependencies installed
- [x] Firebase CLI ready

## 📋 Final Steps (Do These Now)

### Step 1: Login to Firebase (One-Time)
```bash
cd /Users/akhilsharama/Desktop/better
firebase login
```

When prompted:
1. Browser opens
2. Sign in with Google account (same one used for Firebase project)
3. Click "Allow"
4. Return to terminal (should show "Success")

### Step 2: Set Firebase Project
```bash
firebase use highlevel-app-builder-7c1d1
```

Expected output:
```
Now using project highlevel-app-builder-7c1d1
```

### Step 3: Start Firebase Emulator

**Terminal 1 - Keep this open:**
```bash
cd /Users/akhilsharama/Desktop/better
firebase emulators:start
```

Wait for all to show as ready:
```
✔  Emulator Hub has started at http://localhost:4000
✔  Auth Emulator running on http://localhost:9099
✔  Firestore Emulator running on http://localhost:8080
✔  Functions Emulator running on http://localhost:5001
```

### Step 4: Start Frontend Dev Server

**Terminal 2 - After emulator starts:**
```bash
cd /Users/akhilsharama/Desktop/better/frontend
npm run dev
```

You should see:
```
Local:   http://localhost:3000
```

### Step 5: Open in Browser

Visit: **http://localhost:3000**

You should see the HighLevel App Builder landing page! ✨

---

## 🎯 Complete Test Flow (5 Minutes)

Once everything is running, test these steps:

### Test 1: Sign Up
1. Click "Sign Up"
2. Enter:
   - Email: `testuser@example.com`
   - Password: `Password123!`
   - Confirm: `Password123!`
3. Click "Sign Up"
4. **Expected**: Redirect to Dashboard ✅

### Test 2: Create Project
1. Click "New Project"
2. Enter:
   - Name: `My First Project`
   - Description: `Testing the AI app builder`
3. Click "Create"
4. **Expected**: Project appears in list ✅

### Test 3: Open Project
1. Click on project
2. **Expected**: See 3 panels (Chat, Code Editor, Preview) ✅

### Test 4: Generate Code
1. In chat panel, type: `Create a Vue component that shows "Hello World"`
2. Click "Generate"
3. **Expected**: Code streams into editor in real-time ✨

### Test 5: Verify Data
1. Open: http://localhost:4000 (Firestore Emulator)
2. Navigate: `users` → `[your-uid]` → `projects`
3. **Expected**: Your project data is there ✅

---

## 🌐 All Running URLs

| Service | URL |
|---------|-----|
| **App** | http://localhost:3000 |
| **Firestore** | http://localhost:4000 |
| **Auth** | http://localhost:9099 |
| **Functions** | http://localhost:5001 |

---

## 🛠️ Stopping Everything

### To Stop Emulator
Press `Ctrl+C` in Terminal 1

### To Stop Dev Server
Press `Ctrl+C` in Terminal 2

### To Clear Emulator Data
```bash
rm -rf firebase-emulator-data/
# Then restart emulator
```

---

## ⚡ Quick Commands Reference

```bash
# Start emulator
firebase emulators:start

# Start frontend (new terminal)
cd frontend && npm run dev

# Build frontend (when deploying)
cd frontend && npm run build

# Deploy everything to Firebase (when ready)
firebase deploy

# View function logs
firebase functions:log

# Clean emulator data
rm -rf firebase-emulator-data/
```

---

## 📊 Your Credentials Summary

```
Firebase Project: highlevel-app-builder-7c1d1
Anthropic API: ✅ Configured
HighLevel OAuth: ✅ Ready
Service Account: ✅ Configured
```

---

## 🎬 What Happens Next

### After Tests Pass
1. **Explore the code:**
   - `frontend/src/pages/` - Vue components
   - `functions/src/routes/` - Backend logic
   - Edit something, see hot reload!

2. **Deploy when ready:**
   - Run: `firebase deploy`
   - Get live URLs

3. **Record demo video:**
   - Walk through all features
   - Share Loom link

4. **Submit for review**

---

## ⚠️ If Something Goes Wrong

### "Firebase not authenticated"
```bash
firebase login
firebase use highlevel-app-builder-7c1d1
```

### "Port 5001 already in use"
```bash
lsof -i :5001 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### "Module not found"
```bash
npm run install-all --legacy-peer-deps
```

### "Emulator won't start"
```bash
rm -rf firebase-emulator-data/
firebase emulators:start
```

### ".env not loading"
- Make sure you saved the file
- Restart dev server after saving

---

## 📚 Need Help?

- **Setup issues?** → FIREBASE_SETUP.md
- **Can't run tests?** → LOCAL_TESTING_GUIDE.md
- **Code questions?** → PROJECT_SUMMARY.md
- **Something broke?** → TROUBLESHOOTING.md

---

## 🎉 You're Ready!

Your development environment is fully configured with:
- ✅ Vue 3 frontend
- ✅ Firebase backend
- ✅ Claude AI integration
- ✅ HighLevel OAuth setup
- ✅ All credentials loaded

**Next step:** Run the 4 commands above to start developing!

---

**Estimated Time to Working App**: 5 minutes ⏱️

**Happy Coding!** 🚀

