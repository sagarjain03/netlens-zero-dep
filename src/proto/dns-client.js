/**
 * dns-client.js — sends the bytes. Layer 1: this is the only file in the DNS
 * path that touches the network.
 *
 * `node:dgram` puts exactly the buffer we hand it on the wire, unchanged. That
 * one property is the whole reason the byte editor is real rather than a
 * simulation: when a learner edits a byte, `rawOverride` carries their exact
 * buffer here and it is what leaves the machine.
 */
import dgram from 'node:dgram'
import { encode, decode } from './dns.js'

export const RESOLVERS = {
  // 1.1.1.1 is the default: measured at 6.5ms vs 8.8.8.8's 13.1ms on the build
  // machine (docs/07-PREFLIGHT-RESULTS.md). Comparing them is a tier-3 exercise.
  cloudflare: { ip: '1.1.1.1', label: 'Cloudflare' },
  google: { ip: '8.8.8.8', label: 'Google' },
  quad9: { ip: '9.9.9.9', label: 'Quad9' },
}
export const DEFAULT_RESOLVER = RESOLVERS.cloudflare.ip

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export function resolveServer(input) {
  if (!input) return DEFAULT_RESOLVER
  const named = RESOLVERS[String(input).toLowerCase()]
  if (named) return named.ip
  const m = IPV4.exec(String(input))
  if (m && m.slice(1).every((o) => Number(o) <= 255)) return input
  throw new Error(`"${input}" is not an IPv4 address or a known resolver name`)
}

export function resolverLabel(ip) {
  return Object.values(RESOLVERS).find((r) => r.ip === ip)?.label ?? ip
}

/**
 * Send one DNS query and wait for one reply.
 *
 * @param {object} opts
 * @param {string}  [opts.domain]        required unless rawOverride is given
 * @param {string}  [opts.type='A']
 * @param {string}  [opts.server]        ip or resolver name
 * @param {number}  [opts.port=53]
 * @param {number}  [opts.timeoutMs=3000]
 * @param {Buffer}  [opts.rawOverride]   exact bytes to transmit — the byte editor
 * @param {number}  [opts.expectId]      id the caller is waiting for; defaults to
 *                                       the id in the packet we sent. The byte
 *                                       editor passes the ORIGINAL id here, so
 *                                       editing the id field produces the same
 *                                       mismatch a resolver sees from a forged reply.
 * @returns {Promise<{request, response, durationMs, server, port, localPort, idMatch}>}
 */
export function query({
  domain,
  type = 'A',
  server,
  port = 53,
  timeoutMs = 3000,
  rawOverride = null,
  expectId = null,
  id,
} = {}) {
  const target = resolveServer(server)
  const request = rawOverride ? Buffer.from(rawOverride) : encode({ domain, type, id })

  if (request.length < 12) throw new Error('a DNS message needs at least a 12-byte header')
  if (request.length > 512) throw new Error(`query is ${request.length} bytes; over 512 needs TCP`)

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4')
    let settled = false
    const started = performance.now()

    const finish = (fn, arg) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { socket.close() } catch { /* already closing */ }
      fn(arg)
    }

    const timer = setTimeout(() => {
      finish(reject, Object.assign(
        new Error(`no reply from ${target}:${port} after ${timeoutMs}ms`),
        { code: 'ETIMEDOUT', server: target },
      ))
    }, timeoutMs)

    socket.on('message', (response) => {
      const durationMs = performance.now() - started

      // An id mismatch is NOT an error here — it is the lesson. The reply is
      // returned along with the flag so the UI can show "received but rejected",
      // which is exactly what a real resolver does to block spoofed answers.
      const sentId = request.readUInt16BE(0)
      const gotId = response.length >= 2 ? response.readUInt16BE(0) : -1
      const waitingFor = expectId ?? sentId

      finish(resolve, {
        request,
        response,
        durationMs,
        server: target,
        port,
        localPort: safeLocalPort(socket),
        sentId,
        gotId,
        expectId: waitingFor,
        idMatch: waitingFor === gotId,
      })
    })

    socket.on('error', (err) => finish(reject, err))

    socket.send(request, port, target, (err) => {
      if (err) finish(reject, err)
    })
  })
}

function safeLocalPort(socket) {
  try { return socket.address().port } catch { return null }
}

/** query() plus decoding of both directions. What the API handler actually calls. */
export async function lookup(opts) {
  const wire = await query(opts)
  return {
    ...wire,
    requestMessage: decode(wire.request, { lang: opts.lang }),
    responseMessage: decode(wire.response, { lang: opts.lang }),
  }
}
