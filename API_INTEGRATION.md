# API Integration Guide

This document describes the integration between the app builder, HighLevel APIs, and Claude LLM.

## Architecture Overview

```
┌─────────────┐
│   Vue App   │
└──────┬──────┘
       │ (HTTP + Firebase Token)
       ▼
┌─────────────────────────────────┐
│  Firebase Cloud Functions       │
│ ┌─────────────────────────────┐ │
│ │ Auth Verification           │ │
│ │ Project CRUD                │ │
│ │ File Management             │ │
│ │ LLM Orchestration (Claude)  │ │
│ │ HighLevel OAuth Handler     │ │
│ └─────────────────────────────┘ │
└──────┬────────────┬──────────────┘
       │            │
       ▼            ▼
  ┌─────────┐  ┌──────────────────┐
  │Firestore│  │ HighLevel API    │
  │ -Users  │  │ -Contacts        │
  │ -Tokens │  │ -Conversations   │
  │ -Files  │  │ -Calendars       │
  └─────────┘  └──────────────────┘
```

## Flow: Code Generation

### 1. User Submits Prompt

```
Frontend: User types "Build a contact dashboard"
│
├─> POST /projects/{id}/generate?prompt=...
│   (with Firebase ID token in Authorization header)
│
└─> Connected to Server-Sent Events (SSE) stream
```

### 2. Cloud Function Processes Request

```
Functions: oauthCallback handler receives request
│
├─> Verify Firebase token
├─> Get user ID from token
├─> Fetch user's stored HighLevel OAuth tokens
├─> Fetch sample data from HighLevel APIs:
│   ├─> GET /v3/crm/contacts (with access token)
│   ├─> GET /v3/conversations
│   └─> GET /v3/calendars
│
└─> Send to Claude with context
```

### 3. Claude Generates Code

```
Claude receives:
- System prompt (Vue 3, TypeScript, ShadCN requirements)
- User prompt (what app to build)
- Context (sample HighLevel data)

Claude responds with:
{
  "files": [
    {
      "name": "ContactDashboard.vue",
      "type": "vue",
      "content": "<template>...</template>..."
    }
  ]
}
```

### 4. Stream Tokens to Frontend

```
Functions: Streams each token via SSE
│
├─> event: token
│   data: "const"
│
├─> event: token
│   data: " "
│
├─> event: token
│   data: "ContactList"
│
...
│
└─> event: done
    data: "Generation complete"
```

### 5. Frontend Updates Editor

```
Frontend: Receives each token
│
├─> Append to editor content
├─> Re-render Monaco Editor
├─> Show loading indicator while streaming
│
└─> When done: Save files, create snapshot
```

## HighLevel API Integration

### OAuth Flow

```
1. User clicks "Connect HighLevel"
│
├─> Frontend redirects to:
│   https://services.highlevel.com/oauth/chooselocation
│   ?client_id=6ad9edaddf6c2500a18f558c-mvjfqiej
│   &redirect_uri=https://deployed-url/oauthCallback
│   &state=<encoded-uid>
│
2. User authorizes in HighLevel
│
3. HighLevel redirects to our callback URL with code
│
4. Cloud Function exchanges code for tokens:
│   POST https://services.highlevel.com/oauth/token
│   {
│     "grant_type": "authorization_code",
│     "code": "<auth_code>",
│     "client_id": "...",
│     "client_secret": "...",
│     "redirect_uri": "..."
│   }
│
5. Response contains:
│   {
│     "access_token": "...",
│     "refresh_token": "...",
│     "expires_in": 3600,
│     "location_id": "..."
│   }
│
6. Store tokens in Firestore:
│   users/{uid}/highlevelTokens/{locationId}/
   {
     "accessToken": "...",
     "refreshToken": "...",
     "expiresAt": <timestamp>,
     "locationId": "..."
   }
```

### API Endpoints Used

#### 1. Contacts API

```
GET https://services.highlevel.com/v3/crm/contacts

Headers:
- Authorization: Bearer <access_token>
- Location-Id: <location_id>

Query Params:
- limit: 50 (max)
- query: (optional) search term

Response:
{
  "contacts": [
    {
      "id": "contact_123",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "tags": ["vip"],
      "createdAt": "2024-01-01T00:00:00Z",
      ...
    }
  ],
  "pageInfo": {
    "limit": 50,
    "offset": 0,
    "total": 150
  }
}
```

#### 2. Conversations API

```
GET https://services.highlevel.com/v3/conversations

Headers:
- Authorization: Bearer <access_token>
- Location-Id: <location_id>

Query Params:
- limit: 50
- status: (open|closed|snoozed)

Response:
{
  "conversations": [
    {
      "id": "conv_123",
      "contactId": "contact_456",
      "type": "SMS|EMAIL|PHONE|CHAT",
      "status": "open",
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "preview": "Last message text...",
      "unreadCount": 2
    }
  ]
}
```

#### 3. Calendars API

```
GET https://services.highlevel.com/v3/calendars

Headers:
- Authorization: Bearer <access_token>
- Location-Id: <location_id>

Response:
{
  "calendars": [
    {
      "id": "cal_123",
      "name": "Main Calendar",
      "type": "location|contact|resource"
    }
  ]
}

GET https://services.highlevel.com/v3/calendars/{calendarId}/appointments

Query Params:
- limit: 50
- startDate: ISO8601
- endDate: ISO8601

Response:
{
  "appointments": [
    {
      "id": "apt_123",
      "title": "Customer Meeting",
      "startTime": "2024-01-20T14:00:00Z",
      "endTime": "2024-01-20T15:00:00Z",
      "contactId": "contact_456",
      "status": "scheduled|completed|cancelled"
    }
  ]
}
```

## Claude Integration

### System Prompt

The system prompt instructs Claude to:

1. **Generate Vue 3 + TypeScript code**
   - Use `<script setup>` syntax
   - Provide type definitions
   - Handle errors gracefully

2. **Integrate with HighLevel APIs**
   - Accept `accessToken` and `locationId` as props
   - Make authenticated fetch calls
   - Handle pagination
   - Parse responses correctly

3. **Use ShadCN Vue Components**
   - Import from `shadcn-vue`
   - Use Button, Card, Input, Table, etc.
   - Maintain design consistency

4. **Provide Production-Ready Code**
   - Loading states
   - Error messages
   - No console.log debugging
   - Proper TypeScript types

### Prompt Template

```typescript
const systemPrompt = `You are an expert Vue 3 developer generating HighLevel integration code.

User's Request: {user_prompt}

Available Data Context:
{sample_contacts}
{sample_conversations}
{sample_calendars}

Generate a Vue 3 component that:
1. Uses <script setup> syntax
2. Accepts {accessToken, locationId} as props
3. Fetches and displays HighLevel data
4. Uses ShadCN Vue for UI
5. Handles errors and loading states

Respond with valid JSON:
{
  "files": [{
    "name": "Component.vue",
    "type": "vue",
    "content": "<template>...</template>..."
  }]
}`
```

### Example Generated Code

```vue
<template>
  <div class="space-y-4 p-4">
    <h1 class="text-2xl font-bold">Recent Contacts</h1>
    
    <div v-if="loading" class="text-gray-500">
      Loading contacts...
    </div>

    <div v-if="error" class="bg-red-50 border border-red-200 rounded p-3 text-red-600">
      {{ error }}
    </div>

    <div v-if="contacts.length" class="grid gap-3">
      <div
        v-for="contact in contacts"
        :key="contact.id"
        class="border rounded-lg p-4 hover:shadow-lg transition"
      >
        <h3 class="font-semibold">
          {{ contact.firstName }} {{ contact.lastName }}
        </h3>
        <p class="text-sm text-gray-600">{{ contact.email }}</p>
        <p class="text-sm text-gray-600">{{ contact.phone }}</p>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-500">
      No contacts found
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

const props = defineProps<{
  accessToken: string
  locationId: string
}>()

const contacts = ref<Contact[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const response = await fetch(
      'https://services.highlevel.com/v3/crm/contacts',
      {
        headers: {
          'Authorization': `Bearer ${props.accessToken}`,
          'Location-Id': props.locationId,
        },
      }
    )

    if (!response.ok) throw new Error('Failed to fetch contacts')
    
    const data = await response.json()
    contacts.value = data.contacts || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    loading.value = false
  }
})
</script>
```

## Token Refresh Strategy

### Automatic Refresh

Cloud Function runs every 24 hours:

```
1. Query all users with HighLevel tokens
2. For each token:
   a. Check expiration time
   b. If expiring within 1 hour:
      - Send refresh_token to HighLevel
      - Store new access token
   c. Log result
```

### Manual Refresh on Use

Before using stored token:

```
1. Check if token exists and valid
2. If expired:
   - Attempt to refresh using refresh_token
   - If refresh fails, redirect user to OAuth
3. Use token for API calls
```

## Error Handling

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Expired access token | Refresh token or re-authenticate |
| 403 Forbidden | Insufficient scopes | User needs to re-authorize |
| 404 Not Found | Invalid location ID or resource | Verify IDs are correct |
| 429 Too Many Requests | Rate limited | Implement backoff, check quota |
| 500 Server Error | HighLevel API issue | Retry with exponential backoff |

### Frontend Error Display

```vue
<div v-if="error" class="alert alert-error">
  <span>{{ error }}</span>
  <button @click="retry">Retry</button>
</div>
```

## Security Considerations

1. **Never expose access tokens in client code**
   - Tokens only stored in secure Firestore
   - Passed through Cloud Functions
   - Generated app receives token via props

2. **Validate all user input**
   - Sanitize prompts before sending to Claude
   - Validate file content before storing
   - Check project ownership before operations

3. **Rate limiting**
   - Consider limiting generations per user/day
   - Monitor for abuse
   - Implement progressive delays

4. **Audit logging**
   - Log all OAuth connections
   - Log all code generations
   - Monitor for suspicious activity

## Testing API Integration

### Postman Collection

```json
{
  "info": {
    "name": "HighLevel App Builder API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Contacts",
      "request": {
        "method": "GET",
        "url": "https://services.highlevel.com/v3/crm/contacts",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}"
          },
          {
            "key": "Location-Id",
            "value": "{{location_id}}"
          }
        ]
      }
    }
  ]
}
```

## Rate Limits

HighLevel API rate limits (as of 2024):

- **Contacts API**: 1000 requests/hour
- **Conversations API**: 1000 requests/hour
- **Calendars API**: 500 requests/hour
- **OAuth Token Endpoint**: 100 requests/hour

Implement:
- Request queuing
- Exponential backoff
- Caching where appropriate
- User notification for rate limits

---

**Last Updated**: 2024-01-15
**Version**: 1.0
