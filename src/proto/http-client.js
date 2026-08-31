/**
 * http-client.js — writes our request bytes onto a socket and reads the reply.
 * Layer 1: the only file in the HTTP path that touches the network.
 *
 * `node:tls` handles the encryption, which is honest and stated in the README:
 * chapter 5 builds a ClientHello by hand to show what a handshake contains, but
 * completing one means implementing the key schedule, and that is not what any
 * of this teaches. Everything above the encryption — the request line, the
 * headers, the chunked body — is ours.
 *
 * The timings collected here are what chapter 7 renders as a cost breakdown,
 * and they are the reason a learner discovers that a third of a page load can
 * be handshake rather than content.
 */
import net from 'node:net'
import tls from 'node:tls'
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib'
import { buildRequest, parseResponse, parseRequest } from './http.js'
import { validateHost } from '../sys/exec.js'

const MAX_BODY = 2 * 1024 * 1024

/** Split a URL without a URL parser dependency — `URL` is a browser/node global. */
export function parseUrl(input) {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`
  let url
  try {
    url = new URL(withScheme)
  } catch {
    throw new Error(`"${input}" is not a URL`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${url.protocol} is not supported — http and https only`)
  }
  return {
    secure: url.protocol === 'https:',
    host: validateHost(url.hostname),
    port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
    path: (url.pathname || '/') + (url.search || ''),
  }
}

/**
 * Fetch a URL with our own request bytes.
 *
 * @returns {Promise<{request, response, timings, localPort, peer, cert, secure}>}
 */
export function fetchRaw({
  url,
  method = 'GET',
  headers = {},
  keepAlive = false,
  ip = null,               // skip DNS: chapter 7 has already resolved it
  timeoutMs = 12_000,
} = {}) {
  const target = typeof url === 'string' ? parseUrl(url) : url
  const request = buildRequest({
    host: target.host,
    path: target.path,
    method,
    headers,
    keepAlive,
  })

  return new Promise((resolve, reject) => {
    const t0 = performance.now()
    let connectedAt = null
    let secureAt = null
    let firstByteAt = null

    const chunks = []
    let size = 0
    let settled = false

    const connectOpts = {
      host: ip ?? target.host,
      port: target.port,
      timeout: timeoutMs,
      // The certificate must still be checked against the name, not the IP we
      // dialled — the same distinction chapter 5 is about.
      ...(target.secure ? { servername: target.host } : {}),
    }

    const socket = target.secure
      ? tls.connect(connectOpts)
      : net.connect(connectOpts)

    const finish = (fn, arg) => {
      if (settled) return
      settled = true
      socket.destroy()
      fn(arg)
    }

    const done = () => {
      const response = Buffer.concat(chunks)
      const now = performance.now()
      finish(resolve, {
        request,
        response,
        secure: target.secure,
        peer: `${socket.remoteAddress ?? ip ?? target.host}:${target.port}`,
        localPort: socket.localPort ?? null,
        cert: target.secure ? safeCert(socket) : null,
        timings: {
          connectMs: connectedAt != null ? round(connectedAt - t0) : null,
          tlsMs: secureAt != null && connectedAt != null ? round(secureAt - connectedAt) : null,
          ttfbMs: firstByteAt != null ? round(firstByteAt - (secureAt ?? connectedAt ?? t0)) : null,
          transferMs: firstByteAt != null ? round(now - firstByteAt) : null,
          totalMs: round(now - t0),
        },
      })
    }

    socket.on('connect', () => { connectedAt = performance.now() })
    socket.on('secureConnect', () => {
      secureAt = performance.now()
      socket.write(request)
    })
    if (!target.secure) socket.on('connect', () => socket.write(request))

    socket.on('data', (chunk) => {
      if (firstByteAt == null) firstByteAt = performance.now()
      chunks.push(chunk)
      size += chunk.length
      if (size > MAX_BODY) done()
    })

    // `Connection: close` means the server hangs up when it is finished, so an
    // ordinary end is the successful case.
    socket.on('end', done)
    socket.on('close', () => (chunks.length ? done() : undefined))
    socket.on('timeout', () => (chunks.length ? done() : finish(reject,
      Object.assign(new Error(`no reply from ${target.host} after ${timeoutMs}ms`), { code: 'ETIMEDOUT' }))))
    socket.on('error', (err) => (chunks.length ? done() : finish(reject, err)))
  })
}

const round = (n) => Math.round(n * 10) / 10

function safeCert(socket) {
  try {
    const c = socket.getPeerCertificate()
    if (!c || !c.subject) return null
    return { cn: c.subject.CN ?? null, issuer: c.issuer?.O ?? c.issuer?.CN ?? null, validTo: c.valid_to ?? null }
  } catch {
    return null
  }
}

/**
 * Decompress a body if the server compressed it anyway. We ask for identity, so
 * this is the exception rather than the rule — but some servers ignore that.
 */
export function decompress(body, encoding) {
  if (!encoding) return { body, decompressed: false }
  try {
    const enc = encoding.toLowerCase()
    if (enc.includes('gzip')) return { body: gunzipSync(body), decompressed: true, encoding: 'gzip' }
    if (enc.includes('deflate')) return { body: inflateSync(body), decompressed: true, encoding: 'deflate' }
    if (enc.includes('br')) return { body: brotliDecompressSync(body), decompressed: true, encoding: 'br' }
  } catch (err) {
    return { body, decompressed: false, error: err.message }
  }
  return { body, decompressed: false }
}

/** fetchRaw plus decoding of both directions. */
export async function request(opts) {
  const wire = await fetchRaw(opts)
  const parsed = parseResponse(wire.response)
  const { body, decompressed } = decompress(parsed.body, parsed.encoding)
  return {
    ...wire,
    requestMessage: parseRequest(wire.request),
    responseMessage: { ...parsed, body, decompressed },
  }
}
