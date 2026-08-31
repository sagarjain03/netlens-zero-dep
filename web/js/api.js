/**
 * api.js — talks to our own server. Replaces axios / node-fetch on the client.
 * Browser `fetch` and `EventSource` are both native; that is why SSE was chosen
 * over WebSockets for the live traceroute stream (docs/01 § Why SSE).
 */
import { set } from './state.js'

async function request(path, body) {
  set({ busy: true })
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    const json = await res.json().catch(() => ({ ok: false, error: `bad response (${res.status})` }))
    if (!json.ok) throw Object.assign(new Error(json.error || 'request failed'), { code: json.code })
    return json
  } finally {
    set({ busy: false })
  }
}

export const api = {
  health: () => fetch('/api/health').then((r) => r.json()),
  dns: (opts) => request('/api/dns', opts),
  tls: (opts) => request('/api/tls', opts),
  http: (opts) => request('/api/http', opts),
  sys: (opts) => request('/api/sys', opts),
  decode: (opts) => request('/api/decode', opts),
  journey: (opts) => request('/api/journey', opts),
}

/**
 * Subscribe to a server-sent event stream.
 * @returns {{close:()=>void}}
 */
export function stream(path, { onEvent, onDone, onError } = {}) {
  const src = new EventSource(path)
  src.onmessage = (e) => {
    let data
    try { data = JSON.parse(e.data) } catch { return }
    if (data.done) {
      src.close()
      onDone?.(data)
    } else {
      onEvent?.(data)
    }
  }
  src.onerror = (e) => {
    src.close()
    onError?.(e)
  }
  return { close: () => src.close() }
}
