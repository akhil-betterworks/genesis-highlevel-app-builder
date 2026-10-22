# Firebase Setup Guide

Follow these steps to create and configure your Firebase project.

## Step 1: Create Firebase Project

### Web Dashboard Method (Recommended)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com
   - Sign in with your Google account

2. **Create New Project**
   - Click "Add project"
   - Project name: `highlevel-app-builder`
   - Click "Create project"
   - Wait for creation (2-3 minutes)

3. **Get Web App Config**
   - In Firebase Console, click the gear icon (Settings)
   - Select "Project Settings"
   - Scroll to "Your apps" section
   - Under Web Apps, click the `</>` icon
   - Copy the Firebase config object

Your config will look like:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDxxxxx...",
  authDomain: "highlevel-app-builder.firebaseapp.com",
  projectId: "highlevel-app-builder",
  storageBucket: "highlevel-app-builder.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxx"
};
```

## Step 2: Enable Firebase Services

In Firebase Console, go to each section and enable:

### Authentication
1. Left sidebar → "Authentication"
2. Click "Get started"
3. Select "Email/Password"
4. Enable it
5. Save

### Firestore Database
1. Left sidebar → "Firestore Database"
2. Click "Create database"
3. Start in **Test mode** (for development)
4. Region: `us-central1`
5. Click "Create"

### Cloud Storage (Optional)
1. Left sidebar → "Storage"
2. Click "Get started"
3. Start in **Test mode**
4. Region: `us-central1`

## Step 3: Get Service Account Key

For Cloud Functions to work locally, you need service account credentials.

1. **Generate Service Account Key**
   - Project Settings → "Service Accounts"
   - Click "Generate a new private key"
   - Save the JSON file (keep it safe!)

2. **Extract Credentials**
   - Open the JSON file
   - Copy these values:
     - `project_id`
     - `private_key` (the entire key including `-----BEGIN PRIVATE KEY-----`)
     - `client_email`

## Step 4: Update .env File

Now update your `.env` file with real credentials:

```bash
nano .env
```

Replace these values with your Firebase config:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyD... (from firebaseConfig.apiKey)
VITE_FIREBASE_AUTH_DOMAIN=highlevel-app-builder.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=highlevel-app-builder (your project ID)
VITE_FIREBASE_STORAGE_BUCKET=highlevel-app-builder.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012 (from firebaseConfig.messagingSenderId)
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123def456 (from firebaseConfig.appId)

# HighLevel OAuth (Already provided)
HIGHLEVEL_CLIENT_ID=6ad9edaddf6c2500a18f558c-mvjfqiej
HIGHLEVEL_CLIENT_SECRET=8ba35eb8-c900-49e1-b256-2f66e27850fe
HIGHLEVEL_OAUTH_REDIRECT_URI=http://localhost:5001/highlevel-app-builder/us-central1/oauthCallback

# LLM Provider - ADD YOUR ANTHROPIC KEY
ANTHROPIC_API_KEY=sk-ant-v4-... (get from https://console.anthropic.com)

# Firebase Admin (from service account JSON)
FIREBASE_PROJECT_ID=highlevel-app-builder
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@highlevel-app-builder.iam.gserviceaccount.com

# App Configuration
VITE_API_BASE_URL=http://localhost:5001/highlevel-app-builder/us-central1
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## Step 5: Setup Firebase CLI Locally

1. **Login to Firebase**
   ```bash
   firebase login
   # Opens browser, sign in with same Google account
   ```

2. **Initialize Firebase Project**
   ```bash
   cd /Users/akhilsharama/Desktop/better
   firebase init
   ```

   When prompted:
   - Select "Firestore", "Functions", "Hosting"
   - Use existing project: `highlevel-app-builder`
   - Firestore: Use defaults
   - Functions: Use existing config (press Enter)
   - Hosting: Use defaults
   - Set .firebaserc: Yes

3. **Verify Setup**
   ```bash
   firebase use
   # Should show: highlevel-app-builder
   ```

## Step 6: Install Dependencies

```bash
cd /Users/akhilsharama/Desktop/better

# Install all dependencies
npm run install-all

# Verify installations
cd frontend && npm list vue
cd ../functions && npm list firebase-admin
```

Expected output should show versions installed.

## Step 7: Start Firebase Emulator

```bash
firebase emulators:start
```

You should see:
```
✔  Emulator Hub has started
✔  Auth Emulator running on http://localhost:9099
✔  Firestore Emulator running on http://localhost:8080
✔  Functions Emulator running on http://localhost:5001
```

**Keep this terminal open!**

## Step 8: Start Frontend (New Terminal)

Open a new terminal tab/window:

```bash
cd /Users/akhilsharama/Desktop/better/frontend
npm run dev
```

You should see:
```
Local:   http://localhost:3000/
```

Visit http://localhost:3000 in your browser!

## Testing the Setup

### Test 1: Sign Up
1. Click "Sign Up"
2. Fill in:
   - Email: `test@example.com`
   - Password: `password123`
   - Confirm Password: `password123`
3. Click "Sign Up"
4. Should redirect to Dashboard

### Test 2: Create Project
1. Click "New Project" on Dashboard
2. Fill in:
   - Name: `Test Project`
   - Description: `Testing the builder`
3. Click "Create"
4. Should see project on Dashboard

### Test 3: View Project
1. Click the project
2. Should open ProjectEditor
3. Chat panel on left
4. Editor on middle (empty initially)
5. Preview on right

### Test 4: Verify Firestore
1. In another browser, open: http://localhost:4000
2. Go to "Firestore Emulator"
3. You should see:
   - `users` collection
   - Your user document
   - `projects` subcollection
   - Your test project

## Troubleshooting Setup

### "Firebase credentials not found"
```bash
firebase login
firebase init
```

### "Port 5001 already in use"
```bash
lsof -i :5001
kill -9 <PID>
firebase emulators:start
```

### "Cannot find module firebase"
```bash
cd frontend && npm install
cd ../functions && npm install
```

### ".env not loading"
- Restart dev server: `npm run dev`
- Check .env file exists in root
- Verify no spaces in variable names

### Emulator shows error on startup
```bash
rm -rf firebase-emulator-data/
firebase emulators:start --import firebase-emulator-data
```

## Verification Checklist

- [ ] Firebase project created at console.firebase.google.com
- [ ] Authentication enabled (Email/Password)
- [ ] Firestore Database created in Test mode
- [ ] Service account key downloaded
- [ ] .env file updated with all credentials
- [ ] firebase login successful
- [ ] firebase init completed
- [ ] npm run install-all succeeded
- [ ] Emulator starts without errors
- [ ] Frontend loads at http://localhost:3000
- [ ] Can sign up for account
- [ ] Can create project
- [ ] Data visible in Firestore Emulator

## Next Steps

Once setup is complete:

1. **Test the full flow** (see TESTING_CHECKLIST below)
2. **Review code** (check frontend/functions structure)
3. **Make changes** (try modifying components)
4. **Deploy** (follow DEPLOYMENT_CHECKLIST.md)

---

## Quick Reference Commands

```bash
# Start development
firebase emulators:start
# In new terminal:
cd frontend && npm run dev

# Stop everything
Ctrl+C

# Check logs
firebase functions:log

# View Firestore
http://localhost:4000

# View emulator UIs
http://localhost:4000  # Firestore Emulator
http://localhost:9099  # Auth Emulator
http://localhost:5001  # Functions Emulator

# Clear emulator data
rm -rf firebase-emulator-data/

# Rebuild functions
cd functions && npm run build
```

---

**Stuck?** See TROUBLESHOOTING.md for more solutions.
