/**
 * api/tls.js — turns a TLS probe into the shared envelope.
 *
 * Chapter 5's payoff lives here: the certificate a server hands back depends on
 * the name you asked for, not on the address you connected to. Connect to one
 * host while sending another's SNI and a different company's certificate comes
 * back — from the same machine, over the same socket.
 */
import { inspect } from '../proto/tls-probe.js'
import { parseCertificate, summarise, coversHost } from '../proto/x509.js'
import { alertName, ALERT_LEVELS } from '../proto/tls.js'
import { envelope, event, packet, sendJson } from '../server/respond.js'
import { hexToBytes } from '../shared/bytes.js'

export async function handleTls({ res, body }) {
  const lang = body.lang === 'hi' ? 'hi' : 'en'

  let rawOverride = null
  if (body.rawOverride) {
    rawOverride = hexToBytes(body.rawOverride)
    if (rawOverride.length < 5) throw new Error('a TLS record needs at least a 5-byte header')
    if (rawOverride.length > 16384) throw new Error(`${rawOverride.length} bytes is too large for one record`)
  }

  if (!body.host) throw new Error('host is required')

  const wire = await inspect({
    host: body.host,
    // An explicit null means "send no SNI at all", which is a different thing
    // from "use the host" and is the whole point of one of the experiments.
    sni: body.sni === null ? null : (body.sni ?? undefined),
    port: Number(body.port) || 443,
    rawOverride,
    timeoutMs: Math.min(Number(body.timeoutMs) || 8000, 15000),
    lang,
  })

  sendJson(res, buildEnvelope(wire, { lang }))
}

/** Exported for tests, which build a wire result from fixtures without a socket. */
export function buildEnvelope(wire, { lang = 'en', now = Date.now() } = {}) {
  const { requestMessage: req, responseMessage: resp, durationMs, host, sni } = wire

  const certificates = resp.certificates.map((c) => {
    try {
      const parsed = parseCertificate(c.der)
      return { ...summarise(parsed, now), index: c.index, bytes: c.length, parsed }
    } catch (err) {
      return { index: c.index, bytes: c.length, parseError: err.message }
    }
  })

  const leaf = certificates[0] ?? null
  const alert = resp.alert
  const hello = resp.serverHello

  const events = [
    event({
      t: 0,
      dir: 'out',
      from: 'you',
      to: `${host}:${wire.port}`,
      proto: 'TLS',
      bytes: wire.request.length,
      label: 'ClientHello',
      packetId: 'c',
      narration: sni
        ? `You opened a plain TCP connection and wrote a ClientHello by hand: the versions you speak, the ciphers you accept, and the name you want — "${sni}".`
        : 'You sent a ClientHello with no SNI extension at all — no name, just "give me whatever you have".',
    }),
    event({
      t: durationMs,
      dir: 'in',
      from: `${host}:${wire.port}`,
      to: 'you',
      proto: 'TLS',
      bytes: wire.response.length,
      label: alert ? `Alert · ${alert.name}` : 'ServerHello + Certificate',
      packetId: 's',
      note: alert ? alert.name : '',
      narration: responseNarration({
        alert, hello, leaf, sni, host, lang,
        // The swap is visible in the fact that the certificate does NOT cover
        // the host we dialled — comparing it to the name we asked for would
        // always match, since that is what the server answered.
        coversConnected: leaf?.parsed ? coversHost(leaf.parsed, host) : null,
      }),
    }),
  ]

  return envelope({
    durationMs,
    events,
    packets: [
      packet({ id: 'c', dir: 'out', proto: 'TLS', bytes: wire.request, tree: req.tree, editable: true }),
      packet({
        id: 's',
        dir: 'in',
        proto: 'TLS',
        bytes: wire.response,
        tree: resp.tree,
        note: resp.truncatedParse ?? '',
      }),
    ],
    meta: {
      host,
      port: wire.port,
      sni,
      localPort: wire.localPort,
      version: hello?.versionName ?? null,
      cipher: hello?.cipherName ?? null,
      alert: alert ? { ...alert, levelName: ALERT_LEVELS[alert.level] ?? '?' } : null,
      certificates: certificates.map(({ parsed, ...rest }) => rest),
      chainLength: certificates.length,
      // Did the certificate we got actually cover the name we asked for? When
      // the SNI is swapped, this is false — and that is the lesson.
      matchesRequestedName: leaf?.parsed && sni ? coversHost(leaf.parsed, sni) : null,
      matchesConnectedHost: leaf?.parsed ? coversHost(leaf.parsed, host) : null,
      truncatedParse: resp.truncatedParse ?? null,
    },
    text: leaf ? certificateText(leaf) : '',
  })
}

function responseNarration({ alert, hello, leaf, sni, host, lang, coversConnected }) {
  if (alert) {
    if (alert.description === 40 || alert.description === 112) {
      return `The server refused with a fatal ${alertName(alert.description)}. Thousands of sites share this address, and without a name in the handshake it has no way to know which certificate you wanted. That is exactly why SNI exists.`
    }
    return `The server refused with a ${ALERT_LEVELS[alert.level] ?? ''} alert: ${alertName(alert.description)}.`
  }

  if (!hello) return 'The server replied, but not with a handshake we could read.'

  const base = `The server chose ${hello.versionName} with ${hello.cipherName}, and sent its certificate in the clear.`
  if (!leaf) return base

  const who = `It identifies itself as ${leaf.commonName ?? 'an unnamed host'}, vouched for by ${leaf.issuerCN ?? 'an unknown authority'}.`

  if (sni && coversConnected === false) {
    return `${base} ${who} You connected to ${host} but asked for ${sni} — and the certificate that came back belongs to ${leaf.commonName}. One address, thousands of sites, and SNI is the only thing that tells them apart.`
  }

  const expiry = leaf.expired
    ? 'It has already expired.'
    : leaf.daysLeft != null ? `It expires in ${leaf.daysLeft} days.` : ''

  return `${base} ${who} ${expiry}`.trim()
}

function certificateText(leaf) {
  const rows = [
    ['Subject', leaf.subject],
    ['Issuer', leaf.issuer],
    ['Valid from', leaf.notBefore ? isoDay(leaf.notBefore) : null],
    ['Valid to', leaf.notAfter ? isoDay(leaf.notAfter) : null],
    ['Key', [leaf.keyAlgorithm, leaf.keyCurve].filter(Boolean).join(' ')],
    ['Signature', leaf.signatureAlgorithm],
    ['SANs', leaf.altNames?.slice(0, 6).join(', ')],
  ]
  return rows.filter(([, v]) => v).map(([k, v]) => `${k.padEnd(12)}${v}`).join('\n')
}

const isoDay = (d) => new Date(d).toISOString().slice(0, 10)
