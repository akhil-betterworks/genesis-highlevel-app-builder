import type { Response } from 'express'

/**
 * SSE event protocol (documented in README):
 *  meta        { generationId, projectId }                        – first event
 *  status      { stage: 'context'|'generating'|'applying', message }
 *  token       { text }                                           – raw LLM text delta
 *  file_start  { path }                                           – a <file> block opened
 *  file_delta  { path, text }                                     – content for the open file
 *  file_end    { path, bytes }                                    – a <file> block closed
 *  file_delete { path }
 *  done        { generationId, snapshotId, status, summary, changes }
 *  error       { code, message, recoverable, partial }
 * Comment lines (": ping") are sent every 15s as heartbeats to keep proxies from closing the stream.
 */
export type SseEvent =
  | 'meta'
  | 'status'
  | 'token'
  | 'file_start'
  | 'file_delta'
  | 'file_end'
  | 'file_delete'
  | 'done'
  | 'error'

export function formatSse(event: SseEvent, data: unknown, id?: number): string {
  const lines = JSON.stringify(data)
  return `${id !== undefined ? `id: ${id}\n` : ''}event: ${event}\ndata: ${lines}\n\n`
}

export class SseWriter {
  private seq = 0
  private heartbeat: NodeJS.Timeout
  closed = false

  constructor(private res: Response) {
    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
    this.heartbeat = setInterval(() => this.raw(': ping\n\n'), 15_000)
    res.on('close', () => this.dispose())
  }

  send(event: SseEvent, data: unknown) {
    this.raw(formatSse(event, data, ++this.seq))
  }

  private raw(chunk: string) {
    if (this.closed) return
    try {
      this.res.write(chunk)
    } catch {
      this.dispose()
    }
  }

  end() {
    if (!this.closed) this.res.end()
    this.dispose()
  }

  private dispose() {
    this.closed = true
    clearInterval(this.heartbeat)
  }
}
