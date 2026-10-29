import { describe, expect, it } from 'vitest'
import { applyOps, languageFor, validatePath } from '../src/generation/files'
import { decrypt, encrypt, randomToken, sha256 } from '../src/lib/crypto'
import { formatSse } from '../src/lib/sse'
import { windowKey } from '../src/lib/rateLimit'
import { AppError, toAppError } from '../src/lib/errors'
import { boundHistory, buildUserMessage } from '../src/generation/prompt'

describe('validatePath', () => {
  it.each(['index.html', 'components/List.js', './styles.css', 'lib/hl-utils.js'])('accepts %s', (p) => {
    expect(() => validatePath(p)).not.toThrow()
  })
  it.each(['../etc/passwd', '/abs.js', 'a//b.js', 'evil.exe', 'x.php', 'a b.js', ''])('rejects %s', (p) => {
    expect(() => validatePath(p)).toThrow(AppError)
  })
})

describe('applyOps', () => {
  const base = [
    { path: 'a.js', content: 'a' },
    { path: 'b.js', content: 'b' },
  ]
  it('computes added/modified/deleted changes', () => {
    const { files, changes } = applyOps(base, [
      { op: 'write', path: 'a.js', content: 'A' },
      { op: 'write', path: 'c.js', content: 'c' },
      { op: 'delete', path: 'b.js' },
    ])
    expect(files.map((f) => f.path)).toEqual(['a.js', 'c.js'])
    expect(changes.map((c) => [c.path, c.type])).toEqual([
      ['a.js', 'modified'],
      ['c.js', 'added'],
      ['b.js', 'deleted'],
    ])
  })
  it('drops no-op writes from changes', () => {
    expect(applyOps(base, [{ op: 'write', path: 'a.js', content: 'a' }]).changes).toEqual([])
  })
  it('collapses add-then-delete', () => {
    expect(applyOps(base, [{ op: 'write', path: 'n.js', content: '1' }, { op: 'delete', path: 'n.js' }]).changes).toEqual([])
  })
  it('enforces file count limit', () => {
    const ops = Array.from({ length: 41 }, (_, i) => ({ op: 'write' as const, path: `f${i}.js`, content: 'x' }))
    expect(() => applyOps([], ops)).toThrow(/Too many files/)
  })
})

describe('languageFor', () => {
  it('maps extensions', () => {
    expect(languageFor('a.js')).toBe('javascript')
    expect(languageFor('x/y.html')).toBe('html')
  })
})

describe('token crypto', () => {
  const key = randomToken(32)
  it('round-trips', () => {
    expect(decrypt(encrypt('secret-token', key), key)).toBe('secret-token')
  })
  it('uses a random IV', () => {
    expect(encrypt('x', key)).not.toBe(encrypt('x', key))
  })
  it('rejects tampering and wrong key', () => {
    const ct = encrypt('secret', key)
    const parts = ct.split('.')
    parts[3] = Buffer.from('tampered').toString('base64url')
    expect(() => decrypt(parts.join('.'), key)).toThrow()
    expect(() => decrypt(ct, randomToken(32))).toThrow()
  })
  it('accepts hex keys', () => {
    const hex = 'a'.repeat(64)
    expect(decrypt(encrypt('v', hex), hex)).toBe('v')
  })
  it('sha256 is stable', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('SSE format', () => {
  it('formats event frames with JSON data', () => {
    expect(formatSse('token', { text: 'a\nb' }, 3)).toBe('id: 3\nevent: token\ndata: {"text":"a\\nb"}\n\n')
  })
})

describe('rate limit window', () => {
  it('buckets by fixed window', () => {
    const rule = { name: 't', limit: 1, windowMs: 1000 }
    expect(windowKey('u', rule, 1500)).toBe(windowKey('u', rule, 1999))
    expect(windowKey('u', rule, 1999)).not.toBe(windowKey('u', rule, 2000))
  })
})

describe('errors', () => {
  it('maps zod-like issues to invalid_argument', () => {
    expect(toAppError({ issues: [] }).code).toBe('invalid_argument')
    expect(toAppError(new Error('x')).status).toBe(500)
  })
})

describe('prompt building', () => {
  it('budgets file context and includes HL metadata', () => {
    const msg = buildUserMessage({
      files: [{ path: 'main.js', content: 'x'.repeat(70_000) }, { path: 'z.js', content: 'z' }],
      history: [],
      hl: { connected: true, locationName: 'Acme', calendars: [{ id: 'c1', name: 'Sales' }], contactTotal: 42 },
      project: { name: 'P' },
      prompt: 'Build it',
    })
    expect(msg).toContain('Acme')
    expect(msg).toContain('Sales (c1)')
    expect(msg).toContain('truncated')
    expect(msg).toContain('omitted="context budget exhausted"')
    expect(msg.endsWith('Build it')).toBe(true)
  })
  it('normalises history into alternating turns ending with assistant', () => {
    const h = boundHistory([
      { role: 'assistant', content: 'orphan' },
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'c' },
      { role: 'user', content: 'd' },
    ])
    expect(h.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(h[0].content).toBe('a\n\nb')
  })
})
