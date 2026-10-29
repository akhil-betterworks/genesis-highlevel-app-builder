import Anthropic from '@anthropic-ai/sdk'
import { logger } from 'firebase-functions'
import { ANTHROPIC_API_KEY, LLM_API_KEY, LLM_BASE_URL, LLM_MAX_TOKENS, LLM_MODEL, LLM_PROVIDER } from '../config'
import { AppError } from '../lib/errors'
import { OpenAICompatibleProvider, PRESETS } from './openaiCompat'

export interface LlmStreamResult {
  stopReason: string | null
  usage?: { input_tokens: number; output_tokens: number }
}

export interface LlmProvider {
  stream(
    args: { system: string; messages: { role: 'user' | 'assistant'; content: string }[]; signal: AbortSignal },
    onText: (text: string) => void,
  ): Promise<LlmStreamResult>
}

export class AnthropicProvider implements LlmProvider {
  private client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value(), maxRetries: 2 })

  async stream(
    args: Parameters<LlmProvider['stream']>[0],
    onText: (text: string) => void,
  ): Promise<LlmStreamResult> {
    try {
      const stream = this.client.messages.stream(
        {
          model: LLM_MODEL.value() || 'claude-sonnet-4-5',
          max_tokens: Number(LLM_MAX_TOKENS.value()) || 16000,
          system: args.system,
          messages: args.messages,
        },
        { signal: args.signal },
      )
      stream.on('text', (t) => onText(t))
      const final = await stream.finalMessage()
      return { stopReason: final.stop_reason, usage: final.usage }
    } catch (err) {
      if (args.signal.aborted) return { stopReason: 'aborted' }
      const e = err as { status?: number; message?: string; error?: { error?: { message?: string } } }
      // Never surface raw provider payloads (request ids, JSON) to end users; log them instead.
      logger.error('LLM request failed', { status: e.status, message: e.message })
      const detail = `${e.error?.error?.message ?? ''} ${e.message ?? ''}`
      const msg =
        e.status === 401
          ? 'LLM API key is invalid'
          : /credit balance/i.test(detail)
            ? 'The AI provider account is out of credits. Add credits to the Anthropic account and retry.'
            : e.status === 429
              ? 'LLM provider is rate limiting requests, try again shortly'
              : e.status === 529 || e.status === 503
                ? 'LLM provider is overloaded, try again shortly'
                : 'The AI provider rejected the request. Please try again.'
      throw new AppError('llm_error', msg, { status: e.status })
    }
  }
}

let provider: LlmProvider | undefined

function createProvider(): LlmProvider {
  const name = LLM_PROVIDER.value().trim().toLowerCase() || 'anthropic'
  if (name === 'anthropic') return new AnthropicProvider()
  const preset = PRESETS[name]
  const baseUrl = LLM_BASE_URL.value() || preset?.baseUrl
  const model = LLM_MODEL.value() || preset?.model
  if (!baseUrl || !model) {
    throw new AppError('llm_error', `Unknown LLM_PROVIDER "${name}" (set LLM_BASE_URL and LLM_MODEL for custom endpoints)`)
  }
  const apiKey = LLM_API_KEY.value()
  return new OpenAICompatibleProvider({
    baseUrl,
    model,
    apiKey: apiKey && apiKey !== 'unset' ? apiKey : '',
    maxTokens: Number(LLM_MAX_TOKENS.value()) || 16000,
    label: preset?.label ?? name,
  })
}

export const getProvider = () => (provider ??= createProvider())
/** Test seam. */
export const setProvider = (p: LlmProvider | undefined) => {
  provider = p
}
