import { describe, expect, it } from 'vitest'
import { matchRoute } from '../src/highlevel/api'

describe('HighLevel proxy allow-list', () => {
  it.each([
    ['GET', '/contacts/'],
    ['POST', '/contacts/search'],
    ['GET', '/contacts/abc123'],
    ['GET', '/conversations/search'],
    ['GET', '/conversations/c1/messages'],
    ['POST', '/conversations/messages'],
    ['GET', '/calendars/'],
    ['GET', '/calendars/events'],
    ['GET', '/calendars/cal_1/free-slots'],
  ])('allows %s %s', (m, p) => {
    expect(() => matchRoute(m, p)).not.toThrow()
  })

  it.each([
    ['DELETE', '/contacts/abc'],
    ['GET', '/users/'],
    ['GET', '/oauth/token'],
    ['GET', '/contacts/../oauth'],
    ['GET', '//evil.com/contacts'],
    ['GET', 'contacts'],
    ['POST', '/locations/abc'],
  ])('rejects %s %s', (m, p) => {
    expect(() => matchRoute(m, p)).toThrow()
  })

  it('pins API versions per resource', () => {
    expect(matchRoute('GET', '/contacts/').version).toBe('2021-07-28')
    expect(matchRoute('GET', '/calendars/').version).toBe('2021-04-15')
    expect(matchRoute('GET', '/calendars/').locationIn).toBe('query')
    expect(matchRoute('POST', '/contacts/search').locationIn).toBe('body')
  })
})
