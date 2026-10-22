import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { Anthropic } from '@anthropic-ai/sdk'
import { getUserFromRequest } from '../utils/auth'
import { getStoredHighLevelToken, getHighLevelContacts, getHighLevelConversations, getHighLevelCalendars } from '../utils/highlevel'

const db = admin.firestore()
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are an expert web developer creating HighLevel marketplace apps. You generate Vue 3 + TypeScript code that integrates with HighLevel APIs.

When generating code:
1. Always use TypeScript for type safety
2. Use Vue 3 Composition API with <script setup>
3. Integrate with HighLevel APIs (Contacts, Conversations, Calendars) using provided access tokens
4. Include proper error handling and loading states
5. Use ShadCN Vue components for UI
6. Make the code production-ready

Available HighLevel APIs:
- GET /v3/crm/contacts - Fetch contacts
- GET /v3/conversations - Fetch conversations
- GET /v3/calendars - Fetch calendars
- GET /v3/calendars/{id}/appointments - Fetch appointments

Always wrap your response in a JSON object with this structure:
{
  "files": [
    {
      "name": "filename.vue",
      "type": "vue|typescript|json",
      "content": "file content here"
    }
  ],
  "description": "brief description of what was generated"
}
`

export const setupGenerationRoutes = {
  async streamGeneration(request: any, response: any) {
    const { projectId } = request.query
    const prompt = decodeURIComponent(request.query.prompt || '')

    // Enable CORS and SSE
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')

    if (request.method === 'OPTIONS') {
      response.status(200).end()
      return
    }

    try {
      const uid = await getUserFromRequest(request)

      // Get project
      const projectDoc = await db
        .collection('users')
        .doc(uid)
        .collection('projects')
        .doc(projectId)
        .get()

      if (!projectDoc.exists) {
        response.write('event: error\ndata: Project not found\n\n')
        response.status(404).end()
        return
      }

      // Get HighLevel token and context
      const hlToken = await getStoredHighLevelToken(uid)
      let contextData = ''

      if (hlToken) {
        try {
          const [contacts, conversations, calendars] = await Promise.all([
            getHighLevelContacts(hlToken.accessToken, hlToken.locationId),
            getHighLevelConversations(hlToken.accessToken, hlToken.locationId),
            getHighLevelCalendars(hlToken.accessToken, hlToken.locationId),
          ])

          contextData = `
HighLevel Account Data:
- Contacts: ${JSON.stringify(contacts).slice(0, 1000)}...
- Conversations: ${JSON.stringify(conversations).slice(0, 1000)}...
- Calendars: ${JSON.stringify(calendars).slice(0, 1000)}...
`
        } catch (error) {
          functions.logger.warn('Failed to fetch HL context:', error)
        }
      }

      const userMessage = `${prompt}\n\n${contextData}`

      // Stream from Claude
      const stream = await anthropic.messages.stream({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      })

      let fullResponse = ''

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          const text = chunk.delta.text
          fullResponse += text
          response.write(`event: token\ndata: ${JSON.stringify(text)}\n\n`)
        }
      }

      // Process and save generated files
      try {
        const result = JSON.parse(fullResponse)
        if (result.files && Array.isArray(result.files)) {
          const projectRef = db
            .collection('users')
            .doc(uid)
            .collection('projects')
            .doc(projectId)

          // Create snapshot before updating
          const currentFilesSnap = await projectRef.collection('files').get()
          const currentFiles = currentFilesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }))

          await projectRef.collection('snapshots').add({
            timestamp: new Date(),
            files: currentFiles,
            prompt,
          })

          // Update files
          for (const file of result.files) {
            const fileId = file.name.replace(/\W/g, '_')
            await projectRef.collection('files').doc(fileId).set({
              name: file.name,
              type: file.type,
              content: file.content,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }

          response.write('event: done\ndata: File generation complete\n\n')
        }
      } catch (parseError) {
        functions.logger.warn('Could not parse response as JSON:', parseError)
        response.write('event: done\ndata: Generation complete\n\n')
      }

      response.end()
    } catch (error: any) {
      functions.logger.error('Generation error:', error)
      response.write(`event: error\ndata: ${error.message}\n\n`)
      response.end()
    }
  },
}
