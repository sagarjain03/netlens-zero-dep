/**
 * respond.js — the single response envelope every endpoint uses.
 *
 * Why one shape for every protocol: the browser renders `events` on the canvas
 * and `packets` in the inspector. If /api/dns, /api/tls, /api/http and /api/sys
 * all return the same envelope, the renderer is written once and every new
 * chapter is free. See docs/01-ARCHITECTURE.md § API contract.
 */

/** An envelope carries a timeline (for the canvas) and packets (for the inspector). */
export function envelope({ events = [], packets = [], durationMs = 0, meta = {}, text = '' } = {}) {
  return { ok: true, durationMs: round(durationMs), events, packets, meta, text }
}

/**
 * One timeline event = one arrow on the canvas + one row in the timeline.
 * `narration` is the plain-language line a beginner reads instead of the hex.
 */
export function event({ t, dir, from, to, proto, bytes, label, narration = '', packetId = null, note = '' }) {
  return { t: round(t), dir, from, to, proto, bytes, label, narration, packetId, note }
}

/**
 * One packet = the raw bytes plus a field tree.
 * Every leaf in `tree` carries a `span` so the hex view, bit view and field tree
 * stay in sync from a single source of truth.
 */
export function packet({ id, dir, proto, bytes, tree = [], editable = false, note = '' }) {
  return {
    id,
    dir,
    proto,
    hex: Buffer.from(bytes).toString('hex'),
    length: bytes.length,
    tree,
    editable,
    note,
  }
}

const round = (n) => Math.round(n * 10) / 10

// ── HTTP helpers ────────────────────────────────────────────────────────────

export function sendJson(res, body, status = 200) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
  })
  res.end(buf)
}

export function sendError(res, message, status = 400, extra = {}) {
  sendJson(res, { ok: false, error: message, ...extra }, status)
}

/** Read a JSON request body with a hard size cap (no body-parser needed). */
export function readJsonBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}
