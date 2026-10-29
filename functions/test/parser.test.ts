import { describe, expect, it } from 'vitest'
import { StreamParser, cleanContent, type ParseEvent } from '../src/generation/parser'

function feed(chunks: string[]) {
  const p = new StreamParser()
  const events: ParseEvent[] = []
  for (const c of chunks) events.push(...p.push(c))
  return { events, fin: p.finish() }
}

const full = `<plan>Build it</plan>
<file path="index.html">
<div id="app"></div>
</file>
<file path="main.js">
const App = { template: '<p>hi</p>' }
</file>
<delete path="old.js"/>
<summary>Created a demo.</summary>`

describe('StreamParser', () => {
  it('parses a complete response', () => {
    const { events, fin } = feed([full])
    const ends = events.filter((e) => e.type === 'file_end') as Extract<ParseEvent, { type: 'file_end' }>[]
    expect(ends.map((e) => e.path)).toEqual(['index.html', 'main.js'])
    expect(ends[0].content).toBe('<div id="app"></div>\n')
    expect(ends[1].content).toContain("template: '<p>hi</p>'")
    expect(events).toContainEqual({ type: 'delete', path: 'old.js' })
    expect(events).toContainEqual({ type: 'summary', text: 'Created a demo.' })
    expect(fin.partialFile).toBeUndefined()
  })

  it('is invariant to chunk boundaries (char-by-char streaming)', () => {
    const a = feed([full]).events.filter((e) => e.type === 'file_end')
    const b = feed(full.split('')).events.filter((e) => e.type === 'file_end')
    expect(b).toEqual(a)
  })

  it('handles closing tag split across chunks', () => {
    const { events } = feed(['<file path="a.js">x = 1\n</fi', 'le>'])
    expect(events.find((e) => e.type === 'file_end')).toMatchObject({ path: 'a.js', content: 'x = 1\n' })
  })

  it('returns the partial file when the stream is cut mid-file', () => {
    const { events, fin } = feed(['<file path="a.js">\nconst x = ', '1;'])
    expect(events.some((e) => e.type === 'file_end')).toBe(false)
    expect(fin.partialFile).toEqual({ path: 'a.js', content: 'const x = 1;' })
  })

  it('treats unknown tags in prose as text', () => {
    const { events } = feed(['hello <b>world</b>'])
    expect(events.filter((e) => e.type === 'text').map((e) => (e as { text: string }).text).join('')).toBe('hello <b>world</b>')
  })

  it('streams file deltas that reconstruct the content', () => {
    const { events } = feed(full.match(/.{1,7}/gs)!)
    const deltas = events.filter((e) => e.type === 'file_delta' && e.path === 'main.js').map((e) => (e as { text: string }).text)
    expect(deltas.join('')).toContain("const App = { template: '<p>hi</p>' }")
  })
})

describe('cleanContent', () => {
  it('strips markdown fences', () => {
    expect(cleanContent('```js\nconst a = 1\n```')).toBe('const a = 1\n')
  })
  it('normalises trailing newlines', () => {
    expect(cleanContent('a\n\n\n')).toBe('a\n')
  })
})
