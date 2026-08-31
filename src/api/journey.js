/**
 * api/journey.js — chapter 7. One URL, every protocol, in order.
 *
 * Nothing new is built here. Chapters 2, 3, 5 and 6 already produced all of
 * this; the journey simply runs them back to back against one address and lays
 * the result on a single timeline. That is the point of the chapter: the pieces
 * a learner met separately were always one sequence.
 *
 * The cost breakdown is where it lands. Watching a third of a page load go to a
 * TLS handshake is the moment keep-alive, HTTP/2 and session resumption stop
 * being acronyms and start being obvious.
 */
import { lookup } from '../proto/dns-client.js'
import { request as httpRequest, parseUrl } from '../proto/http-client.js'
import { previewBody } from '../proto/http.js'
import { envelope, event, packet, sendJson } from '../server/respond.js'

export async function handleJourney({ res, body }) {
  const lang = body.lang === 'hi' ? 'hi' : 'en'
  if (!body.url) throw new Error('url is required')

  const target = parseUrl(body.url)
  const started = performance.now()

  // ── stage 1: the name becomes a number ────────────────────────────────────
  const dns = await lookup({ domain: target.host, type: 'A', server: body.server, lang })
  const answer = dns.responseMessage.answers.find((a) => a.typeName === 'A')
  if (!answer) {
    throw new Error(`${target.host} has no IPv4 address — nothing to connect to`)
  }
  const ip = answer.value
  const dnsMs = dns.durationMs

  // ── stages 2-4: connect, handshake, request ───────────────────────────────
  // The IP is passed through so this does not resolve the name a second time.
  const http = await httpRequest({
    url: target,
    method: (body.method ?? 'GET').toUpperCase(),
    ip,
    keepAlive: false,
    timeoutMs: Math.min(Number(body.timeoutMs) || 15000, 25000),
  })

  const t = http.timings
  const totalMs = Math.round((performance.now() - started) * 10) / 10

  // Each stage's start, laid end to end. The canvas animates these in order.
  const at = {
    dnsOut: 0,
    dnsIn: dnsMs,
    connect: dnsMs + (t.connectMs ?? 0),
    tls: dnsMs + (t.connectMs ?? 0) + (t.tlsMs ?? 0),
    httpOut: dnsMs + (t.connectMs ?? 0) + (t.tlsMs ?? 0),
    httpIn: dnsMs + (t.connectMs ?? 0) + (t.tlsMs ?? 0) + (t.ttfbMs ?? 0),
  }

  const resolver = dns.server
  const peer = `${ip}:${target.port}`
  const resp = http.responseMessage

  const events = [
    event({
      t: at.dnsOut, dir: 'out', from: 'you', to: `${resolver}:53`, proto: 'UDP',
      bytes: dns.request.length, label: 'DNS query', packetId: 'dq',
      narration: `Your machine does not know where ${target.host} is, so the first thing it does is ask.`,
    }),
    event({
      t: at.dnsIn, dir: 'in', from: `${resolver}:53`, to: 'you', proto: 'UDP',
      bytes: dns.response.length, label: 'DNS response', packetId: 'dr',
      narration: `${target.host} is ${ip}. That took ${round(dnsMs)} ms, and now there is an address to dial.`,
    }),
    event({
      t: at.connect, dir: 'out', from: 'you', to: peer, proto: 'TCP',
      bytes: 0, label: 'TCP connect',
      narration: `A TCP connection opened to ${peer} in ${round(t.connectMs)} ms. Your OS did the three-way handshake; from here there is a reliable pipe.`,
    }),
  ]

  if (target.secure) {
    events.push(event({
      t: at.tls, dir: 'in', from: peer, to: 'you', proto: 'TLS',
      bytes: 0, label: 'TLS handshake',
      narration: `The handshake took ${round(t.tlsMs)} ms — keys agreed, certificate checked${http.cert?.cn ? ` for ${http.cert.cn}` : ''}. Only now can anything be said in private.`,
    }))
  }

  events.push(
    event({
      t: at.httpOut, dir: 'out', from: 'you', to: peer,
      proto: target.secure ? 'HTTPS' : 'HTTP',
      bytes: http.request.length, label: `${http.requestMessage.method} ${http.requestMessage.path}`,
      packetId: 'hq',
      narration: `And the request itself is ${http.request.length} bytes of plain text. Everything above was setup.`,
    }),
    event({
      t: at.httpIn, dir: 'in', from: peer, to: 'you',
      proto: target.secure ? 'HTTPS' : 'HTTP',
      bytes: http.response.length, label: `${resp.status ?? '???'} ${resp.reason ?? ''}`.trim(),
      packetId: 'hr',
      narration: journeyNarration({ target, ip, totalMs, breakdown: breakdownOf(dnsMs, t, target.secure), resp }),
    }),
  )

  const breakdown = breakdownOf(dnsMs, t, target.secure)

  sendJson(res, envelope({
    durationMs: totalMs,
    events,
    packets: [
      packet({ id: 'dq', dir: 'out', proto: 'DNS/UDP', bytes: dns.request, tree: dns.requestMessage.tree, editable: true }),
      packet({ id: 'dr', dir: 'in', proto: 'DNS/UDP', bytes: dns.response, tree: dns.responseMessage.tree }),
      packet({ id: 'hq', dir: 'out', proto: 'HTTP', bytes: http.request, tree: http.requestMessage.tree, editable: true }),
      packet({
        id: 'hr', dir: 'in', proto: 'HTTP',
        bytes: http.response.subarray(0, 4096),
        tree: resp.tree,
        note: http.response.length > 4096 ? `showing the first 4096 of ${http.response.length} bytes` : '',
      }),
    ],
    meta: {
      url: body.url,
      host: target.host,
      ip,
      port: target.port,
      secure: target.secure,
      resolver,
      resolverLabel: dns.server,
      localPort: http.localPort,
      status: resp.status,
      reason: resp.reason,
      contentType: resp.contentType,
      bodyBytes: resp.body.length,
      totalBytes: dns.request.length + dns.response.length + http.request.length + http.response.length,
      roundTrips: target.secure ? 4 : 3,
      protocols: ['DNS', 'TCP', ...(target.secure ? ['TLS'] : []), target.secure ? 'HTTPS' : 'HTTP'],
      timings: { dnsMs: round(dnsMs), ...t, totalMs },
      breakdown,
      cert: http.cert,
    },
    text: previewBody(resp.body, 500),
  }))
}

/**
 * Where the time actually went, as percentages. This is the chapter's payoff:
 * on most sites the handshake is the single largest slice, and it buys no
 * content at all.
 */
function breakdownOf(dnsMs, t, secure) {
  const stages = [
    { name: 'DNS', ms: round(dnsMs) },
    { name: 'TCP', ms: round(t.connectMs ?? 0) },
    ...(secure ? [{ name: 'TLS', ms: round(t.tlsMs ?? 0) }] : []),
    { name: 'Request', ms: round(t.ttfbMs ?? 0) },
    { name: 'Transfer', ms: round(t.transferMs ?? 0) },
  ]
  const total = stages.reduce((n, s) => n + s.ms, 0) || 1
  return stages.map((s) => ({ ...s, percent: Math.round((s.ms / total) * 100) }))
}

function journeyNarration({ target, ip, totalMs, breakdown, resp }) {
  const biggest = [...breakdown].sort((a, b) => b.ms - a.ms)[0]
  const setup = breakdown
    .filter((s) => s.name !== 'Transfer' && s.name !== 'Request')
    .reduce((n, s) => n + s.percent, 0)

  return [
    `${resp.status} ${resp.reason} from ${target.host} (${ip}) in ${totalMs} ms.`,
    `Four protocols, in order, every one of them real.`,
    `The largest single slice was ${biggest.name} at ${biggest.percent}%, and roughly ${setup}% of the time went on setup before a single byte of content moved.`,
    target.secure
      ? 'That is what keep-alive, HTTP/2 and session resumption exist to avoid paying twice.'
      : '',
  ].filter(Boolean).join(' ')
}

const round = (n) => (n == null ? 0 : Math.round(n * 10) / 10)
