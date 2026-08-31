/**
 * tls.test.js — the handshake codec and the certificate parser.
 *
 * The X.509 parser is the riskiest thing in this repository: ASN.1 is a format
 * with a great deal of room to be subtly wrong. So every field it extracts is
 * checked against node:crypto's own X509Certificate, across three real chains
 * and ten certificates. "We wrote our own parser" is a claim, and this is the
 * evidence for it.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildClientHello, decode, cipherName, versionName, alertName,
} from '../src/proto/tls.js'
import {
  parseCertificate, summarise, coversHost, readTLV, children,
  decodeOID, decodeTime, oidName,
} from '../src/proto/x509.js'
import { buildEnvelope } from '../src/api/tls.js'
import { hexToBytes } from '../src/shared/bytes.js'

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url))
const fx = (n) => hexToBytes(readFileSync(join(FIX, n), 'utf8').trim())

// ── ClientHello ─────────────────────────────────────────────────────────────

describe('tls · the ClientHello we build', () => {
  const hello = buildClientHello({ sni: 'github.com', random: Buffer.alloc(32, 0x42) })

  test('is a well-formed handshake record', () => {
    assert.equal(hello[0], 0x16, 'record type 22 — Handshake')
    assert.equal(hello.readUInt16BE(1), 0x0301, 'legacy record version')
    assert.equal(hello.readUInt16BE(3), hello.length - 5, 'the length covers the rest exactly')
    assert.equal(hello[5], 0x01, 'handshake type 1 — ClientHello')
  })

  test('offers TLS 1.2, deliberately', () => {
    // TLS 1.3 encrypts the Certificate message. Offering 1.2 is what makes the
    // certificate readable, and chapter 5 says so on screen.
    assert.equal(hello.readUInt16BE(9), 0x0303)
    const parsed = decode(hello)
    assert.equal(parsed.records[0].typeName, 'Handshake')
  })

  test('carries the requested name in the SNI extension', () => {
    assert.ok(hello.includes(Buffer.from('github.com', 'ascii')), 'the hostname is in the clear')
  })

  test('omitting SNI produces a shorter hello with no hostname in it', () => {
    const withSni = buildClientHello({ sni: 'medium.com', random: Buffer.alloc(32) })
    const without = buildClientHello({ sni: null, random: Buffer.alloc(32) })
    assert.ok(without.length < withSni.length)
    assert.ok(!without.includes(Buffer.from('medium.com', 'ascii')))
  })

  test('the same inputs produce the same bytes', () => {
    const a = buildClientHello({ sni: 'a.com', random: Buffer.alloc(32, 7) })
    const b = buildClientHello({ sni: 'a.com', random: Buffer.alloc(32, 7) })
    assert.equal(a.toString('hex'), b.toString('hex'))
  })

  test('a real captured hello round-trips through the decoder', () => {
    const parsed = decode(fx('tls-github.hello.hex'))
    assert.equal(parsed.records.length, 1)
    const clientHello = parsed.tree.find((n) => n.name === 'ClientHello')
    assert.ok(clientHello, 'the handshake message is in the tree')
    const sni = clientHello.children.find((c) => c.name.startsWith('server_name'))
    assert.equal(sni.value, 'github.com')
    assert.ok(sni.explain.includes('not encrypted') || sni.explain.includes('NOT encrypted')
      || /only part/i.test(sni.explain), 'SNI carries the lesson')
  })
})

// ── ServerHello ─────────────────────────────────────────────────────────────

describe('tls · the server\'s reply', () => {
  const github = decode(fx('tls-github.resp.hex'))

  test('the negotiated version and cipher are read', () => {
    assert.equal(github.serverHello.versionName, 'TLS 1.2')
    assert.match(github.serverHello.cipherName, /^TLS_ECDHE/)
    assert.equal(github.serverHello.compression, 0, 'TLS compression was removed years ago')
  })

  test('the whole flight is walked: several messages inside several records', () => {
    const names = github.tree.filter((n) => !n.name.startsWith('Record')).map((n) => n.name)
    assert.ok(names.includes('ServerHello'))
    assert.ok(names.includes('Certificate'))
    assert.ok(names.includes('ServerHelloDone'), 'the flight ends where the server stops talking')
  })

  test('every span in the tree lands inside the captured bytes', () => {
    const bytes = fx('tls-github.resp.hex')
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n.span) {
          assert.ok(n.span[0] >= 0 && n.span[0] + n.span[1] <= bytes.length,
            `${n.name} span [${n.span}] outside a ${bytes.length}-byte capture`)
        }
        if (n.children) walk(n.children)
      }
    }
    walk(github.tree)
  })

  test('a refusal is parsed as an alert, not thrown as an error', () => {
    const refused = decode(fx('tls-nosni.resp.hex'))
    assert.ok(refused.alert, 'medium.com refuses a hello with no SNI')
    assert.equal(refused.alert.levelName, 'fatal')
    assert.equal(refused.alert.name, 'handshake_failure')
    assert.equal(refused.certificates.length, 0)
    assert.equal(alertName(40), 'handshake_failure')
  })

  test('lookup tables name what they know and stay honest about the rest', () => {
    assert.equal(versionName(0x0303), 'TLS 1.2')
    assert.equal(versionName(0x0304), 'TLS 1.3')
    assert.equal(cipherName(0xc02b), 'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256')
    assert.equal(cipherName(0xdead), '0xdead', 'an unknown suite shows its code, not a guess')
  })

  test('truncated bytes yield what was readable plus a reason', () => {
    const full = fx('tls-github.resp.hex')
    const cut = decode(full.subarray(0, 400))
    assert.ok(cut.records.length >= 1)
    assert.ok(cut.truncatedParse, 'it says where it stopped')
  })
})

// ── DER primitives ──────────────────────────────────────────────────────────

describe('x509 · DER primitives', () => {
  test('a tag-length-value triple is read, short and long form alike', () => {
    const short = readTLV(Buffer.from([0x02, 0x01, 0x05]))
    assert.equal(short.tagName, 'INTEGER')
    assert.equal(short.length, 1)
    assert.equal(short.end, 3)

    // 0x82 means "the next two bytes are the length".
    const long = readTLV(Buffer.concat([Buffer.from([0x30, 0x82, 0x01, 0x00]), Buffer.alloc(256)]))
    assert.equal(long.tagName, 'SEQUENCE')
    assert.equal(long.length, 256)
    assert.equal(long.header, 4)
  })

  test('a constructed value yields its children', () => {
    const seq = readTLV(Buffer.from([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02]))
    const kids = children(seq)
    assert.equal(kids.length, 2)
    assert.ok(kids.every((k) => k.tagName === 'INTEGER'))
  })

  test('malformed lengths are refused rather than read past the buffer', () => {
    assert.throws(() => readTLV(Buffer.from([0x30, 0x0a, 0x01])), /claims 10 bytes/)
    assert.throws(() => readTLV(Buffer.from([0x30, 0x80])), /indefinite length/)
    assert.throws(() => readTLV(Buffer.from([0x30])), /truncated/)
  })

  test('object identifiers decode, first two components packed into one byte', () => {
    assert.equal(decodeOID(Buffer.from([0x55, 0x04, 0x03])), '2.5.4.3')
    assert.equal(oidName('2.5.4.3'), 'CN')
    assert.equal(decodeOID(Buffer.from([0x55, 0x1d, 0x11])), '2.5.29.17')
    assert.equal(oidName('2.5.29.17'), 'subjectAltName')
    assert.equal(oidName('1.2.3.4.5'), '1.2.3.4.5', 'an unknown OID is shown as itself')
  })

  test('UTCTime pivots at 2049, as RFC 5280 requires', () => {
    assert.equal(decodeTime(Buffer.from('491231235959Z', 'ascii'), 0x17).getUTCFullYear(), 2049)
    assert.equal(decodeTime(Buffer.from('500101000000Z', 'ascii'), 0x17).getUTCFullYear(), 1950)
    assert.equal(decodeTime(Buffer.from('20260930235959Z', 'ascii'), 0x18).getUTCFullYear(), 2026)
  })
})

// ── the cross-check ─────────────────────────────────────────────────────────

describe('x509 · our parser against node:crypto', () => {
  const chains = ['tls-github.resp.hex', 'tls-example.resp.hex', 'tls-sniswap.resp.hex']

  test('every certificate in every chain agrees, field by field', () => {
    let checked = 0

    for (const file of chains) {
      const msg = decode(fx(file))
      assert.ok(msg.certificates.length >= 2, `${file}: a real chain`)

      for (const entry of msg.certificates) {
        const ours = summarise(parseCertificate(entry.der))
        const theirs = new crypto.X509Certificate(entry.der)

        assert.equal(ours.commonName, /CN=([^\n,]+)/.exec(theirs.subject)?.[1] ?? null,
          `${file}[${entry.index}]: subject CN`)
        assert.equal(ours.issuerCN, /CN=([^\n,]+)/.exec(theirs.issuer)?.[1] ?? null,
          `${file}[${entry.index}]: issuer CN`)
        assert.equal(ours.notBefore.toISOString(), new Date(theirs.validFrom).toISOString(),
          `${file}[${entry.index}]: notBefore`)
        assert.equal(ours.notAfter.toISOString(), new Date(theirs.validTo).toISOString(),
          `${file}[${entry.index}]: notAfter`)
        assert.equal(ours.serialNumber.toLowerCase(), theirs.serialNumber.toLowerCase(),
          `${file}[${entry.index}]: serial number`)
        assert.equal(ours.isCA, theirs.ca, `${file}[${entry.index}]: basicConstraints CA`)

        const theirSans = (theirs.subjectAltName ?? '')
          .split(',').map((s) => s.trim().replace(/^DNS:/, '')).filter(Boolean)
        assert.deepEqual(ours.altNames, theirSans, `${file}[${entry.index}]: subjectAltName`)

        checked++
      }
    }

    assert.ok(checked >= 9, `expected a real sample, checked ${checked} certificates`)
  })

  test('we say plainly that we did not verify the signature', () => {
    const msg = decode(fx('tls-github.resp.hex'))
    assert.equal(summarise(parseCertificate(msg.certificates[0].der)).verified, false)
  })
})

// ── certificate contents ────────────────────────────────────────────────────

describe('x509 · what the chapter reads out', () => {
  const leaf = parseCertificate(decode(fx('tls-github.resp.hex')).certificates[0].der)

  test('the leaf names the site and the authority that vouched for it', () => {
    assert.equal(leaf.subject.CN, 'github.com')
    assert.match(leaf.issuer.CN, /Sectigo/)
    assert.equal(leaf.isCA, false, 'a server certificate may not sign others')
  })

  test('the chain climbs toward a root, and the intermediates are CAs', () => {
    const chain = decode(fx('tls-github.resp.hex')).certificates.map((c) => parseCertificate(c.der))
    assert.ok(chain.length >= 2)
    for (const cert of chain.slice(1)) assert.equal(cert.isCA, true)
    assert.equal(chain[0].issuer.toString(), chain[1].subject.toString(),
      'each certificate is signed by the next one along')
  })

  test('subjectAltName lists every host this one certificate covers', () => {
    assert.ok(leaf.altNames.includes('github.com'))
    assert.ok(leaf.altNames.includes('www.github.com'))
  })

  test('a name is rendered the way every tool prints one', () => {
    assert.match(leaf.subject.toString(), /^CN=github\.com/)
  })

  test('wildcards match one label and no more', () => {
    const wildcard = { altNames: ['*.example.com'], subject: { CN: null } }
    assert.equal(coversHost(wildcard, 'a.example.com'), true)
    assert.equal(coversHost(wildcard, 'a.b.example.com'), false, 'one level only')
    assert.equal(coversHost(wildcard, 'example.com'), false, 'the bare name is not covered')
    assert.equal(coversHost(leaf, 'github.com'), true)
    assert.equal(coversHost(leaf, 'discord.com'), false)
  })
})

// ── the SNI lesson ──────────────────────────────────────────────────────────

describe('tls · one address, thousands of sites', () => {
  const wireFrom = (name, sni, host) => {
    const request = fx(`${name}.hello.hex`)
    const response = fx(`${name}.resp.hex`)
    return {
      request, response, durationMs: 31.4, host, port: 443, sni, localPort: 54321,
      requestMessage: decode(request),
      responseMessage: decode(response),
    }
  }

  test('asking for another site\'s name returns that site\'s certificate', () => {
    // Connected to medium.com. Asked for discord.com. Same socket.
    const env = buildEnvelope(wireFrom('tls-sniswap', 'discord.com', 'medium.com'))
    const leaf = env.meta.certificates[0]

    assert.equal(leaf.commonName, 'discord.com')
    assert.equal(env.meta.matchesRequestedName, true, 'it covers the name we asked for')
    assert.equal(env.meta.matchesConnectedHost, false, 'and not the host we connected to')
    assert.match(env.events[1].narration, /One address, thousands of sites/)
  })

  test('the ordinary case matches both, so the swap stands out', () => {
    const env = buildEnvelope(wireFrom('tls-github', 'github.com', 'github.com'))
    assert.equal(env.meta.matchesRequestedName, true)
    assert.equal(env.meta.matchesConnectedHost, true)
    assert.equal(env.meta.certificates[0].commonName, 'github.com')
  })

  test('sending no name at all is refused, and the refusal is explained', () => {
    const env = buildEnvelope(wireFrom('tls-nosni', null, 'medium.com'))
    assert.equal(env.meta.alert.levelName, 'fatal')
    assert.equal(env.meta.alert.name, 'handshake_failure')
    assert.equal(env.meta.chainLength, 0)
    assert.match(env.events[1].narration, /why SNI exists/i)
    assert.match(env.events[0].narration, /no SNI extension/i)
  })

  test('the envelope keeps the shape every other endpoint returns', () => {
    const env = buildEnvelope(wireFrom('tls-github', 'github.com', 'github.com'))
    assert.deepEqual(Object.keys(env), ['ok', 'durationMs', 'events', 'packets', 'meta', 'text'])
    assert.equal(env.packets.length, 2)
    assert.equal(env.packets[0].editable, true, 'the ClientHello is ours to edit')
    assert.equal(env.packets[1].editable, false)
  })

  test('expiry is reported in days, and expiry in the past is called expired', () => {
    const env = buildEnvelope(wireFrom('tls-github', 'github.com', 'github.com'),
      { now: Date.parse('2026-09-01T00:00:00Z') })
    const leaf = env.meta.certificates[0]
    assert.equal(leaf.expired, false)
    assert.ok(leaf.daysLeft > 0 && leaf.daysLeft < 60, `${leaf.daysLeft} days left`)

    const later = buildEnvelope(wireFrom('tls-github', 'github.com', 'github.com'),
      { now: Date.parse('2027-01-01T00:00:00Z') })
    assert.equal(later.meta.certificates[0].expired, true)
  })
})
