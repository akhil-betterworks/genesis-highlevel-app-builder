import { logger } from 'firebase-functions'
import { AppError } from '../lib/errors'
import type { LlmProvider, LlmStreamResult } from './llm'

/**
 * Streams from any OpenAI-compatible `/chat/completions` endpoint. One implementation covers:
 *   - Google Gemini (free tier, no card): https://generativelanguage.googleapis.com/v1beta/openai
 *   - Groq (free tier):                  https://api.groq.com/openai/v1
 *   - OpenRouter (":free" models):       https://openrouter.ai/api/v1
 *   - Ollama (local, fully free):        http://127.0.0.1:11434/v1
 */
export class OpenAICompatibleProvider implements LlmProvider {
  constructor(
    private opts: { baseUrl: string; apiKey: string; model: string; maxTokens: number; label: string },
  ) {}

  async stream(args: Parameters<LlmProvider['stream']>[0], onText: (t: string) => void): Promise<LlmStreamResult> {
    let res!: Response
    // Free tiers return 429/503 under load; retry with backoff before giving up.
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(`${this.opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.opts.apiKey ? { Authorization: `Bearer ${this.opts.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: this.opts.model,
            max_tokens: this.opts.maxTokens,
            stream: true,
            stream_options: { include_usage: true },
            messages: [{ role: 'system', content: args.system }, ...args.messages],
          }),
          signal: args.signal,
        })
      } catch (err) {
        if (args.signal.aborted) return { stopReason: 'aborted' }
        logger.error('LLM network error', { provider: this.opts.label, err: String(err) })
        throw new AppError('llm_error', `Could not reach the AI provider (${this.opts.label}).`)
      }
      if ((res.status === 503 || res.status === 429) && attempt < 3) {
        await res.body?.cancel().catch(() => undefined)
        logger.warn('LLM busy, retrying', { provider: this.opts.label, status: res.status, attempt })
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
        if (args.signal.aborted) return { stopReason: 'aborted' }
        continue
      }
      break
    }

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '')
      logger.error('LLM request failed', { provider: this.opts.label, status: res.status, body: body.slice(0, 500) })
      const msg =
        res.status === 401 || res.status === 403
          ? `The ${this.opts.label} API key is invalid`
          : res.status === 429
            ? `${this.opts.label} free-tier rate limit reached. Wait a minute and retry.`
            : res.status === 503
              ? `${this.opts.label} is overloaded right now. Please retry in a minute.`
              : res.status === 404
              ? `Model "${this.opts.model}" not found on ${this.opts.label}`
              : 'The AI provider rejected the request. Please try again.'
      throw new AppError('llm_error', msg, { status: res.status })
    }

    let stopReason: string | null = null
    let usage: LlmStreamResult['usage']
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const j = JSON.parse(data)
            const choice = j.choices?.[0]
            const text = choice?.delta?.content
            if (text) onText(text)
            if (choice?.finish_reason) stopReason = choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn'
            if (j.usage) usage = { input_tokens: j.usage.prompt_tokens ?? 0, output_tokens: j.usage.completion_tokens ?? 0 }
          } catch {
            /* ignore keep-alive / partial frames */
          }
        }
      }
    } catch (err) {
      if (args.signal.aborted) return { stopReason: 'aborted', usage }
      throw new AppError('llm_error', 'The AI stream was interrupted. Please retry.')
    }
    return { stopReason, usage }
  }
}

export const PRESETS: Record<string, { baseUrl: string; model: string; label: string }> = {
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.6-flash', label: 'Gemini' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', label: 'Groq' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat-v3-0324:free', label: 'OpenRouter' },
  ollama: { baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5-coder:7b', label: 'Ollama' },
}
