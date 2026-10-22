# Contributing Guide

Guidelines for contributing to the HighLevel App Builder project.

## Getting Started

### 1. Clone Repository

```bash
git clone <repo-url>
cd better
npm run install-all
```

### 2. Set Up Development Environment

```bash
# Copy environment template
cp .env.example .env

# Fill in credentials (see SETUP_GUIDE.md)
# Then start development server
npm run dev
```

### 3. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

## Development Workflow

### Frontend Development

```bash
cd frontend
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build
```

### Backend Development

```bash
cd functions

# Start emulator
firebase emulators:start --only functions

# TypeScript compilation
npm run build

# Deploy to Firebase
firebase deploy --only functions
```

### Testing

```bash
# Run unit tests
npm run test

# Run E2E tests (with emulator running)
npm run e2e

# Run specific test file
npm run test -- path/to/test.spec.ts

# Watch mode
npm run test -- --watch
```

## Code Style Guide

### Vue 3 Components

Use `<script setup>` syntax:

```vue
<template>
  <div class="space-y-4">
    <h1>{{ title }}</h1>
    <button @click="handleClick">{{ buttonText }}</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const title = ref('Hello')
const buttonText = ref('Click me')

const handleClick = () => {
  title.value = 'Clicked!'
}
</script>
```

### TypeScript

Use strict mode:

```typescript
// Always provide types
interface User {
  id: string
  email: string
  createdAt: Date
}

async function getUser(id: string): Promise<User> {
  // Implementation
}

// Avoid 'any'
// ❌ const data: any = ...
// ✅ const data: UserData = ...
```

### Naming Conventions

- **Files**: `PascalCase.vue` for components, `camelCase.ts` for utilities
- **Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`
- **Functions**: `camelCase` for methods, `PascalCase` for Vue components

### Comments

Only comment the WHY, not the WHAT:

```typescript
// ❌ Wrong
// Loop through users
for (const user of users) {
  console.log(user.name)
}

// ✅ Right
// Sort users by last login to prioritize active users for notifications
const activeUsers = users.sort((a, b) => b.lastLogin - a.lastLogin)
```

## Git Workflow

### Commit Messages

Use conventional commits:

```
feat: add snapshot restore functionality
fix: correct OAuth redirect URI validation
docs: update API integration examples
refactor: simplify file generation logic
test: add tests for project CRUD
chore: update dependencies
```

### Pull Request Process

1. **Create feature branch**
   ```bash
   git checkout -b feature/descriptive-name
   ```

2. **Make changes** and commit regularly
   ```bash
   git add <files>
   git commit -m "feat: add feature"
   ```

3. **Push to remote**
   ```bash
   git push origin feature/descriptive-name
   ```

4. **Create Pull Request**
   - Write clear description
   - Link related issues
   - Add screenshots if UI change
   - Request review

5. **Address feedback**
   - Make requested changes
   - Re-request review when ready

6. **Merge to main**
   - Use "Squash and merge" for cleaner history
   - Delete branch after merge

## Project Structure

```
better/
├── frontend/              # Vue 3 SPA
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── composables/  # Logic composition
│   │   ├── services/     # API and Firebase
│   │   └── App.vue
│   ├── vite.config.ts
│   └── package.json
│
├── functions/             # Firebase Cloud Functions
│   ├── src/
│   │   ├── routes/       # API route handlers
│   │   └── utils/        # Helper functions
│   └── package.json
│
├── .env.example          # Environment template
├── firebase.json         # Firebase config
├── firestore.rules       # Firestore security
├── README.md             # Main documentation
└── SETUP_GUIDE.md        # Setup instructions
```

## Feature Development Checklist

Before submitting a pull request:

### Code Quality
- [ ] TypeScript compiles without errors
- [ ] No `console.log` or debug code
- [ ] No `any` types (use proper types)
- [ ] Proper error handling
- [ ] Functions have JSDoc comments

### Testing
- [ ] Added unit tests
- [ ] Added integration tests if needed
- [ ] All tests pass
- [ ] Edge cases covered
- [ ] Error scenarios tested

### Documentation
- [ ] Updated README if needed
- [ ] Added code comments for complex logic
- [ ] Updated API docs if endpoints changed
- [ ] Added examples for new features

### Security
- [ ] No hardcoded secrets
- [ ] Input validation added
- [ ] SQL injection checks (if applicable)
- [ ] XSS prevention checked
- [ ] CORS properly configured

### Performance
- [ ] No unnecessary re-renders
- [ ] No n+1 queries
- [ ] Assets properly optimized
- [ ] Lazy loading implemented where applicable
- [ ] Bundle size checked

### Accessibility
- [ ] Keyboard navigation works
- [ ] ARIA labels added
- [ ] Color contrast sufficient
- [ ] Form labels present
- [ ] Focus management proper

## Testing Guidelines

### Unit Tests

Test individual functions/components in isolation:

```typescript
describe('getContactName', () => {
  it('returns full name from contact object', () => {
    const contact = { firstName: 'John', lastName: 'Doe' }
    expect(getContactName(contact)).toBe('John Doe')
  })

  it('handles missing last name', () => {
    const contact = { firstName: 'John', lastName: '' }
    expect(getContactName(contact)).toBe('John')
  })
})
```

### Integration Tests

Test feature workflows:

```typescript
describe('Project Creation', () => {
  it('creates project and shows in list', async () => {
    // Create project via API
    // Verify it appears in Firestore
    // Verify user can navigate to it
  })
})
```

### E2E Tests

Test complete user journeys:

```typescript
it('full generation workflow', async ({ page }) => {
  // Sign up
  // Create project
  // Generate code
  // Verify code appears
  // Edit and save
})
```

## Deployment

### Pre-Deployment Checklist

- [ ] All tests pass
- [ ] No build errors
- [ ] Type checking passes
- [ ] Environment variables set
- [ ] Changelog updated
- [ ] Security review complete

### Deployment Steps

```bash
# Build frontend
cd frontend && npm run build && cd ..

# Build functions
cd functions && npm run build && cd ..

# Deploy to Firebase
firebase deploy

# Monitor logs
firebase functions:log --follow
```

### Post-Deployment

- [ ] Check deployment in Firebase Console
- [ ] Verify front-end loads
- [ ] Test critical workflows
- [ ] Monitor error logs
- [ ] Check performance metrics

## Reporting Issues

### Bug Report

Include:
1. Description of bug
2. Steps to reproduce
3. Expected vs actual behavior
4. Environment (OS, browser, version)
5. Screenshots/logs if applicable

### Feature Request

Include:
1. Description of feature
2. Use case/motivation
3. Proposed implementation
4. Mockups if UI related

## Code Review Guidelines

### As an Author

- Keep PRs focused (one feature per PR)
- Write clear commit messages
- Link related issues
- Respond to feedback promptly
- Don't merge your own PR

### As a Reviewer

- Check code quality and style
- Verify tests are adequate
- Look for security issues
- Consider performance
- Be constructive in feedback

## Questions?

- Check existing documentation first
- Search GitHub issues for similar questions
- Ask in PR/issue comments
- Open a discussion if needed

## License

By contributing, you agree your code will be released under the project's license.

---

**Happy Contributing!** 🎉
