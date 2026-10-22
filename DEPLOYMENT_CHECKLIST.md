# Deployment Checklist

Complete this checklist before deploying to production.

## Pre-Deployment

### Configuration
- [ ] Firebase project created and configured
- [ ] `.env` file filled with all required credentials
- [ ] HighLevel app credentials obtained and verified
- [ ] Anthropic API key obtained and active
- [ ] Firebase service account key generated
- [ ] Firestore database created in us-central1

### Code Quality
- [ ] Frontend builds without errors: `cd frontend && npm run build`
- [ ] TypeScript compiles: `frontend: npm run type-check` and `functions: npm run build`
- [ ] No console errors in development
- [ ] Security rules are properly configured in `firestore.rules`
- [ ] Environment variables match `.env.example` pattern

### Testing
- [ ] Local dev environment works: `firebase emulators:start`
- [ ] Frontend loads at `http://localhost:3000`
- [ ] Sign up/login flow works
- [ ] Project creation works
- [ ] File creation and updates work
- [ ] Snapshot functionality works (optional for MVP)
- [ ] Code generation runs and produces valid output

## Deployment Steps

### Step 1: Prepare Firebase Project

```bash
firebase login
firebase use highlevel-app-builder
firebase init --force  # If not already done
```

### Step 2: Set Environment Variables in Firebase

```bash
# For Cloud Functions to access secrets
firebase functions:config:set anthropic.key="sk-ant-..."
firebase functions:config:set highlevel.client_id="6ad9edaddf6c2500a18f558c-mvjfqiej"
firebase functions:config:set highlevel.client_secret="8ba35eb8-c900-49e1-b256-2f66e27850fe"
```

### Step 3: Build and Deploy

```bash
# Build frontend
cd frontend
npm run build
cd ..

# Deploy everything
firebase deploy

# Or deploy individual services:
firebase deploy --only hosting      # Frontend only
firebase deploy --only functions    # Functions only
```

### Step 4: Verify Deployment

After deployment:

1. **Check Firebase Console**
   - Hosting: URL should show deployed app
   - Functions: All functions should show as deployed
   - Firestore: Database should be active

2. **Test Live App**
   - Visit deployed Hosting URL
   - Complete sign-up flow
   - Try project creation
   - Monitor Functions logs for errors

3. **Check Cloud Functions Logs**
   ```bash
   firebase functions:log --limit 50
   ```

### Step 5: Configure HighLevel OAuth

In HighLevel Developer Dashboard:

1. Go to your marketplace app settings
2. Update OAuth Redirect URI to deployed URL:
   ```
   https://us-central1-highlevel-app-builder.cloudfunctions.net/oauthCallback
   ```
3. Save changes

## Post-Deployment

### Monitoring

- [ ] Set up Firebase alerts for:
  - Function errors (Error rate > 5%)
  - Firestore reads exceeding quota
  - Function execution time exceeding 30s
  
- [ ] Monitor Cloud Functions logs daily for first week
- [ ] Check Firestore usage via Console

### Backups

- [ ] Enable automated Firestore backups (if on paid plan)
- [ ] Document backup recovery procedure
- [ ] Test backup restore process

### Security

- [ ] Verify Firestore security rules are active
- [ ] Check no test data in production Firestore
- [ ] Review Firebase Authentication sign-in methods
- [ ] Confirm CORS settings in Cloud Functions

### Performance

- [ ] Test code generation latency
- [ ] Monitor Cloud Function cold start times
- [ ] Check frontend load times
- [ ] Verify SSE streaming works end-to-end

## Rollback Plan

If issues occur post-deployment:

### Option 1: Revert Hosting
```bash
firebase hosting:channel:list
firebase hosting:clone production <previous-version>
```

### Option 2: Revert Functions
Functions are versioned by deployment. To revert:
1. Go to Cloud Functions console
2. Delete current version
3. Redeploy previous code

### Option 3: Disable Generation
If generation is causing issues:
1. Comment out generation routes in `functions/src/index.ts`
2. Redeploy functions
3. Investigate issue
4. Redeploy fix

## Critical URLs

After deployment:

- **Frontend**: `https://highlevel-app-builder.web.app`
- **Functions Base**: `https://us-central1-highlevel-app-builder.cloudfunctions.net`
- **OAuth Redirect**: `https://us-central1-highlevel-app-builder.cloudfunctions.net/oauthCallback`
- **Firebase Console**: `https://console.firebase.google.com/project/highlevel-app-builder`

## Support & Troubleshooting

### Common Deployment Issues

1. **"Firebase credentials not found"**
   - Run `firebase login`
   - Run `firebase init` for project selection
   - Check `.firebaserc` exists with correct project

2. **"Function deployment failed"**
   - Check Cloud Functions quotas not exceeded
   - Verify all environment variables set
   - Check functions/package.json has all dependencies

3. **"Hosting deployment failed"**
   - Verify frontend build output exists: `ls frontend/dist/`
   - Check firebase.json has correct hosting configuration
   - Clear Firebase cache: `firebase deploy --force`

4. **"OAuth redirect not working"**
   - Verify HighLevel OAuth URI matches deployed URL
   - Check functions are deployed
   - Test function URL directly in browser

### Getting Help

1. Check Firebase Console for error details
2. Review Cloud Functions logs: `firebase functions:log`
3. Check Firestore rules validation in emulator
4. Verify HighLevel API credentials are active

---

**Deployment Date**: _______________

**Deployed By**: _______________

**Notes**: _______________________________________________
