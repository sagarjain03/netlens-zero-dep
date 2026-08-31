/**
 * api/dns.js — turns a DNS exchange into the shared envelope.
 *
 * This layer owns all the presentation decisions (what the timeline says, which
 * packet is editable) so that proto/dns.js stays purely about bytes and
 * dns-client.js stays purely about sockets.
 */
import { lookup, resolveServer, resolverLabel } from '../proto/dns-client.js'
import { decode, typeName, formatAnswers } from '../proto/dns.js'
import { envelope, event, packet, sendJson } from '../server/respond.js'
import { narrate } from '../shared/narrate.js'
import { hexToBytes } from '../shared/bytes.js'

const DOMAIN_RE = /^(?=.{1,253}$)([a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.)*[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?$/

export async function handleDns({ res, body }) {
  const lang = body.lang === 'hi' ? 'hi' : 'en'

  // rawOverride is the byte editor: the learner's exact bytes go on the wire.
  let rawOverride = null
  if (body.rawOverride) {
    rawOverride = hexToBytes(body.rawOverride)
    if (rawOverride.length < 12) throw new Error('an edited packet still needs a 12-byte header')
    if (rawOverride.length > 512) throw new Error(`${rawOverride.length} bytes is too large for DNS over UDP`)
  } else {
    if (!body.domain) throw new Error('domain is required')
    if (!DOMAIN_RE.test(body.domain)) throw new Error(`"${body.domain}" is not a valid domain name`)
  }

  const server = resolveServer(body.server)
  const wire = await lookup({
    domain: body.domain,
    type: body.type ?? 'A',
    server,
    rawOverride,
    // The byte editor sends the id of the packet the learner STARTED from. If
    // they edited the id field, the reply comes back carrying the edited id and
    // no longer matches what we are waiting for — the same rejection a resolver
    // performs on a forged answer.
    expectId: Number.isInteger(body.expectId) ? body.expectId : null,
    timeoutMs: Math.min(Number(body.timeoutMs) || 3000, 8000),
    lang,
  })

  sendJson(res, buildEnvelope(wire, { lang, server }))
}

/** Exported separately so it can be unit-tested without a socket. */
export function buildEnvelope(wire, { lang = 'en', server }) {
  const { requestMessage: req, responseMessage: resp, durationMs, idMatch, sentId, gotId, expectId } = wire
  const label = resolverLabel(server)
  const domain = req.question?.name ?? '(unparsable)'
  const qtype = req.question ? typeName(req.question.type) : '?'

  const events = [
    event({
      t: 0,
      dir: 'out',
      from: 'you',
      to: `${server}:53`,
      proto: 'UDP',
      bytes: wire.request.length,
      label: 'DNS query',
      packetId: 'q',
      narration: narrate('dns.query', { domain, server: `${label} (${server})` }, lang),
    }),
    event({
      t: durationMs,
      dir: 'in',
      from: `${server}:53`,
      to: 'you',
      proto: 'UDP',
      bytes: wire.response.length,
      label: idMatch ? 'DNS response' : 'DNS response · REJECTED',
      packetId: 'r',
      note: idMatch ? '' : 'transaction id mismatch',
      narration: responseNarration({ resp, idMatch, expectId, gotId, domain, qtype, durationMs, lang }),
    }),
  ]

  return envelope({
    durationMs,
    events,
    packets: [
      packet({ id: 'q', dir: 'out', proto: 'DNS/UDP', bytes: wire.request, tree: req.tree, editable: true }),
      packet({
        id: 'r',
        dir: 'in',
        proto: 'DNS/UDP',
        bytes: wire.response,
        tree: resp.tree,
        note: resp.truncatedParse ?? '',
      }),
    ],
    meta: {
      server,
      serverLabel: label,
      localPort: wire.localPort,
      idMatch,
      sentId,
      gotId,
      expectId,
      rcode: resp.header.rcode,
      answerCount: resp.answers.length,
      // The record types that came back, so a challenge can be checked against
      // the answer itself rather than by matching the formatted text.
      answerTypes: resp.answers.map((a) => a.typeName),
      truncatedParse: resp.truncatedParse ?? null,
    },
    text: formatAnswers(resp).join('\n'),
  })
}

function responseNarration({ resp, idMatch, expectId, gotId, domain, qtype, durationMs, lang }) {
  const ms = durationMs.toFixed(1)
  if (!idMatch) {
    return narrate('dns.idmismatch', { sent: hex16(expectId), got: hex16(gotId) }, lang)
  }
  if (resp.header.rcode === 3) return narrate('dns.nxdomain', { domain }, lang)
  if (resp.answers.length === 0 && resp.header.rcode === 0) {
    if (resp.header.rd === 1 && resp.header.ra === 0) return narrate('dns.norecursion', {}, lang)
    return narrate('dns.nodata', { domain, type: qtype }, lang)
  }
  return narrate('dns.response', {
    answer: `${resp.answers[0].typeName} ${resp.answers[0].value}`,
    ms,
  }, lang)
}

const hex16 = (n) => (n < 0 ? '?' : `0x${n.toString(16).padStart(4, '0')}`)

// Re-exported so tests can build a fake wire result without a socket.
export { decode }
