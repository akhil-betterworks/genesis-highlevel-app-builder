/**
 * Preview runtime.
 *
 * Generated apps execute inside `<iframe sandbox="allow-scripts" srcdoc=…>`:
 *   - opaque origin (no allow-same-origin) → no access to the builder's cookies, storage or DOM;
 *   - CSP `connect-src 'none'` → generated code cannot fetch/XHR/WebSocket anywhere;
 *   - the only I/O channel is `window.HL`, a postMessage bridge to the parent, which forwards to
 *     the authenticated, allow-listed `/api/hl/proxy`. HighLevel tokens never enter the iframe.
 */

export interface PreviewFile {
  path: string
  content: string
}

export interface PreviewContext {
  channel: string
  location: { id: string; name: string | null } | null
}

const VUE_CDN = 'https://unpkg.com/vue@3.5.13/dist/vue.global.prod.js'
const TAILWIND_CDN = 'https://cdn.tailwindcss.com/3.4.17'

export function jsOrder(paths: string[]): string[] {
  const rank = (p: string) => (p.startsWith('lib/') ? 0 : p.startsWith('components/') ? 1 : p === 'main.js' ? 3 : 2)
  return paths.filter((p) => p.endsWith('.js')).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

const escapeScript = (s: string) => s.replace(/<\/(script)/gi, '<\\/$1')
const escapeStyle = (s: string) => s.replace(/<\/(style)/gi, '<\\/$1')

export function buildPreviewDoc(files: PreviewFile[], ctx: PreviewContext): string {
  const byPath = new Map(files.map((f) => [f.path, f.content]))
  const indexHtml = byPath.get('index.html') ?? '<div id="app"></div>'
  const bodyHtml = extractBody(indexHtml)
  const css = files
    .filter((f) => f.path.endsWith('.css'))
    .map((f) => `/* ${f.path} */\n${escapeStyle(f.content)}`)
    .join('\n')
  const scripts = jsOrder(files.map((f) => f.path))
    .map((p) => `<script>\n${escapeScript(byPath.get(p) ?? '')}\n//# sourceURL=genesis://${p}\n</script>`)
    .join('\n')

  const csp = [
    "default-src 'none'",
    `script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.tailwindcss.com`,
    "style-src 'unsafe-inline'",
    'img-src * data: blob:',
    'font-src * data:',
    "connect-src 'none'",
    "form-action 'none'",
  ].join('; ')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script>${runtimeScript(ctx)}</script>
<script src="${TAILWIND_CDN}"></script>
<script src="${VUE_CDN}"></script>
<style>body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;margin:0}${'\n'}${css}</style>
</head>
<body>
${bodyHtml}
${scripts}
</body>
</html>`
}

function extractBody(html: string): string {
  const m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)
  const inner = m ? m[1] : html
  // Strip external scripts/links the model may add despite instructions; runtime injects them.
  return inner.replace(/<script\b[^>]*\bsrc=[^>]*>\s*<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '')
}

/** Code that runs first inside the iframe: error reporting + the `HL` SDK. */
export function runtimeScript(ctx: PreviewContext): string {
  return `(() => {
const CHANNEL = ${JSON.stringify(ctx.channel)};
const LOCATION = ${JSON.stringify(ctx.location)};
const post = (msg) => parent.postMessage(Object.assign({ channel: CHANNEL }, msg), '*');
const report = (level, args) => { try { post({ type: 'preview:log', level, message: args.map(a => a instanceof Error ? (a.stack || a.message) : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').slice(0, 2000) }); } catch (_) {} };
window.addEventListener('error', (e) => report('error', [e.message + (e.filename ? ' (' + e.filename.replace('genesis://','') + ':' + e.lineno + ')' : '')]));
window.addEventListener('unhandledrejection', (e) => report('error', ['Unhandled: ' + ((e.reason && (e.reason.message || e.reason)) || 'rejection')]));
['error','warn'].forEach((lvl) => { const o = console[lvl].bind(console); console[lvl] = (...a) => { report(lvl, a); o(...a); }; });

class HLError extends Error { constructor(status, message, data) { super(message); this.name = 'HLError'; this.status = status; this.data = data; } }
const pending = new Map(); let seq = 0;
window.addEventListener('message', (e) => {
  const d = e.data; if (!d || d.channel !== CHANNEL || d.type !== 'hl:response' || e.source !== parent) return;
  const p = pending.get(d.id); if (!p) return; pending.delete(d.id);
  d.ok ? p.resolve(d.data) : p.reject(new HLError(d.status, d.message, d.data));
});
function request(method, path, opts) {
  opts = opts || {};
  if (!LOCATION) return Promise.reject(new HLError(412, 'HighLevel is not connected. Connect it from the Genesis dashboard.'));
  return new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject });
    post({ type: 'hl:request', id, method, path, query: opts.query, body: opts.body });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new HLError(504, 'HighLevel request timed out')); } }, 30000);
  });
}
const clean = (o) => { const r = {}; Object.keys(o || {}).forEach(k => { if (o[k] !== undefined && o[k] !== null && o[k] !== '') r[k] = o[k]; }); return r; };

const contacts = {
  list: (p) => { p = p || {}; return request('GET', '/contacts/', { query: clean({ query: p.query, limit: p.limit || 20, startAfterId: p.startAfterId, startAfter: p.startAfter }) }); },
  async listAll(p) {
    p = p || {}; const max = p.max || 200; let out = []; let cursor = {};
    while (out.length < max) {
      const page = await contacts.list({ query: p.query, limit: Math.min(100, max - out.length), ...cursor });
      const items = page.contacts || []; out = out.concat(items);
      const m = page.meta || {};
      if (!items.length || !m.startAfterId || out.length >= (m.total || Infinity)) break;
      cursor = { startAfterId: m.startAfterId, startAfter: m.startAfter };
    }
    return out.slice(0, max);
  },
  get: (id) => request('GET', '/contacts/' + encodeURIComponent(id)),
  create: (body) => request('POST', '/contacts/', { body }),
  update: (id, body) => request('PUT', '/contacts/' + encodeURIComponent(id), { body }),
  appointments: (id) => request('GET', '/contacts/' + encodeURIComponent(id) + '/appointments'),
};
const conversations = {
  search: (p) => { p = p || {}; return request('GET', '/conversations/search', { query: clean({ query: p.query, contactId: p.contactId, status: p.status, limit: p.limit || 20, startAfterDate: p.startAfterDate, sort: p.sort || 'desc', sortBy: p.sortBy || 'last_message_date' }) }); },
  get: (id) => request('GET', '/conversations/' + encodeURIComponent(id)),
  messages: (id, p) => { p = p || {}; return request('GET', '/conversations/' + encodeURIComponent(id) + '/messages', { query: clean({ limit: p.limit || 20, lastMessageId: p.lastMessageId }) }); },
  send: (body) => request('POST', '/conversations/messages', { body }),
};
const calendars = {
  list: () => request('GET', '/calendars/'),
  get: (id) => request('GET', '/calendars/' + encodeURIComponent(id)),
  events: (p) => request('GET', '/calendars/events', { query: clean({ calendarId: p.calendarId, startTime: String(p.startTime), endTime: String(p.endTime) }) }),
  async upcoming(p) {
    p = p || {}; const days = p.days || 30; const limit = p.limit || 50;
    const now = Date.now(); const end = now + days * 864e5;
    const { calendars: cals = [] } = await calendars.list();
    const results = await Promise.allSettled(cals.map(c => calendars.events({ calendarId: c.id, startTime: now, endTime: end })));
    const events = results.flatMap((r, i) => r.status === 'fulfilled' ? (r.value.events || []).map(ev => Object.assign({ calendarName: cals[i].name }, ev)) : []);
    events.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    return events.slice(0, limit);
  },
  freeSlots: (id, p) => request('GET', '/calendars/' + encodeURIComponent(id) + '/free-slots', { query: clean({ startDate: String(p.startDate), endDate: String(p.endDate), timezone: p.timezone }) }),
};
function onChange(resource, cb, opts) {
  const interval = Math.max(10000, (opts && opts.intervalMs) || 30000);
  const fetchers = {
    contacts: () => contacts.list({ limit: 20 }).then(r => r.contacts || []),
    conversations: () => conversations.search({ limit: 20 }).then(r => r.conversations || []),
    appointments: () => calendars.upcoming({ days: 30, limit: 50 }),
  };
  const f = fetchers[resource]; if (!f) throw new Error('Unknown resource ' + resource);
  let last = null; let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try { const items = await f(); const sig = JSON.stringify(items.map(i => [i.id, i.dateUpdated || i.lastMessageDate || i.startTime || ''])); if (last !== null && sig !== last) cb({ type: resource + '.changed', items }); last = sig; } catch (e) { report('warn', ['HL.onChange: ' + e.message]); }
    if (!stopped) setTimeout(tick, interval);
  };
  tick();
  return () => { stopped = true; };
}
window.HLError = HLError;
window.HL = Object.freeze({ location: LOCATION, isConnected: () => !!LOCATION, request, contacts, conversations, calendars, onChange });
})();`
}

/**
 * Parent-side bridge: validates the message came from *our* iframe and channel, then proxies.
 * Returns a disposer.
 */
export function attachBridge(
  iframe: () => HTMLIFrameElement | null,
  channel: string,
  handlers: {
    request: (req: { method: string; path: string; query?: unknown; body?: unknown }) => Promise<{ status: number; data: unknown }>
    log: (level: string, message: string) => void
  },
): () => void {
  const listener = async (e: MessageEvent) => {
    const frame = iframe()
    if (!frame || e.source !== frame.contentWindow) return
    const d = e.data
    if (!d || d.channel !== channel) return
    if (d.type === 'preview:log') return handlers.log(String(d.level), String(d.message))
    if (d.type !== 'hl:request') return
    const reply = (msg: Record<string, unknown>) => frame.contentWindow?.postMessage({ channel, type: 'hl:response', id: d.id, ...msg }, '*')
    try {
      const res = await handlers.request({ method: String(d.method), path: String(d.path), query: d.query, body: d.body })
      if (res.status >= 400) {
        const m = (res.data as { message?: string | string[] })?.message
        reply({ ok: false, status: res.status, message: Array.isArray(m) ? m.join(', ') : m ?? `HighLevel API error ${res.status}`, data: res.data })
        handlers.log('warn', `HL ${d.method} ${d.path} → ${res.status}`)
      } else {
        reply({ ok: true, data: res.data })
      }
    } catch (err) {
      const e2 = err as { status?: number; message?: string }
      reply({ ok: false, status: e2.status ?? 500, message: e2.message ?? 'Request failed' })
      handlers.log('error', `HL ${d.method} ${d.path} failed: ${e2.message}`)
    }
  }
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}
