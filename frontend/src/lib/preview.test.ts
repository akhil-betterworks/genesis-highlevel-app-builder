import { describe, expect, it } from 'vitest'
import { buildPreviewDoc, jsOrder } from './preview'

describe('jsOrder', () => {
  it('orders lib → components → others → main.js and skips non-js', () => {
    expect(jsOrder(['main.js', 'app.js', 'components/b.js', 'lib/a.js', 'index.html', 'components/a.js'])).toEqual([
      'lib/a.js',
      'components/a.js',
      'components/b.js',
      'app.js',
      'main.js',
    ])
  })
})

describe('buildPreviewDoc', () => {
  const ctx = { channel: 'c1', location: { id: 'loc', name: 'Acme' } }

  it('locks network access with CSP and injects the HL runtime', () => {
    const doc = buildPreviewDoc([{ path: 'main.js', content: 'console.log(1)' }], ctx)
    expect(doc).toContain("connect-src 'none'")
    expect(doc).toContain('c1')
    expect(doc).toContain('console.log(1)')
  })

  it('escapes closing script tags in user code', () => {
    const doc = buildPreviewDoc([{ path: 'main.js', content: 'const s = "</script><img src=x>"' }], ctx)
    expect(doc).not.toContain('"</script><img')
  })
})
