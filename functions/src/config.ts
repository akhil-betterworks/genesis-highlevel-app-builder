/**
 * Centralised runtime configuration.
 *
 * Non-secret values come from `functions/.env` (Firebase loads it automatically, both in the
 * emulator and on deploy). Secrets are declared with `defineSecret` so that in production they are
 * resolved from Google Secret Manager and in the emulator from `functions/.secret.local`.
 * Nothing secret is ever committed to source control.
 */
import { defineSecret, defineString } from 'firebase-functions/params'

export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')
/** API key for non-Anthropic providers (Gemini/Groq/OpenRouter). Unused for Anthropic/Ollama. */
export const LLM_API_KEY = defineSecret('LLM_API_KEY')
export const HL_CLIENT_SECRET = defineSecret('HL_CLIENT_SECRET')
/** 32-byte key (base64 or hex) used for AES-256-GCM encryption of OAuth tokens at rest. */
export const TOKEN_ENCRYPTION_KEY = defineSecret('TOKEN_ENCRYPTION_KEY')

export const HL_CLIENT_ID = defineString('HL_CLIENT_ID')
export const HL_REDIRECT_URI = defineString('HL_REDIRECT_URI')
/** Marketplace app version (required for Draft apps; from the portal's "Install link"). */
export const HL_VERSION_ID = defineString('HL_VERSION_ID', { default: '' })
export const HL_SCOPES = defineString('HL_SCOPES', {
  default: [
    'contacts.readonly',
    'contacts.write',
    'conversations.readonly',
    'conversations.write',
    'conversations/message.readonly',
    'conversations/message.write',
    'calendars.readonly',
    'calendars/events.readonly',
    'locations.readonly',
  ].join(' '),
})
export const FRONTEND_URL = defineString('FRONTEND_URL', { default: 'http://localhost:3000' })
/** Comma separated list of origins allowed to call the API cross-origin. */
export const ALLOWED_ORIGINS = defineString('ALLOWED_ORIGINS', { default: 'http://localhost:3000' })
/** anthropic | gemini | groq | openrouter | ollama | openai-compatible */
export const LLM_PROVIDER = defineString('LLM_PROVIDER', { default: 'anthropic' })
/** Only needed for a custom OpenAI-compatible endpoint; presets supply their own. */
export const LLM_BASE_URL = defineString('LLM_BASE_URL', { default: '' })
/** Empty = provider default (claude-sonnet-4-5, gemini-2.5-flash, …). */
export const LLM_MODEL = defineString('LLM_MODEL', { default: '' })
export const LLM_MAX_TOKENS = defineString('LLM_MAX_TOKENS', { default: '16000' })

export const SECRETS = [ANTHROPIC_API_KEY, LLM_API_KEY, HL_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY]

export const HL_API_BASE = 'https://services.leadconnectorhq.com'
export const HL_AUTHORIZE_URL = 'https://marketplace.gohighlevel.com/v2/oauth/chooselocation'

export const LIMITS = {
  maxFiles: 40,
  maxFileBytes: 200_000,
  maxProjectBytes: 900_000, // keeps snapshots below Firestore's 1 MiB document limit
  maxPromptChars: 8_000,
  contextFileChars: 60_000,
  historyMessages: 8,
} as const
