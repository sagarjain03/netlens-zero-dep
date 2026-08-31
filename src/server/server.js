/**
 * server.js — node:http, a route table, and a static handler. That is the
 * entire web server. No express, no middleware stack, no body-parser.
 */
import { createServer } from 'node:http'
import { createRouter } from './routes.js'
import { createStaticHandler } from './static.js'
import { sendJson } from './respond.js'
import { handleDns } from '../api/dns.js'
import { handleDecode } from '../api/decode.js'
import { handleSys } from '../api/sys.js'
import { handleTraceStream } from '../api/trace.js'
import { handleTls } from '../api/tls.js'
import { handleHttp } from '../api/http.js'
import { handleJourney } from '../api/journey.js'
import { handleAsk, isConfigured as askConfigured } from '../api/ask.js'

export function createApp({ webRoot, assets = null, version = '1.0.0' }) {
  const router = createRouter()
  const serveStatic = createStaticHandler({ root: webRoot, assets })

  // Health / introspection — also the first thing to hit when something is wrong.
  router.add('GET /api/health', ({ res }) => {
    sendJson(res, {
      ok: true,
      app: 'netlens',
      version,
      node: process.version,
      platform: process.platform,
      mode: assets ? 'bundled' : 'dev',
      ask: askConfigured() ? 'ready' : 'offline',
      routes: router.list(),
    })
  })

  // Chapter 2 — every dig in the browser terminal lands here.
  router.add('POST /api/dns', handleDns)

  // The byte editor's live preview: parse bytes without transmitting them.
  router.add('POST /api/decode', handleDecode)

  // Chapters 1 and 3 — the OS's own network tools, parsed by us.
  router.add('POST /api/sys', handleSys)

  // Chapter 3 — traceroute takes half a minute, so its hops stream in as they
  // are discovered rather than arriving all at once at the end.
  router.add('GET /api/trace/stream', handleTraceStream)

  // Chapter 5 — our own ClientHello on a bare socket, and our own certificate parser.
  router.add('POST /api/tls', handleTls)

  // Chapter 6 — our own request bytes, our own response parser.
  router.add('POST /api/http', handleHttp)

  // Chapter 7 — every protocol above, chained against one URL.
  router.add('POST /api/journey', handleJourney)

  // Optional, and off unless GROQ_API_KEY is set. With no key it answers
  // honestly rather than failing, so the route is always registered.
  router.add('POST /api/ask', handleAsk)

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const urlPath = decodeURIComponent(url.pathname)

    if (await router.handle(req, res, urlPath, url.searchParams)) return
    if (await serveStatic(req, res, urlPath)) return

    // Unknown /api/* is an error; anything else falls back to the SPA shell so
    // deep links like /#/ch/2/tier/3 survive a refresh.
    if (urlPath.startsWith('/api/')) {
      sendJson(res, { ok: false, error: `no route for ${req.method} ${urlPath}` }, 404)
      return
    }
    if (await serveStatic(req, res, '/index.html')) return

    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404')
  })

  return { server, router }
}

export function listen(server, { port, host = '127.0.0.1' }) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => resolve(server.address()))
  })
}
