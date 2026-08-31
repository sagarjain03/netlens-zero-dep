/**
 * api/index.js — the Vercel adapter, and the only file that knows Vercel exists.
 *
 * Locally `node run.js` owns a real node:http server. On Vercel there is no
 * long-lived process: the platform hands us one (req, res) pair per invocation.
 * Both want the same thing — the request listener that createApp() built — so
 * this file borrows it and forwards. No route is re-declared here; add an
 * endpoint in src/server/server.js and it is live in both places.
 *
 * Static files are NOT served here. vercel.json points the CDN at web/, so the
 * asset map is empty and the static handler always declines, which leaves the
 * router as the only thing that can answer.
 */
import { Readable } from 'node:stream'
import { createRequire } from 'node:module'
import { createApp } from '../src/server/server.js'

const { version } = createRequire(import.meta.url)('../package.json')

// assets: an empty Map keeps the static handler in bundled mode, so it never
// touches a filesystem that is read-only and does not contain web/ anyway.
const { server } = createApp({ assets: new Map(), version })

/**
 * Vercel's Node helpers read the body into req.body before we ever see it,
 * which leaves readJsonBody() waiting on an 'end' that already fired. When that
 * has happened, replay the bytes down a fresh stream wearing the request's
 * identity. With NODEJS_HELPERS=0 (set in vercel.json) req.body is undefined
 * and the original request is passed straight through.
 */
function withReadableBody(req) {
  if (req.body === undefined || req.body === null) return req

  const raw = Buffer.isBuffer(req.body) ? req.body
    : typeof req.body === 'string' ? Buffer.from(req.body, 'utf8')
      : Buffer.from(JSON.stringify(req.body), 'utf8')

  const replay = new Readable({ read() {} })
  replay.push(raw)
  replay.push(null)

  return Object.assign(replay, {
    method: req.method,
    url: req.url,
    headers: req.headers,
    httpVersion: req.httpVersion,
    socket: req.socket,
  })
}

export default function handler(req, res) {
  // createServer() registers its listener as a 'request' listener; emitting one
  // runs the whole app without a port ever being bound.
  server.emit('request', withReadableBody(req), res)
}
