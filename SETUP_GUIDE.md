# Setup Guide

This guide walks through setting up the HighLevel AI App Builder from scratch.

## Step 1: Clone and Install

```bash
git clone <repo-url>
cd better
npm run install-all
```

## Step 2: Firebase Setup

### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Name: `highlevel-app-builder`
4. Create project

### Enable Services

In Firebase Console:

1. **Authentication**
   - Go to Authentication → Sign-in method
   - Enable Email/Password provider

2. **Firestore**
   - Create a Firestore database
   - Start in test mode for development
   - Region: us-central1

3. **Storage**
   - Create a Cloud Storage bucket
   - Default bucket settings

### Get Firebase Config

1. Go to Project Settings (gear icon)
2. Under "Your apps", create a Web app
3. Copy the Firebase config
4. Paste into `.env` file:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Step 3: HighLevel Setup

### Create Developer Account

1. Go to [HighLevel Developer Console](https://developers.gohighlevel.com)
2. Sign up or log in
3. Create a new API key

### Create Marketplace App

1. In developer dashboard, create a new app
2. Fill in app details:
   - Name: "AI App Builder"
   - Description: "Generate HighLevel apps with AI"
3. Copy **Client ID** and **Client Secret**
4. Already provided in `.env`:
   ```
   HIGHLEVEL_CLIENT_ID=6ad9edaddf6c2500a18f558c-mvjfqiej
   HIGHLEVEL_CLIENT_SECRET=8ba35eb8-c900-49e1-b256-2f66e27850fe
   ```

### Create Sandbox Account

1. In developer dashboard, create a sandbox account
2. This is your test account with sample data
3. Use this account when connecting via OAuth

## Step 4: Get Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com)
2. Create API key
3. Add to `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

## Step 5: Configure Firebase Service Account

For Cloud Functions to work, you need Firebase admin credentials:

### Method A: Using Firebase CLI (Recommended)

```bash
firebase login
firebase init functions
# Select your project: highlevel-app-builder
```

### Method B: Manual Setup

1. In Firebase Console, go to Project Settings
2. Go to "Service Accounts"
3. Click "Generate a new private key"
4. You'll get a JSON file with:
   ```json
   {
     "type": "service_account",
     "project_id": "...",
     "private_key": "...",
     "client_email": "..."
   }
   ```

5. Add to `.env`:
   ```
   FIREBASE_PROJECT_ID=...
   FIREBASE_PRIVATE_KEY=...
   FIREBASE_CLIENT_EMAIL=...
   ```

## Step 6: Local Development

### Start Emulators

```bash
# Terminal 1: Start Firebase emulators
firebase emulators:start

# Terminal 2: Start frontend dev server
cd frontend
npm run dev
```

Visit `http://localhost:3000`

### Test the Flow

1. **Sign Up**
   - Create account with test email
   - Email/password stored in Auth emulator

2. **Connect HighLevel**
   - Click "Connect Account" on dashboard
   - (In development, OAuth redirect won't work fully with emulator)

3. **Create Project**
   - Go to Dashboard
   - Click "New Project"
   - Name: "Test Dashboard"
   - Description: "Show my recent contacts"

4. **Generate Code**
   - Click into project
   - In chat, type: "Build a contact list showing name and email"
   - Click Generate
   - Watch tokens stream into editor

5. **View Preview**
   - Generated code appears in editor
   - Right panel shows live preview

## Step 7: Deploy to Firebase

### Build Frontend

```bash
cd frontend
npm run build
cd ..
```

### Deploy

```bash
firebase deploy
```

This deploys:
- Frontend to Firebase Hosting
- Cloud Functions to us-central1

### Get Deployed URLs

After deployment:
- Frontend: `https://highlevel-app-builder.web.app`
- Functions: `https://us-central1-highlevel-app-builder.cloudfunctions.net`

### Configure HighLevel OAuth

Update in HighLevel app settings:
- OAuth Redirect URI: `https://us-central1-highlevel-app-builder.cloudfunctions.net/oauthCallback`

## Step 8: Configure Environment for Production

Create `.env.production`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=highlevel-app-builder.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=highlevel-app-builder
VITE_FIREBASE_STORAGE_BUCKET=highlevel-app-builder.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=https://us-central1-highlevel-app-builder.cloudfunctions.net
```

## Troubleshooting

### "Cannot find module" errors

```bash
# Reinstall dependencies
npm run clean
npm run install-all
```

### Firebase emulator won't start

```bash
# Clear emulator data
rm -rf firebase-emulator-data/
firebase emulators:start
```

### OAuth redirect not working

- Verify Cloud Functions are deployed
- Check redirect URI in HighLevel settings
- Check `.env` has correct HIGHLEVEL_OAUTH_REDIRECT_URI

### Firestore security rules error

- In development, start Firestore in test mode (no rules)
- Use emulator which has test mode enabled
- Check rules syntax with `firebase emulators:start`

## Next Steps

- [ ] Set up local `.env` file with your credentials
- [ ] Test OAuth flow with sandbox account
- [ ] Generate sample code and verify HighLevel API calls
- [ ] Deploy to Firebase Hosting
- [ ] Monitor Cloud Functions logs
- [ ] Set up monitoring and alerting

## Documentation

- [Firebase Docs](https://firebase.google.com/docs)
- [HighLevel API Docs](https://marketplace.gohighlevel.com/docs)
- [Anthropic Claude API](https://docs.anthropic.com)
- [Vue 3 Guide](https://vuejs.org)
