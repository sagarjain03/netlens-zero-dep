/**
 * tls.js — a TLS handshake codec, written by hand.
 * Replaces: get-ssl-certificate, tls-parser, sslcert.
 *
 * LAYER 0: pure. buildClientHello() returns bytes; decode() reads them back.
 * No sockets here.
 *
 * ── The one decision that shapes this whole file ────────────────────────────
 *
 * We deliberately offer TLS **1.2**, not 1.3.
 *
 * In TLS 1.3 the Certificate message is encrypted — the handshake protects it
 * almost immediately, so a passive reader sees nothing but opaque records. In
 * TLS 1.2 the server sends its certificate in the clear, which is exactly what
 * a learner needs to see and parse.
 *
 * That is not a shortcut, it is the lesson: *"you can read this certificate
 * because we asked for older crypto. Hiding it is precisely what TLS 1.3
 * changed."* Chapter 5 says so on screen.
 *
 * ── Wire format ─────────────────────────────────────────────────────────────
 *
 *   Record     type(1) version(2) length(2)  payload
 *   Handshake  type(1) length(3)             body
 *
 * A single TCP read can hold several records, and one record can hold several
 * handshake messages, so both are walked as sequences.
 */
import { Reader, Writer, u16hex } from '../shared/bytes.js'

// ── tables ──────────────────────────────────────────────────────────────────

export const RECORD_TYPES = {
  20: 'ChangeCipherSpec',
  21: 'Alert',
  22: 'Handshake',
  23: 'ApplicationData',
}

export const HANDSHAKE_TYPES = {
  1: 'ClientHello',
  2: 'ServerHello',
  11: 'Certificate',
  12: 'ServerKeyExchange',
  13: 'CertificateRequest',
  14: 'ServerHelloDone',
  16: 'ClientKeyExchange',
  20: 'Finished',
}

export const VERSIONS = {
  0x0300: 'SSL 3.0',
  0x0301: 'TLS 1.0',
  0x0302: 'TLS 1.1',
  0x0303: 'TLS 1.2',
  0x0304: 'TLS 1.3',
}

/** The suites worth naming. Anything else is shown as its hex code. */
export const CIPHER_SUITES = {
  0x009c: 'TLS_RSA_WITH_AES_128_GCM_SHA256',
  0x009d: 'TLS_RSA_WITH_AES_256_GCM_SHA384',
  0xc013: 'TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA',
  0xc014: 'TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA',
  0xc02b: 'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256',
  0xc02c: 'TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384',
  0xc02f: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
  0xc030: 'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
  0x1301: 'TLS_AES_128_GCM_SHA256',
  0x1302: 'TLS_AES_256_GCM_SHA384',
  0x1303: 'TLS_CHACHA20_POLY1305_SHA256',
}

export const EXTENSIONS = {
  0x0000: 'server_name (SNI)',
  0x000a: 'supported_groups',
  0x000b: 'ec_point_formats',
  0x000d: 'signature_algorithms',
  0x0010: 'application_layer_protocol_negotiation',
  0x0017: 'extended_master_secret',
  0x002b: 'supported_versions',
  0x0033: 'key_share',
  0xff01: 'renegotiation_info',
}

export const ALERT_LEVELS = { 1: 'warning', 2: 'fatal' }

export const ALERTS = {
  0: 'close_notify',
  10: 'unexpected_message',
  20: 'bad_record_mac',
  40: 'handshake_failure',
  42: 'bad_certificate',
  46: 'certificate_unknown',
  47: 'illegal_parameter',
  48: 'unknown_ca',
  49: 'access_denied',
  50: 'decode_error',
  51: 'decrypt_error',
  70: 'protocol_version',
  71: 'insufficient_security',
  80: 'internal_error',
  112: 'unrecognized_name',
  120: 'no_application_protocol',
}

export const versionName = (v) => VERSIONS[v] ?? `0x${v.toString(16).padStart(4, '0')}`
export const cipherName = (c) => CIPHER_SUITES[c] ?? `0x${c.toString(16).padStart(4, '0')}`
export const alertName = (d) => ALERTS[d] ?? `alert ${d}`

// ── ClientHello ─────────────────────────────────────────────────────────────

/**
 * The cipher list we advertise. All TLS 1.2 suites, deliberately — see the note
 * at the top of this file.
 */
const DEFAULT_CIPHERS = [0xc02b, 0xc02f, 0xc02c, 0xc030, 0xc013, 0xc014, 0x009c, 0x009d]

const u16be = (n) => [(n >> 8) & 0xff, n & 0xff]

/**
 * Build a ClientHello.
 *
 * @param {object} opts
 * @param {string|null} opts.sni       the hostname to ask for; null omits the
 *                                     extension entirely, which is the demo
 * @param {number} [opts.version=0x0303]
 * @param {number[]} [opts.ciphers]
 * @param {Uint8Array} [opts.random]   fixed value makes the output reproducible
 * @returns {Buffer}
 */
export function buildClientHello({
  sni = null,
  version = 0x0303,
  ciphers = DEFAULT_CIPHERS,
  random = null,
} = {}) {
  const extensions = []

  // SNI — the only part of the handshake that names the site in the clear.
  if (sni) {
    const host = Buffer.from(String(sni), 'ascii')
    const entry = Buffer.concat([Buffer.from([0x00]), Buffer.from(u16be(host.length)), host])
    extensions.push(ext(0x0000, Buffer.concat([Buffer.from(u16be(entry.length)), entry])))
  }

  // supported_groups: x25519, secp256r1, secp384r1
  const groups = Buffer.from([...u16be(0x001d), ...u16be(0x0017), ...u16be(0x0018)])
  extensions.push(ext(0x000a, Buffer.concat([Buffer.from(u16be(groups.length)), groups])))

  // ec_point_formats: uncompressed
  extensions.push(ext(0x000b, Buffer.from([0x01, 0x00])))

  // signature_algorithms — without this most servers refuse outright.
  const sigs = Buffer.from([
    ...u16be(0x0403), ...u16be(0x0503), ...u16be(0x0603),   // ECDSA + SHA-2
    ...u16be(0x0804), ...u16be(0x0805), ...u16be(0x0806),   // RSA-PSS
    ...u16be(0x0401), ...u16be(0x0501), ...u16be(0x0601),   // RSA PKCS#1
  ])
  extensions.push(ext(0x000d, Buffer.concat([Buffer.from(u16be(sigs.length)), sigs])))

  extensions.push(ext(0xff01, Buffer.from([0x00])))          // renegotiation_info

  const extBuf = Buffer.concat(extensions)
  const cipherBuf = Buffer.from(ciphers.flatMap(u16be))

  const body = new Writer(512)
  body.u16(version)
  body.bytes(random ?? randomBytes(32))
  body.u8(0)                                                 // no session id
  body.u16(cipherBuf.length)
  body.bytes(cipherBuf)
  body.u8(1); body.u8(0)                                     // compression: null only
  body.u16(extBuf.length)
  body.bytes(extBuf)
  const bodyBytes = body.done()

  const hs = new Writer(bodyBytes.length + 8)
  hs.u8(1)                                                   // ClientHello
  hs.u8((bodyBytes.length >> 16) & 0xff)
  hs.u16(bodyBytes.length & 0xffff)
  hs.bytes(bodyBytes)
  const hsBytes = hs.done()

  const rec = new Writer(hsBytes.length + 8)
  rec.u8(22)                                                 // Handshake
  rec.u16(0x0301)                                            // legacy record version
  rec.u16(hsBytes.length)
  rec.bytes(hsBytes)

  return Buffer.from(rec.done())
}

const ext = (type, data) =>
  Buffer.concat([Buffer.from(u16be(type)), Buffer.from(u16be(data.length)), data])

function randomBytes(n) {
  const out = Buffer.alloc(n)
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256)
  return out
}

// ── decode ──────────────────────────────────────────────────────────────────

/**
 * Parse a TLS byte stream into records, handshake messages and a field tree.
 *
 * Like the DNS decoder, this degrades rather than throwing: a truncated or
 * edited stream still yields whatever was readable plus a note saying where it
 * stopped, because a broken handshake is a thing worth looking at.
 */
export function decode(input, { lang = 'en' } = {}) {
  const bytes = Buffer.from(input)
  const r = new Reader(bytes)
  const tree = []
  const records = []
  const certificates = []
  let serverHello = null
  let alert = null
  let truncatedParse

  try {
    while (r.remaining >= 5) {
      const start = r.offset
      const type = r.u8()
      const version = r.u16()
      const length = r.u16()

      if (length > r.remaining) {
        truncatedParse = `record at offset ${start} claims ${length} bytes but only ${r.remaining} remain`
        break
      }

      const payload = r.bytes(length)
      const record = { type, typeName: RECORD_TYPES[type] ?? `type ${type}`, version, length, offset: start }
      records.push(record)

      const children = [
        field('Content Type', `${type} (${record.typeName})`, [start, 1],
          'What kind of record this is. 22 is a handshake message, 23 is your encrypted data.'),
        field('Version', versionName(version), [start + 1, 2],
          'The record layer version. It is legacy: the version that actually matters is negotiated inside the handshake.'),
        field('Length', String(length), [start + 3, 2],
          'How many bytes of payload follow.'),
      ]

      if (type === 21 && payload.length >= 2) {
        alert = { level: payload[0], levelName: ALERT_LEVELS[payload[0]] ?? '?', description: payload[1], name: alertName(payload[1]) }
        children.push(
          field('Level', `${alert.level} (${alert.levelName})`, [start + 5, 1],
            'A fatal alert ends the connection immediately.'),
          field('Description', `${alert.description} (${alert.name})`, [start + 6, 1],
            'Why the server refused. handshake_failure usually means it could not agree with what you offered.'),
        )
      }

      if (type === 22) {
        const messages = walkHandshake(payload, start + 5)
        for (const msg of messages) {
          if (msg.type === 2) serverHello = msg.serverHello
          if (msg.type === 11) certificates.push(...msg.certificates)
          tree.push(msg.node)
        }
      }

      tree.unshift({
        name: `Record · ${record.typeName}`,
        span: [start, 5 + length],
        children,
      })
    }
  } catch (err) {
    truncatedParse = err.message
  }

  // Records first, then their handshake messages, in wire order.
  tree.sort((a, b) => a.span[0] - b.span[0] || a.span[1] - b.span[1])

  return {
    records,
    serverHello,
    certificates,
    alert,
    tree,
    ...(truncatedParse ? { truncatedParse } : {}),
  }
}

/** One record's payload can carry several handshake messages back to back. */
function walkHandshake(payload, baseOffset) {
  const out = []
  let o = 0

  while (o + 4 <= payload.length) {
    const type = payload[o]
    const length = (payload[o + 1] << 16) | (payload[o + 2] << 8) | payload[o + 3]
    if (o + 4 + length > payload.length) break

    const body = payload.subarray(o + 4, o + 4 + length)
    const absolute = baseOffset + o
    const name = HANDSHAKE_TYPES[type] ?? `handshake ${type}`

    const children = [
      field('Handshake Type', `${type} (${name})`, [absolute, 1], null),
      field('Length', String(length), [absolute + 1, 3], null),
    ]

    const msg = { type, name, length, offset: absolute }

    if (type === 2) {
      msg.serverHello = parseServerHello(body, absolute + 4, children)
    } else if (type === 11) {
      msg.certificates = parseCertificateMessage(body, absolute + 4, children)
    } else if (type === 1) {
      parseClientHello(body, absolute + 4, children)
    }

    msg.node = { name, span: [absolute, 4 + length], children }
    out.push(msg)
    o += 4 + length
  }

  return out
}

// ── ServerHello ─────────────────────────────────────────────────────────────

export function parseServerHello(body, base, children = []) {
  const r = new Reader(body)
  const version = r.u16()
  const random = r.bytes(32)
  const sessionIdLen = r.u8()
  const sessionId = r.bytes(sessionIdLen)
  const cipher = r.u16()
  const compression = r.u8()

  let o = base
  children.push(
    field('Server Version', versionName(version), [o, 2],
      'The version the server actually chose from what you offered.'),
  )
  o += 2
  children.push(field('Server Random', `${random.length} bytes`, [o, 32],
    'Fresh randomness from the server. Combined with yours, it makes every session\'s keys different.'))
  o += 32
  children.push(field('Session ID Length', String(sessionIdLen), [o, 1], null))
  o += 1 + sessionIdLen
  children.push(field('Cipher Suite', `${u16hex(cipher)} ${cipherName(cipher)}`, [o, 2],
    'The one cipher the server picked out of the list you sent. Key exchange, encryption and hashing, all named in one number.'))
  o += 2
  children.push(field('Compression', String(compression), [o, 1],
    'Always 0. TLS compression was removed after it turned out to leak secrets.'))

  return {
    version,
    versionName: versionName(version),
    cipher,
    cipherName: cipherName(cipher),
    random: Buffer.from(random).toString('hex'),
    sessionId: Buffer.from(sessionId).toString('hex'),
    compression,
  }
}

/** Just enough of a ClientHello to render the packet we sent. */
export function parseClientHello(body, base, children = []) {
  const r = new Reader(body)
  const version = r.u16()
  r.bytes(32)
  const sessionIdLen = r.u8()
  r.bytes(sessionIdLen)
  const cipherLen = r.u16()
  const cipherBytes = r.bytes(cipherLen)

  let o = base
  children.push(field('Client Version', versionName(version), [o, 2],
    'The highest version you are willing to speak.'))
  o += 2
  children.push(field('Client Random', '32 bytes', [o, 32], null))
  o += 32 + 1 + sessionIdLen
  const ciphers = []
  for (let i = 0; i + 1 < cipherBytes.length; i += 2) ciphers.push(cipherBytes.readUInt16BE(i))
  children.push(field('Cipher Suites', `${ciphers.length} offered`, [o, 2 + cipherLen],
    'Every cipher you can speak. The server picks one.'))
  o += 2 + cipherLen

  r.u8(); r.u8()                      // compression length + method
  o += 2

  if (r.remaining >= 2) {
    const extLen = r.u16()
    const extBase = o + 2
    children.push(field('Extensions Length', String(extLen), [o, 2], null))
    parseExtensions(r.bytes(Math.min(extLen, r.remaining)), extBase, children)
  }

  return { version, ciphers }
}

function parseExtensions(buf, base, children) {
  let o = 0
  while (o + 4 <= buf.length) {
    const type = buf.readUInt16BE(o)
    const len = buf.readUInt16BE(o + 2)
    if (o + 4 + len > buf.length) break
    const data = buf.subarray(o + 4, o + 4 + len)
    const name = EXTENSIONS[type] ?? `extension 0x${type.toString(16).padStart(4, '0')}`

    let value = `${len} bytes`
    let explain = null
    if (type === 0x0000 && data.length > 5) {
      value = data.subarray(5).toString('ascii')
      explain = 'The hostname you are asking for — and the ONLY part of the handshake that is not encrypted. This is how one IP address serves thousands of sites, and it is also why your ISP can still see which site you opened over HTTPS.'
    }

    children.push({
      name,
      value,
      span: [base + o, 4 + len],
      ...(explain ? { explain } : {}),
      ...(type === 0x0000 ? { editHint: 'Change this name and the same server hands you a different company\'s certificate' } : {}),
    })
    o += 4 + len
  }
}

// ── Certificate message ─────────────────────────────────────────────────────

/**
 * Certificate ::= 3-byte total length, then a chain of 3-byte-prefixed DER blobs.
 * The first is the server's own; the rest are intermediates leading toward a
 * root the client already trusts.
 */
export function parseCertificateMessage(body, base, children = []) {
  const certs = []
  if (body.length < 3) return certs

  const totalLen = (body[0] << 16) | (body[1] << 8) | body[2]
  children.push(field('Chain Length', `${totalLen} bytes`, [base, 3],
    'The whole chain, one certificate after another.'))

  let o = 3
  let index = 0
  while (o + 3 <= body.length) {
    const len = (body[o] << 16) | (body[o + 1] << 8) | body[o + 2]
    if (o + 3 + len > body.length) break
    const der = Buffer.from(body.subarray(o + 3, o + 3 + len))
    certs.push({ der, offset: base + o + 3, length: len, index })

    children.push(field(
      index === 0 ? 'Certificate (server)' : `Certificate ${index} (intermediate)`,
      `${len} bytes of DER`,
      [base + o, 3 + len],
      index === 0
        ? 'The server\'s own identity, signed by an authority. Everything below is parsed out of these bytes.'
        : 'An intermediate, vouching for the one before it, up toward a root your machine already trusts.',
    ))

    o += 3 + len
    index++
  }

  return certs
}

// ── helpers ─────────────────────────────────────────────────────────────────

function field(name, value, span, explain) {
  return { name, value, span, ...(explain ? { explain } : {}) }
}
