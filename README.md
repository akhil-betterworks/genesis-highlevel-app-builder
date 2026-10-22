# HighLevel AI App Builder

An AI-powered application builder for generating HighLevel marketplace-compatible apps. Users sign in, connect their HighLevel account via OAuth, and describe apps in natural language. The system generates production-ready Vue 3 + TypeScript code that integrates with real HighLevel APIs.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- HighLevel developer account at [developers.gohighlevel.com](https://developers.gohighlevel.com)

### Environment Setup

1. Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

2. Fill in your Firebase config and credentials:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

3. Add your LLM API key (Claude):

```
ANTHROPIC_API_KEY=your_key_here
```

4. HighLevel OAuth credentials (already provided):

```
HIGHLEVEL_CLIENT_ID=6ad9edaddf6c2500a18f558c-mvjfqiej
HIGHLEVEL_CLIENT_SECRET=8ba35eb8-c900-49e1-b256-2f66e27850fe
```

### Local Development with Emulators

```bash
# Install dependencies
cd frontend && npm install && cd ..
cd functions && npm install && cd ..

# Start Firebase emulators (Auth, Firestore, Functions)
firebase emulators:start

# In another terminal, start frontend dev server
cd frontend
npm run dev
```

Visit `http://localhost:3000` and sign up to get started.

## 📋 HighLevel Setup

### 1. Create Developer Account

- Go to [developers.gohighlevel.com](https://developers.gohighlevel.com)
- Sign up for a developer account

### 2. Create Marketplace App

- Navigate to your developer dashboard
- Create a new marketplace app
- Note the **Client ID** and **Client Secret** (provided above)

### 3. Configure OAuth Redirect URI

In your app settings on HighLevel:
- Set OAuth redirect URI to your deployed URL:
  - Development: `http://localhost:5001/highlevel-app-builder/us-central1/oauthCallback`
  - Production: `https://your-deployed-domain.com/api/oauth/callback`

### 4. Create Sandbox Account

- From the developer dashboard, create a sandbox account
- Use this for testing without affecting production data

## 🏗️ Architecture

### Stack

- **Frontend**: Vue 3 + TypeScript + ShadCN UI + Vite
- **Backend**: Firebase (Auth, Firestore, Cloud Functions)
- **LLM**: Claude 3.5 Sonnet via Anthropic SDK
- **APIs**: HighLevel Contacts, Conversations, Calendars

### Key Decisions

1. **Firebase for Backend**: Firebase Authentication handles OAuth seamlessly, Firestore provides real-time data, Cloud Functions reduce infrastructure overhead
2. **Claude for Code Generation**: Superior code quality and context understanding for generating production-ready Vue 3/TypeScript code
3. **Server-Sent Events (SSE) for Streaming**: Real-time token streaming provides better UX during generation without WebSocket complexity
4. **Firestore Security Rules**: Strict scoping ensures users can only access their own projects and data
5. **Snapshot Versioning**: Each generation creates a snapshot enabling full version control and rollback capability
6. **Token Management in Cloud Functions**: Secure storage of HighLevel OAuth tokens with automatic refresh via scheduled functions
7. **Project-scoped Files**: Files stored as subcollections under projects for clean data organization and access control
8. **Hybrid Auth**: Firebase email/password for app login + HighLevel OAuth for API access provides flexibility
9. **ShadCN Vue for UI**: Pre-built accessible components reduce development time while maintaining design consistency
10. **Type-safe API Layer**: Centralized axios instance with Firebase token injection prevents auth boilerplate

## 📁 Project Structure

```
better/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.vue              # Landing page
│   │   │   ├── Login.vue             # Firebase auth
│   │   │   ├── Signup.vue            # Registration
│   │   │   ├── Dashboard.vue         # Projects list
│   │   │   ├── ProjectEditor.vue     # Main workspace (chat/code/preview)
│   │   │   └── OAuthCallback.vue     # HL OAuth handler
│   │   ├── services/
│   │   │   ├── firebase.ts           # Firebase config
│   │   │   ├── auth.ts               # Auth functions
│   │   │   └── api.ts                # API client with SSE
│   │   ├── App.vue                   # Root component
│   │   └── main.ts                   # Entry point
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── functions/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts               # Auth functions
│   │   │   ├── projects.ts           # Project CRUD + file management
│   │   │   ├── generation.ts         # LLM streaming + file generation
│   │   │   └── highlevel.ts          # OAuth + HL API integration
│   │   ├── utils/
│   │   │   ├── auth.ts               # Token verification
│   │   │   └── highlevel.ts          # HL API helpers
│   │   └── index.ts                  # Function exports
│   └── package.json
├── firebase.json                     # Firebase config
├── firestore.rules                   # Security rules
├── firestore.indexes.json            # Firestore indexes
├── .env.example                      # Environment template
└── README.md                         # This file
```

## 🔐 Security

### Authentication Flow

1. **App Login**: Email/password via Firebase Authentication
2. **HighLevel OAuth**: User clicks "Connect HighLevel Account"
3. **Token Storage**: OAuth tokens stored in Firestore, scoped to user
4. **Token Refresh**: Scheduled Cloud Function refreshes expiring tokens
5. **API Calls**: Generated apps receive access token from Cloud Functions with HL context

### Firestore Security Rules

- Users can only read/write their own documents
- Projects and files are scoped to user ID
- No public collections (except with explicit allow)
- Token storage is user-scoped subcollection

### Best Practices

- Never commit `.env` files with real credentials
- Use Firebase Secret Manager for sensitive values in production
- All Cloud Functions verify authentication before processing
- CORS limited to deployed frontend domain
- API requests require valid Firebase ID token

## 🚀 Deployment

### Deploy to Firebase Hosting + Cloud Functions

```bash
# Build frontend
cd frontend
npm run build
cd ..

# Deploy all (hosting + functions)
firebase deploy

# Or deploy individually
firebase deploy --only hosting
firebase deploy --only functions
```

### Deploy Steps

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create new project "highlevel-app-builder"
   - Enable Authentication (Email/Password provider)
   - Create Firestore database

2. **Initialize Firebase CLI**
   ```bash
   firebase login
   firebase init  # Select hosting + functions
   ```

3. **Set Environment Variables**
   ```bash
   firebase functions:config:set anthropic.key="your_key"
   firebase functions:config:set highlevel.client_id="..."
   firebase functions:config:set highlevel.client_secret="..."
   ```

4. **Deploy**
   ```bash
   npm run build
   firebase deploy
   ```

5. **Update HighLevel OAuth URI**
   - Get your deployed Cloud Function URL from Firebase Console
   - Update OAuth redirect URI in HighLevel app settings

### Monitoring

- **Firebase Console**: Real-time function logs and Firestore usage
- **Cloud Functions logs**: View via `firebase functions:log`
- **Performance**: Use Firestore composite indexes for complex queries

## 📊 File Generation Process

1. User sends prompt in chat
2. Frontend connects to `/projects/{id}/generate` SSE endpoint
3. Cloud Function:
   - Fetches user's HighLevel tokens
   - Retrieves sample data (contacts, conversations, calendars)
   - Sends prompt + context to Claude
4. Claude streams response with file structure
5. Files are validated and saved to Firestore
6. Previous generation snapshot is created automatically
7. Frontend updates code editor in real-time with tokens

## 🎯 Next Steps for Development

1. **Add Monaco Editor Integration**: Install and configure for syntax highlighting
2. **Implement Live Preview**: Use Sandpack or WebContainers to run generated apps
3. **Add Diff View**: Show what changed between generations
4. **Generation Cancellation**: Implement abort for mid-stream cancellations
5. **Rate Limiting**: Add per-user generation quotas via Cloud Functions
6. **Webhook Integration**: Subscribe to HighLevel webhooks for real-time data
7. **Test Suite**: Add unit tests for Cloud Functions and components
8. **Analytics**: Track generation success/failure and user behavior

## 🎬 Demo Video

[Link to Loom video walkthrough](https://loom.com)

The video covers:
- Signing up and creating account
- Connecting HighLevel via OAuth
- Creating new project
- Sending AI generation prompt
- Watching code stream in real-time
- Live preview with real HL data
- Editing generated files
- Restoring from snapshot history

## 🐛 Troubleshooting

### "Invalid authorization code"
- Check HighLevel OAuth redirect URI matches deployment URL
- Verify Client ID and Secret are correct
- Ensure sandbox account has API access enabled

### "Token expired"
- Refresh tokens are automatically refreshed by scheduled Cloud Function
- If manual refresh needed: re-authenticate via OAuth button

### "Project not found"
- Verify project exists in Firestore (should be under `users/{uid}/projects`)
- Check Firestore security rules allow access

### Firebase Emulator Issues
- Clear emulator data: `rm -rf firebase-emulator-data/`
- Restart emulator: `firebase emulators:start --force`

## 📝 API Reference

### Generated App Context

Generated apps receive this context via props:

```typescript
{
  accessToken: string        // HighLevel OAuth token
  locationId: string         // Connected location ID
  contactsApiUrl: string     // Full Contacts API endpoint
  conversationsApiUrl: string
  calendarsApiUrl: string
}
```

### Example: Fetch Contacts in Generated App

```typescript
const contacts = await fetch(
  `https://services.highlevel.com/v3/crm/contacts`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Location-Id': locationId,
    },
  }
).then(r => r.json())
```

## 📄 License

Built as a HighLevel marketplace application. See LICENSE for details.

---

**Questions?** Open an issue on the repository or check the [HighLevel Marketplace Docs](https://marketplace.gohighlevel.com/docs).
