# Testing Guide

This guide covers testing strategies for the HighLevel App Builder.

## Unit Testing

### Frontend Components

Test Vue 3 components using Vitest:

```bash
cd frontend
npm install -D vitest @testing-library/vue happy-dom
```

Example test:

```typescript
// src/components/__tests__/Button.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from '../Button.vue'

describe('Button Component', () => {
  it('renders correctly', () => {
    const wrapper = mount(Button, {
      props: { variant: 'primary' },
      slots: { default: 'Click me' },
    })

    expect(wrapper.text()).toBe('Click me')
  })

  it('handles click events', async () => {
    const wrapper = mount(Button)
    await wrapper.trigger('click')
    expect(wrapper.emitted()).toBeTruthy()
  })

  it('respects disabled prop', () => {
    const wrapper = mount(Button, {
      props: { disabled: true },
    })

    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})
```

### Cloud Functions

Test Cloud Functions with Firebase Emulator:

```bash
cd functions
npm install -D @firebase/rules-unit-testing
npm run dev  # Starts emulator
```

Example test:

```typescript
// functions/src/routes/__tests__/projects.test.ts
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'

describe('Firestore Security Rules', () => {
  it('allows users to read their own projects', async () => {
    const { db } = await initializeTestEnvironment(...)
    const uid = 'user-123'

    await assertSucceeds(
      setDoc(doc(db, `users/${uid}/projects/proj-1`), {
        name: 'My Project',
      })
    )
  })

  it('prevents users from reading others projects', async () => {
    const { db } = await initializeTestEnvironment(...)

    await assertFails(
      setDoc(doc(db, `users/other-uid/projects/proj-1`), {
        name: 'Other Project',
      })
    )
  })
})
```

## Integration Testing

### Auth Flow

```bash
# Test sign up and sign in
1. Create new user via signup form
2. Verify user created in Firebase Auth
3. Verify profile created in Firestore
4. Test sign in with same credentials
5. Verify session persists across page refresh
```

### Project CRUD

```bash
# Test project operations
1. Create project with valid data
   - Verify project appears in dashboard
   - Verify files array is empty initially

2. Update project name
   - Verify changes persist
   - Verify updatedAt timestamp changes

3. Delete project
   - Verify marked as deleted (soft delete)
   - Verify no longer appears in list

4. Verify access control
   - Login as different user
   - Verify cannot access first user's projects
```

### Code Generation

```bash
# Test generation flow
1. Create project
2. Send generation prompt
3. Verify tokens stream to frontend
4. Verify final response is valid JSON
5. Verify files saved to Firestore
6. Verify snapshot created
7. Verify editor shows generated code
8. Verify can edit and save files
```

### HighLevel OAuth

```bash
# Test OAuth flow (requires sandbox account)
1. Click "Connect HighLevel" button
2. Redirect to HighLevel login
3. Authorize app
4. Redirect back with code
5. Verify tokens stored in Firestore
6. Verify connection status updates
7. Test token refresh (after 1 hour)
8. Verify access to HL APIs
```

## End-to-End Testing

### Using Cypress

```bash
npm install -D cypress
npx cypress open
```

Example E2E test:

```javascript
// cypress/e2e/auth.cy.js
describe('Authentication Flow', () => {
  it('completes sign up and login', () => {
    // Sign up
    cy.visit('http://localhost:3000')
    cy.contains('Sign Up').click()
    cy.get('input[type="email"]').type('test@example.com')
    cy.get('input[type="password"]').type('password123')
    cy.get('input[type="password"]').next().type('password123')
    cy.contains('Sign Up').click()

    // Should redirect to dashboard
    cy.url().should('include', '/dashboard')
    cy.contains('Your Projects').should('exist')

    // Logout and login
    cy.contains('Logout').click()
    cy.url().should('include', '/login')

    cy.get('input[type="email"]').type('test@example.com')
    cy.get('input[type="password"]').type('password123')
    cy.contains('Sign In').click()
    cy.url().should('include', '/dashboard')
  })
})
```

### Using Playwright

```bash
npm install -D @playwright/test
npx playwright test
```

Example Playwright test:

```typescript
// tests/e2e/generation.spec.ts
import { test, expect } from '@playwright/test'

test('code generation flow', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/login')
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'password123')
  await page.click('text=Sign In')

  // Wait for dashboard
  await page.waitForURL('**/dashboard')

  // Create project
  await page.click('text=New Project')
  await page.fill('input[placeholder*="name"]', 'Test Project')
  await page.fill('textarea', 'Test description')
  await page.click('text=Create')

  // Navigate to project
  await page.click('text=Test Project')
  await page.waitForURL('**/project/**')

  // Send generation prompt
  await page.fill('textarea[placeholder*="Describe"]', 'Show my contacts')
  await page.click('text=Generate')

  // Wait for generation to complete
  await page.waitForTimeout(3000)

  // Verify code appeared in editor
  const editorContent = await page.locator('.monaco-editor').textContent()
  expect(editorContent).toContain('vue')
})
```

## Manual Testing Checklist

### Pre-Launch Testing

- [ ] **Authentication**
  - [ ] Sign up with email works
  - [ ] Sign in with email works
  - [ ] Password validation works
  - [ ] Session persists across page refresh
  - [ ] Logout clears session

- [ ] **Projects**
  - [ ] Can create new project
  - [ ] Project appears in dashboard
  - [ ] Can view project details
  - [ ] Can edit project name/description
  - [ ] Can delete project
  - [ ] Pagination works if many projects

- [ ] **Code Generation**
  - [ ] Generation prompt submission works
  - [ ] Tokens stream in real-time
  - [ ] Editor updates as tokens arrive
  - [ ] Final code is valid Vue 3
  - [ ] Can edit generated code
  - [ ] Code changes persist

- [ ] **HighLevel Integration**
  - [ ] OAuth connection works
  - [ ] Tokens stored securely
  - [ ] Can fetch contacts
  - [ ] Can fetch conversations
  - [ ] Can fetch calendars
  - [ ] API errors handled gracefully

- [ ] **Snapshots (if implemented)**
  - [ ] Snapshot created after generation
  - [ ] Can view snapshot list
  - [ ] Can restore previous snapshot
  - [ ] Restored code matches snapshot

- [ ] **UI/UX**
  - [ ] All buttons clickable
  - [ ] Forms validate input
  - [ ] Loading states show
  - [ ] Error messages clear
  - [ ] Responsive on mobile
  - [ ] Keyboard navigation works

### Performance Testing

```bash
# Measure frontend performance
npm install -D lighthouse

# Test generation latency
- Measure time from prompt to first token
- Measure time to complete generation
- Monitor memory usage during streaming

# Test Firebase
- Monitor Firestore read/write counts
- Check function execution time
- Verify no timeout errors
```

### Load Testing

```bash
# Test concurrent users
npm install -D k6

# Test script
import http from 'k6/http'
import { sleep } from 'k6'

export const options = {
  vus: 10,      // 10 concurrent users
  duration: '5m',
}

export default function () {
  // Simulate user workflow
  const loginRes = http.post('https://deployed-url/api/login', {
    email: 'user@example.com',
    password: 'password',
  })

  const projectRes = http.get('https://deployed-url/api/projects', {
    headers: { Authorization: `Bearer ${loginRes.body.token}` },
  })

  sleep(1)
}
```

## Security Testing

### OWASP Top 10

- [ ] **A1: Injection**
  - [ ] Test SQL injection (N/A - using Firestore)
  - [ ] Test prompt injection in generation
  - [ ] Verify input sanitization

- [ ] **A2: Authentication**
  - [ ] Verify session tokens not exposed
  - [ ] Test OAuth token storage
  - [ ] Verify CSRF protection

- [ ] **A3: Sensitive Data**
  - [ ] Verify tokens never logged
  - [ ] Check no secrets in client code
  - [ ] Verify HTTPS in production

- [ ] **A4: XML/XXE**
  - [ ] N/A for this application

- [ ] **A5: Broken Access Control**
  - [ ] Verify Firestore rules enforce
  - [ ] Test cross-user access
  - [ ] Verify admin operations require auth

- [ ] **A6: Misconfiguration**
  - [ ] Verify CORS properly configured
  - [ ] Check security headers
  - [ ] Verify debug mode off in production

- [ ] **A7: XSS**
  - [ ] Test Vue template escaping
  - [ ] Test user input in chat
  - [ ] Verify no eval usage

- [ ] **A8: Deserialization**
  - [ ] Verify JSON parsing safe
  - [ ] Test large payloads
  - [ ] Check for XXE in generation responses

- [ ] **A9: Weak Authentication**
  - [ ] Verify strong password requirements
  - [ ] Test rate limiting on login
  - [ ] Check account lockout

- [ ] **A10: Insufficient Logging**
  - [ ] Verify auth events logged
  - [ ] Check generation attempts logged
  - [ ] Monitor for suspicious activity

## Regression Testing

After each update:

1. Run full test suite
2. Manual smoke test (auth → project → generation)
3. Check performance hasn't degraded
4. Verify no new errors in logs
5. Spot check error handling

## CI/CD Testing Pipeline

Example GitHub Actions workflow:

```yaml
name: Test and Deploy

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm run install-all

      - name: Type check
        run: npm run type-check

      - name: Build frontend
        run: cd frontend && npm run build

      - name: Build functions
        run: cd functions && npm run build

      - name: Run unit tests
        run: npm run test

      - name: Run E2E tests
        run: npm run e2e

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
```

## Monitoring in Production

### Key Metrics

- Function execution time (should be < 30s)
- Error rate (should be < 1%)
- Firestore usage (read/write counts)
- Token refresh success rate
- Generation success rate by model

### Alerting

Set up alerts for:
- Function error rate > 5%
- Function execution time > 30s
- Firestore quota exceeded
- OAuth token refresh failures

### Logging

Log all critical operations:
- User auth events
- Project CRUD operations
- Generation requests/completions
- API errors
- Security events

---

**Test Coverage Goal**: > 80%
**Update Frequency**: Every release
