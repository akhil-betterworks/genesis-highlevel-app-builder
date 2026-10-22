# Local Testing Guide

Complete walkthrough for testing the HighLevel App Builder locally.

## Prerequisites

✅ Firebase CLI installed (done)
✅ Node.js 18+ installed
✅ Project files in `/Users/akhilsharama/Desktop/better/`
⏳ Firebase project created with credentials in .env

## Part 1: Manual Setup (On Your Machine)

### 1A. Create Firebase Project (Browser)

1. Open: https://console.firebase.google.com
2. Click "Add Project"
3. Enter: `highlevel-app-builder`
4. Click "Create"
5. Wait 2-3 minutes

### 1B. Enable Services

**Authentication:**
- Left menu → "Authentication"
- Click "Get started"
- Select "Email/Password" → Enable → Save

**Firestore Database:**
- Left menu → "Firestore Database"
- Click "Create database"
- Start in "Test mode"
- Region: "us-central1"
- Create

**Get Web Config:**
- Click gear icon (Settings)
- "Project Settings"
- Scroll to "Your apps"
- Click `</>` icon to get config

### 1C. Get Service Account Key

- Project Settings → "Service Accounts" tab
- "Generate new private key"
- Save the JSON file

### 1D. Update .env File

Edit `/Users/akhilsharama/Desktop/better/.env` with values from:

```env
# From Firebase Web Config:
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=highlevel-app-builder.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=highlevel-app-builder
VITE_FIREBASE_STORAGE_BUCKET=highlevel-app-builder.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# HighLevel (Already filled):
HIGHLEVEL_CLIENT_ID=6ad9edaddf6c2500a18f558c-mvjfqiej
HIGHLEVEL_CLIENT_SECRET=8ba35eb8-c900-49e1-b256-2f66e27850fe

# From Anthropic Console (https://console.anthropic.com):
ANTHROPIC_API_KEY=sk-ant-v4-...

# From Service Account JSON:
FIREBASE_PROJECT_ID=highlevel-app-builder
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-@...iam.gserviceaccount.com

# App URLs (leave as-is for local dev):
VITE_API_BASE_URL=http://localhost:5001/highlevel-app-builder/us-central1
FRONTEND_URL=http://localhost:3000
```

## Part 2: Local Installation & Testing

After updating `.env`, run these commands on your machine:

```bash
cd /Users/akhilsharama/Desktop/better

# 1. Login to Firebase
firebase login

# 2. Initialize Firebase locally
firebase init

# 3. Install all dependencies
npm run install-all

# 4. Verify installations
npm list --depth=0
```

## Part 3: Start Development Environment

### Terminal 1: Firebase Emulator
```bash
cd /Users/akhilsharama/Desktop/better
firebase emulators:start
```

Expected output:
```
✔  Emulator Hub has started at http://localhost:4000
✔  Auth Emulator running on http://localhost:9099
✔  Firestore Emulator running on http://localhost:8080
✔  Functions Emulator running on http://localhost:5001
```

### Terminal 2: Frontend Dev Server (after emulator starts)
```bash
cd /Users/akhilsharama/Desktop/better/frontend
npm run dev
```

Expected output:
```
  Local:   http://localhost:3000/
  Press 'o' to open in browser
```

## Part 4: Test Scenarios

### Test 1: Home Page
**What to do:**
1. Visit http://localhost:3000
2. Should see landing page with "HighLevel Builder" heading
3. See "Sign In" and "Sign Up" buttons

**Expected result:** ✅ Landing page loads

---

### Test 2: Sign Up
**What to do:**
1. Click "Sign Up"
2. Enter:
   - Email: `testuser@example.com`
   - Password: `TestPassword123!`
   - Confirm: `TestPassword123!`
3. Click "Sign Up" button

**Expected result:** 
- ✅ Redirects to `/dashboard`
- ✅ User created in Auth Emulator (http://localhost:9099)
- ✅ Profile created in Firestore

**How to verify:**
- Open http://localhost:9099 in new tab
- Should see user listed

---

### Test 3: Dashboard
**What to do:**
1. Should be on Dashboard page
2. See "Your Projects" section
3. See "New Project" button
4. See "HighLevel Account" section with "Not Connected" status

**Expected result:** ✅ Dashboard loads with all elements

---

### Test 4: Create Project
**What to do:**
1. Click "New Project" button
2. Enter:
   - Project Name: `Contact Manager`
   - Description: `A dashboard to view my HighLevel contacts`
3. Click "Create"

**Expected result:**
- ✅ Modal closes
- ✅ New project appears in list
- ✅ Can click project to open

**How to verify in Firestore:**
- Open http://localhost:4000
- Navigate: `users` → `[your-uid]` → `projects`
- Should see `Contact Manager` project

---

### Test 5: Open Project Editor
**What to do:**
1. Click on "Contact Manager" project
2. Should see Project Editor with 3 panels:
   - **Left:** Chat interface
   - **Middle:** Code editor (empty)
   - **Right:** Live preview (blank)

**Expected result:** ✅ Editor opens with all 3 panels

---

### Test 6: Send Generation Prompt
**What to do:**
1. In chat panel, type: `Create a simple Vue component that displays "Hello World"`
2. Click "Generate" button

**Expected result:**
- ✅ Button changes to "Generating..."
- ✅ Tokens start appearing in editor
- ✅ Code accumulates in real-time
- ✅ Generation completes with "Done" message

**Possible outcomes:**
- ✅ Best case: Full Vue component appears
- ⚠️ If API key wrong: "Unauthorized" error
- ⚠️ If API key valid but no quota: Rate limit error

---

### Test 7: View Generated Code
**What to do:**
1. After generation completes
2. Look at middle panel (code editor)
3. Should see Vue 3 component code

**Expected result:** ✅ Valid Vue 3 code visible in editor

---

### Test 8: Edit Code
**What to do:**
1. Click in code editor
2. Make small edit (add comment, change text)
3. Code should be editable

**Expected result:** ✅ Monaco editor responds to typing

---

### Test 9: Logout
**What to do:**
1. Click "Logout" button (top right)
2. Should redirect to login page

**Expected result:** ✅ Logged out and back at login screen

---

### Test 10: Login
**What to do:**
1. Enter email: `testuser@example.com`
2. Enter password: `TestPassword123!`
3. Click "Sign In"

**Expected result:** 
- ✅ Redirects to Dashboard
- ✅ Previous project still exists
- ✅ Session persists across page refreshes

---

## Part 5: Verify Backend

### Check Functions Logs
```bash
firebase functions:log
```

Should show:
- Generation requests
- Project operations
- No errors

### Check Firestore Data
Visit: http://localhost:4000

Navigate:
```
users/
  [your-uid]/
    email: "testuser@example.com"
    createdAt: timestamp
    projects/
      [project-id]/
        name: "Contact Manager"
        files/
          (generated files here)
```

### Check Auth Emulator
Visit: http://localhost:9099

Should show:
- Your test user account
- Email verified status
- Creation timestamp

---

## Part 6: Common Issues & Solutions

### Issue: "Cannot find module 'firebase'"
**Solution:**
```bash
cd frontend
npm install
cd ../functions
npm install
```

### Issue: "Port 5001 already in use"
**Solution:**
```bash
# Find process using port
lsof -i :5001

# Kill it
kill -9 [PID]

# Try again
firebase emulators:start
```

### Issue: "ANTHROPIC_API_KEY is not defined"
**Solution:**
1. Check .env file exists
2. Verify ANTHROPIC_API_KEY line is there
3. Restart dev server: `npm run dev`

### Issue: "Firestore permission denied"
**Solution:** This is expected in test mode and shouldn't happen. If it does:
1. Stop emulator: `Ctrl+C`
2. Delete data: `rm -rf firebase-emulator-data/`
3. Restart: `firebase emulators:start`

### Issue: Generation never starts
**Solution:** Check:
1. Is `.env` file filled with credentials?
2. Is Anthropic API key valid?
3. Check browser console (F12) for errors
4. Check terminal logs from emulator

---

## Testing Checklist

### Environment Setup
- [ ] Firebase project created
- [ ] Services enabled (Auth, Firestore)
- [ ] Service account key downloaded
- [ ] .env file updated with all credentials
- [ ] Dependencies installed (`npm run install-all`)

### Local Running
- [ ] Emulator starts without errors
- [ ] Frontend loads at http://localhost:3000
- [ ] Emulator UIs accessible (4000, 8080, 9099)

### Core Features
- [ ] Sign up creates user
- [ ] Login works
- [ ] Logout clears session
- [ ] Session persists on refresh
- [ ] Create project works
- [ ] Project appears in list
- [ ] Can open project editor
- [ ] All 3 panels visible (chat, editor, preview)

### Code Generation
- [ ] Chat input accepts text
- [ ] Generate button works
- [ ] Tokens stream to editor
- [ ] Generation completes
- [ ] Generated code is valid Vue 3

### Data Persistence
- [ ] Project appears in Firestore
- [ ] User profile created
- [ ] Files stored correctly
- [ ] Data persists after logout/login

---

## Performance Notes

| Action | Expected Time |
|--------|---|
| Page load | < 2s |
| Sign up | < 1s |
| Create project | < 1s |
| Open editor | < 500ms |
| Generation start | < 2s |
| Token stream | Real-time |
| Generation complete | 5-30s (depends on complexity) |

---

## Success Indicators

✅ **Setup is working correctly if:**

1. Emulator starts without errors
2. Frontend loads in browser
3. Can create user account
4. Can create project
5. Can open project editor
6. Can send generation prompt
7. Code appears in editor
8. Data visible in Firestore

---

## Next Steps

Once all tests pass:

1. **Explore the code:**
   - `frontend/src/pages/` - Vue pages
   - `frontend/src/services/` - API integration
   - `functions/src/routes/` - Backend logic

2. **Try modifications:**
   - Edit a component style
   - Change prompt instructions
   - Add new generation features

3. **Deploy to production:**
   - Follow DEPLOYMENT_CHECKLIST.md
   - Deploy to Firebase Hosting & Functions
   - Test live version

4. **Record Loom video:**
   - Walk through all features
   - Explain one architectural decision
   - Submit for review

---

**Estimated Time:** 30-45 minutes to complete all tests
**Difficulty:** Beginner friendly
**Support:** See TROUBLESHOOTING.md for help

Good luck! 🚀
