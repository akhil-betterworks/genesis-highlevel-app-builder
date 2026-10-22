# Troubleshooting Guide

Common issues and their solutions.

## Authentication Issues

### "Email already in use"

**Cause**: User account already exists

**Solution**:
1. Try logging in instead of signing up
2. Use "Forgot password" if you don't remember password
3. Contact admin if account was created in error

### "Invalid email or password"

**Cause**: Incorrect credentials or account doesn't exist

**Solution**:
1. Double-check email spelling
2. Verify caps lock is off
3. Reset password if forgotten
4. Ensure account was created (check spam for confirmation email)

### "Session expired"

**Cause**: Firebase token expired or localStorage cleared

**Solution**:
1. Refresh the page
2. Log in again
3. Check browser isn't in private mode (localStorage doesn't persist)
4. Clear browser cache and try again

### "Cannot read property 'uid' of null"

**Cause**: User not authenticated

**Solution**:
1. Ensure you're logged in
2. Check browser console for auth errors
3. Verify Firebase config is correct in .env
4. Check Firebase Authentication is enabled

## Firebase Issues

### "Firebase SDK is not available"

**Cause**: Firebase hasn't initialized or config is missing

**Solution**:
```bash
# Check .env file exists and is complete
ls -la .env

# Verify all VITE_FIREBASE_* variables are set
# Restart dev server after updating .env
npm run dev
```

### "Firestore permission denied"

**Cause**: Security rules denying access

**Solution**:

**In Development**:
```bash
# Use Firestore emulator with test mode
firebase emulators:start

# Security rules don't apply in test mode
```

**In Production**:
```javascript
// Verify Firestore rules allow your operation
// Check rules in firestore.rules

// Verify auth context:
// - User is logged in (context.auth != null)
// - User ID matches document path
// - Operation is in allowed list (read, write)
```

### "Cannot deploy functions"

**Cause**: Various deployment issues

**Solutions**:

```bash
# Check you're logged in
firebase login

# Check project is set
firebase use highlevel-app-builder

# Check functions build successfully
cd functions
npm run build
cd ..

# Check Node version is 18+
node --version

# Deploy with verbose output
firebase deploy --debug

# Clear cache and retry
rm -rf .firebase
firebase deploy --force
```

## HighLevel OAuth Issues

### "Invalid authorization code"

**Cause**: OAuth code expired or redirect URI doesn't match

**Solution**:
1. Verify redirect URI in HighLevel settings matches deployment URL
2. Check Client ID and Secret are correct
3. Try OAuth flow again (previous code expires in minutes)
4. Verify app is published in HighLevel marketplace

### "OAuth redirect loop"

**Cause**: Redirect URI misconfigured

**Solution**:

**Development**:
```
- Firebase emulator doesn't support OAuth redirects
- Test OAuth on deployed version only
- Or: Mock the OAuth flow for testing
```

**Production**:
```
- Verify redirect URI is: 
  https://us-central1-highlevel-app-builder.cloudfunctions.net/oauthCallback

- Update in HighLevel console:
  Marketplace App → Settings → OAuth Redirect URI
```

### "Insufficient scopes"

**Cause**: App doesn't have permission for requested API

**Solution**:
1. In HighLevel Developer Console, check app scopes
2. Add required scopes:
   - `contacts.readonly` for Contacts API
   - `conversations.readonly` for Conversations API
   - `calendar.readonly` for Calendars API
3. Re-authorize user (get new token with new scopes)

### "Location ID not found"

**Cause**: User disconnected location

**Solution**:
1. Have user re-authorize via "Connect HighLevel"
2. Check token storage in Firestore:
   ```
   users/{uid}/highlevelTokens/{locationId}
   ```
3. Verify location exists in HighLevel account

## Code Generation Issues

### "Generation times out"

**Cause**: Claude taking too long or network issues

**Solution**:
```
- Check internet connection
- Verify Anthropic API key is valid
- Simplify prompt (less complex request)
- Check Claude API status: status.anthropic.com
- Increase timeout in functions (default 30s)
```

### "Weird characters in generated code"

**Cause**: Token streaming issues or encoding problems

**Solution**:
```javascript
// Restart generation
// Clear browser cache
// Check browser console for errors
// Verify SSE connection is working
```

### "Generated code doesn't run"

**Cause**: Syntax errors or missing imports

**Solution**:
1. Check code in editor - fix any highlighted errors
2. Verify component has all required imports
3. Check ShadCN components are installed
4. Test in preview iframe
5. Check console for runtime errors

### "Cannot access HighLevel APIs in generated code"

**Cause**: Access token not passed or expired

**Solution**:

Generated apps receive token via props:
```vue
<script setup lang="ts">
interface Props {
  accessToken: string
  locationId: string
}

const props = defineProps<Props>()

// Use in fetch:
fetch('https://services.highlevel.com/v3/crm/contacts', {
  headers: {
    'Authorization': `Bearer ${props.accessToken}`,
    'Location-Id': props.locationId,
  },
})
</script>
```

If token isn't passed:
1. Check parent component passes props
2. Verify token exists in Firestore
3. Check token hasn't expired
4. Try re-authorizing HighLevel account

### "Claude API rate limit exceeded"

**Cause**: Too many generation requests

**Solution**:
```
- Wait before trying again (limit resets hourly)
- Reduce frequency of generation
- Upgrade Claude plan if possible
- Batch multiple changes into single prompt
```

## Performance Issues

### "App loads slowly"

**Cause**: Large bundle or slow network

**Solution**:
```bash
# Check bundle size
cd frontend
npm run build
# Check dist/ folder size

# Enable compression
# - Firebase Hosting does this automatically
# - Check Network tab in DevTools

# Optimize imports
# - Lazy load routes
# - Tree-shake unused code
```

### "Projects list takes forever to load"

**Cause**: Too many projects or slow Firestore queries

**Solution**:
```
- Add pagination (load 20 at a time)
- Add search filter
- Check Firestore indexes are created
- Monitor Firestore metrics in console
```

### "Preview iframe is slow"

**Cause**: Heavy component or API calls

**Solution**:
```
- Check network tab for slow API calls
- Use pagination in generated code
- Limit initial data load
- Cache HighLevel API responses
```

## UI/UX Issues

### "Monaco Editor won't load"

**Cause**: @guolao/vue-monaco-editor not installed

**Solution**:
```bash
cd frontend
npm install @guolao/vue-monaco-editor
npm run dev
```

### "Buttons not responding"

**Cause**: JavaScript error or disabled state

**Solution**:
1. Check browser console for errors
2. Verify button isn't disabled (loading)
3. Check click handler exists
4. Try page refresh

### "Chat messages not appearing"

**Cause**: Array not updating reactively

**Solution**:
```typescript
// Wrong (Vue won't detect change):
messages.value[0] = newMessage

// Right (triggers reactivity):
messages.value = [...messages.value, newMessage]
```

## File Management Issues

### "Cannot save file edits"

**Cause**: Permission denied or file doesn't exist

**Solution**:
1. Verify you own the project
2. Verify file still exists
3. Check Firestore rules allow write
4. Check file is selected in editor
5. Try saving again

### "Files disappeared"

**Cause**: Project deleted or accidental overwrite

**Solution**:
1. Check project still exists in dashboard
2. If deleted, check if soft-deleted:
   ```
   Get project document, check "isDeleted" field
   ```
3. Use snapshot restore feature if available
4. Contact admin if data loss

## Emulator Issues

### "Emulator won't start"

**Cause**: Port already in use or outdated Java

**Solution**:
```bash
# Check ports aren't in use
lsof -i :5001  # Firestore
lsof -i :5000  # Hosting
lsof -i :9099  # Auth

# Kill process using port
kill -9 <PID>

# Clear emulator data
rm -rf firebase-emulator-data/

# Update Firebase CLI
npm install -g firebase-tools@latest

# Start fresh
firebase emulators:start
```

### "Emulator data not persisting"

**Cause**: Export file missing or overwrite flag

**Solution**:
```bash
# Start with persistence
firebase emulators:start --import firebase-emulator-data

# Export at end
firebase emulators:export firebase-emulator-data

# Or use --export-on-exit to auto-save
firebase emulators:start --export-on-exit firebase-emulator-data
```

### "Auth emulator shows wrong state"

**Cause**: Cached credentials

**Solution**:
```bash
# Clear auth emulator
rm -rf firebase-emulator-data/auth

# Clear localStorage
# In browser console:
localStorage.clear()

# Restart emulator
firebase emulators:start
```

## Deployment Issues

### "Deploy command hangs"

**Cause**: Network issue or large functions

**Solution**:
```bash
# Try with verbose output
firebase deploy --debug

# Deploy individually
firebase deploy --only hosting
firebase deploy --only functions

# Check internet connection
ping firebase.google.com

# Increase timeout
firebase deploy --with-dependencies
```

### "Functions deploy but don't work"

**Cause**: Environment variables not set

**Solution**:
```bash
# Set Firebase config
firebase functions:config:set \
  anthropic.key="..." \
  highlevel.client_id="..." \
  highlevel.client_secret="..."

# Redeploy
firebase deploy --only functions
```

### "Hosting shows old version"

**Cause**: Cache not cleared or build artifact stale

**Solution**:
```bash
# Clear Hosting cache
firebase deploy --force

# Or manually delete version in console:
Firebase Console → Hosting → Releases → Delete old version

# Clear browser cache
Ctrl+Shift+Delete (Windows)
Cmd+Shift+Delete (Mac)
```

## Monitoring and Debugging

### Enable Verbose Logging

```bash
# Cloud Functions
firebase functions:log --limit 100 --follow

# Firestore
firebase.firestore().enableNetwork()
// Check in browser console
```

### Check Logs

```bash
# Firebase Hosting
firebase hosting:log

# See all logs
firebase functions:log

# Monitor real-time
firebase emulators:start --export-on-exit logs/
```

### Browser DevTools

1. **Network tab**: Check API calls
2. **Console tab**: Check errors and logs
3. **Application tab**: Check localStorage, Firestore data
4. **Performance tab**: Check load time

### Firebase Console

1. **Authentication**: View user accounts
2. **Firestore**: Browse collections, check rules
3. **Cloud Functions**: View logs, monitoring
4. **Hosting**: Check deployment history

## Getting Help

### Before Reaching Out

1. Check this troubleshooting guide
2. Check browser console for errors
3. Check Firebase Console for issues
4. Check Cloud Functions logs
5. Try the emulator first

### Provide Information

When asking for help, include:
- Error message (exact text)
- Steps to reproduce
- Browser and OS
- Recent changes made
- Firebase project ID
- Cloud Function logs

### Resources

- [Firebase Docs](https://firebase.google.com/docs)
- [HighLevel API Docs](https://marketplace.gohighlevel.com/docs)
- [Claude API Docs](https://docs.anthropic.com)
- [Vue 3 Docs](https://vuejs.org)

---

**Last Updated**: 2024-01-15
**Version**: 1.0
