import { API_BASE, ApiError, authHeader } from './api'

export interface SseMessage {
  event: string
  data: unknown
  id?: string
}

/**
 * Incremental SSE frame parser (spec-compliant subset: event/data/id fields, comments, multi-line
 * data, CRLF). Kept pure so it can be unit-tested independently of fetch/streams.
 */
export class SseParser {
  private buf = ''

  push(chunk: string): SseMessage[] {
    this.buf += chunk.replace(/\r\n?/g, '\n')
    const out: SseMessage[] = []
    let idx: number
    while ((idx = this.buf.indexOf('\n\n')) !== -1) {
      const frame = this.buf.slice(0, idx)
      this.buf = this.buf.slice(idx + 2)
      let event = 'message'
      let id: string | undefined
      const data: string[] = []
      for (const line of frame.split('\n')) {
        if (!line || line.startsWith(':')) continue
        const colon = line.indexOf(':')
        const field = colon === -1 ? line : line.slice(0, colon)
        const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
        if (field === 'event') event = value
        else if (field === 'data') data.push(value)
        else if (field === 'id') id = value
      }
      if (!data.length) continue
      const raw = data.join('\n')
      let parsed: unknown = raw
      try {
        parsed = JSON.parse(raw)
      } catch {
        /* keep string */
      }
      out.push({ event, data: parsed, id })
    }
    return out
  }
}

export interface StreamResult {
  /** True if a terminal `done` event was received. */
  completed: boolean
}

/**
 * EventSource can't send POST bodies or Authorization headers, so we stream with fetch and parse
 * frames ourselves. Resolves when the server closes the stream; `completed=false` means the
 * connection dropped before `done` (caller should reconcile from the persisted generation).
 */
export async function streamSse(
  path: string,
  body: unknown,
  onMessage: (m: SseMessage) => void,
  signal: AbortSignal,
): Promise<StreamResult> {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    const payload = await res.json().catch(() => null)
    const err = payload?.error
    throw new ApiError(res.status, err?.code ?? 'http_error', err?.message ?? `Generation failed (${res.status})`, err?.details)
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  const parser = new SseParser()
  let completed = false
  // Server heartbeats every 15s; if nothing arrives for 45s the connection is dead (proxy/sleep).
  let stalled = false
  let watchdog: ReturnType<typeof setTimeout> | undefined
  const arm = () => {
    clearTimeout(watchdog)
    watchdog = setTimeout(() => {
      stalled = true
      void reader.cancel().catch(() => undefined)
    }, 45_000)
  }
  try {
    arm()
    while (!completed) {
      const { value, done } = await reader.read()
      if (done) break
      arm()
      for (const m of parser.push(value)) {
        onMessage(m)
        if (m.event === 'done') completed = true
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError' && !stalled) throw e
    // network drop / stall mid-stream: surfaced as completed=false so the caller reconciles
  } finally {
    clearTimeout(watchdog)
    // `done` is terminal: stop reading even if a proxy keeps the socket open.
    if (completed) void reader.cancel().catch(() => undefined)
  }
  return { completed }
}
