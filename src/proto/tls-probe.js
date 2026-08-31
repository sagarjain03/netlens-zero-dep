/**
 * tls-probe.js — sends a ClientHello on a bare TCP socket and reads what comes
 * back. Layer 1: the only file in the TLS path that touches the network.
 *
 * We stop after the server's first flight. Completing the handshake would mean
 * implementing the key schedule, and chapter 5 is about what the server tells
 * you before any of that — which version it chose, which cipher, and who it
 * claims to be.
 *
 * `sni` is the parameter that makes the chapter work. Connecting to one IP while
 * asking for a different hostname is a real, legal thing to do, and it is how a
 * learner discovers that one address serves thousands of sites.
 */
import net from 'node:net'
import { buildClientHello, decode } from './tls.js'
import { validateHost } from '../sys/exec.js'

const DEFAULT_PORT = 443
const MAX_BYTES = 64 * 1024      // a chain of certificates, and no more
const SETTLE_MS = 350            // quiet time that means "the flight is over"

/**
 * @param {object} opts
 * @param {string}  opts.host          where to connect
 * @param {string|null} [opts.sni]     what name to ask for; defaults to host,
 *                                     null omits the extension entirely
 * @param {number}  [opts.port=443]
 * @param {number}  [opts.timeoutMs=8000]
 * @param {Buffer}  [opts.rawOverride] exact ClientHello bytes — the byte editor
 * @returns {Promise<{request, response, durationMs, host, sni, localPort}>}
 */
export function probe({
  host,
  sni,
  port = DEFAULT_PORT,
  timeoutMs = 8000,
  rawOverride = null,
  version,
  ciphers,
} = {}) {
  const target = validateHost(host)
  // `undefined` means "use the host"; an explicit null means "send no SNI".
  const serverName = sni === undefined ? target : sni
  if (serverName) validateHost(serverName)

  const request = rawOverride
    ? Buffer.from(rawOverride)
    : buildClientHello({ sni: serverName, version, ciphers })

  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: target, port, timeout: timeoutMs })
    const chunks = []
    let size = 0
    let settle = null
    let settled = false
    const started = performance.now()

    const finish = (fn, arg) => {
      if (settled) return
      settled = true
      clearTimeout(settle)
      socket.destroy()
      fn(arg)
    }

    const done = () => finish(resolve, {
      request,
      response: Buffer.concat(chunks),
      durationMs: performance.now() - started,
      host: target,
      port,
      sni: serverName,
      localPort: socket.localPort ?? null,
    })

    socket.on('connect', () => socket.write(request))

    socket.on('data', (chunk) => {
      chunks.push(chunk)
      size += chunk.length
      if (size >= MAX_BYTES) { done(); return }
      // The server sends its flight in several packets and then simply waits
      // for us. A short quiet period is what marks the end of it.
      clearTimeout(settle)
      settle = setTimeout(done, SETTLE_MS)
    })

    // A refusal is a result, not a failure: an alert is exactly what removing
    // SNI from a Cloudflare host produces, and the learner should see it.
    socket.on('end', () => (chunks.length ? done() : finish(reject,
      Object.assign(new Error(`${target}:${port} closed the connection without replying`), { code: 'ECONNRESET' }))))

    socket.on('timeout', () => (chunks.length ? done() : finish(reject,
      Object.assign(new Error(`no reply from ${target}:${port} after ${timeoutMs}ms`), { code: 'ETIMEDOUT' }))))

    socket.on('error', (err) => (chunks.length ? done() : finish(reject, err)))
  })
}

/** probe() plus decoding of both directions. */
export async function inspect(opts) {
  const wire = await probe(opts)
  return {
    ...wire,
    requestMessage: decode(wire.request, { lang: opts.lang }),
    responseMessage: decode(wire.response, { lang: opts.lang }),
  }
}
