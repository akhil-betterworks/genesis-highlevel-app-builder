import { describe, expect, it } from 'vitest'
import { SseParser } from './sse'

describe('SseParser', () => {
  it('parses frames split across chunks', () => {
    const p = new SseParser()
    expect(p.push('event: token\nda')).toEqual([])
    expect(p.push('ta: {"text":"hi"}\n\n')).toEqual([{ event: 'token', data: { text: 'hi' }, id: undefined }])
  })

  it('ignores comments/heartbeats and handles CRLF + multi-line data', () => {
    const p = new SseParser()
    const out = p.push(': ping\r\n\r\nid: 7\r\ndata: a\r\ndata: b\r\n\r\n')
    expect(out).toEqual([{ event: 'message', data: 'a\nb', id: '7' }])
  })

  it('emits multiple frames from one chunk', () => {
    const p = new SseParser()
    const out = p.push('event: a\ndata: 1\n\nevent: b\ndata: 2\n\n')
    expect(out.map((m) => [m.event, m.data])).toEqual([
      ['a', 1],
      ['b', 2],
    ])
  })
})
