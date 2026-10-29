/**
 * Incremental parser for the LLM output protocol:
 *
 *   <plan>short plan</plan>                (optional, treated as narration)
 *   <file path="app.js">...full content...</file>
 *   <delete path="old.js"/>
 *   <summary>what changed</summary>
 *
 * A tag-based format (instead of JSON) lets us detect file boundaries *while streaming*, so the UI
 * can open a tab and stream tokens into the right editor. It also degrades gracefully: if the stream
 * is cut off we still know exactly which files completed and which one was partial.
 */
export type ParseEvent =
  | { type: 'text'; text: string }
  | { type: 'file_start'; path: string }
  | { type: 'file_delta'; path: string; text: string }
  | { type: 'file_end'; path: string; content: string }
  | { type: 'delete'; path: string }
  | { type: 'summary'; text: string }

const OPEN_FILE = /^<file\s+path\s*=\s*"([^"]+)"\s*>/
const DELETE = /^<delete\s+path\s*=\s*"([^"]+)"\s*\/?>/
const KNOWN_PREFIXES = ['<file', '<delete', '<summary>', '</summary>', '<plan>', '</plan>']
const CLOSE_FILE = '</file>'

export class StreamParser {
  private buf = ''
  private mode: 'outside' | 'file' | 'summary' = 'outside'
  private currentPath = ''
  private currentContent = ''
  private summary = ''
  private atFileStart = false

  push(chunk: string): ParseEvent[] {
    this.buf += chunk
    const out: ParseEvent[] = []
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.mode === 'file') {
        const idx = this.buf.indexOf(CLOSE_FILE)
        if (idx === -1) {
          // Hold back enough characters to recognise a split closing tag.
          const safe = this.buf.length - (CLOSE_FILE.length - 1)
          if (safe > 0) this.emitFileText(this.buf.slice(0, safe), out)
          this.buf = safe > 0 ? this.buf.slice(safe) : this.buf
          return out
        }
        this.emitFileText(this.buf.slice(0, idx), out)
        this.buf = this.buf.slice(idx + CLOSE_FILE.length)
        out.push({ type: 'file_end', path: this.currentPath, content: cleanContent(this.currentContent) })
        this.mode = 'outside'
        continue
      }

      if (this.mode === 'summary') {
        const idx = this.buf.indexOf('</summary>')
        if (idx === -1) return out
        this.summary += this.buf.slice(0, idx)
        this.buf = this.buf.slice(idx + '</summary>'.length)
        out.push({ type: 'summary', text: this.summary.trim() })
        this.mode = 'outside'
        continue
      }

      const lt = this.buf.indexOf('<')
      if (lt === -1) {
        if (this.buf) out.push({ type: 'text', text: this.buf })
        this.buf = ''
        return out
      }
      if (lt > 0) {
        out.push({ type: 'text', text: this.buf.slice(0, lt) })
        this.buf = this.buf.slice(lt)
      }
      const gt = this.buf.indexOf('>')
      if (gt === -1) {
        // Could be a tag still arriving; wait if it's a plausible prefix of one we know.
        const head = this.buf
        if (KNOWN_PREFIXES.some((p) => p.startsWith(head) || head.startsWith(p))) return out
        out.push({ type: 'text', text: '<' })
        this.buf = this.buf.slice(1)
        continue
      }
      const tag = this.buf.slice(0, gt + 1)
      let m: RegExpExecArray | null
      if ((m = OPEN_FILE.exec(tag))) {
        this.mode = 'file'
        this.currentPath = m[1].trim()
        this.currentContent = ''
        this.atFileStart = true
        out.push({ type: 'file_start', path: this.currentPath })
      } else if ((m = DELETE.exec(tag))) {
        out.push({ type: 'delete', path: m[1].trim() })
      } else if (tag === '<summary>') {
        this.mode = 'summary'
        this.summary = ''
      } else if (tag === '<plan>' || tag === '</plan>') {
        // narration markers — swallow
      } else {
        out.push({ type: 'text', text: tag })
      }
      this.buf = this.buf.slice(gt + 1)
    }
  }

  private emitFileText(text: string, out: ParseEvent[]) {
    if (!text) return
    if (this.atFileStart) {
      text = text.replace(/^\r?\n/, '')
      if (!text) return
      this.atFileStart = false
    }
    this.currentContent += text
    out.push({ type: 'file_delta', path: this.currentPath, text })
  }

  /** Call when the stream ends. Returns the partially written file, if the stream was cut mid-file. */
  finish(): { partialFile?: { path: string; content: string }; summary: string } {
    if (this.mode === 'file') {
      this.currentContent += this.buf
      this.buf = ''
      return { partialFile: { path: this.currentPath, content: this.currentContent }, summary: this.summary.trim() }
    }
    return { summary: this.summary.trim() }
  }
}

/** Strip accidental markdown fences the model sometimes wraps around file bodies. */
export function cleanContent(content: string): string {
  let c = content.replace(/\r\n/g, '\n')
  const fence = /^\s*```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```\s*$/.exec(c)
  if (fence) c = fence[1]
  return c.replace(/\n+$/, '') + '\n'
}
