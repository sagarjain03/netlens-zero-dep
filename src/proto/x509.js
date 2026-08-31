/**
 * x509.js — a minimal ASN.1/DER parser, enough to read a certificate.
 * Replaces: node-forge (25M weekly), asn1.js (30M), x509, pem.
 *
 * LAYER 0: pure. Bytes in, structure out.
 *
 * ── DER in one paragraph ────────────────────────────────────────────────────
 *
 * Everything is a triple: a tag byte saying what it is, a length, then that many
 * bytes of value. Constructed types (SEQUENCE, SET) hold more triples inside.
 * So a certificate is a tree, and the whole parser is one recursive walk plus a
 * table of which position means what.
 *
 *   30 82 03 ee    SEQUENCE, 0x03ee bytes    ← the certificate
 *     30 82 03 94  SEQUENCE, 0x0394 bytes    ← tbsCertificate, the signed part
 *       a0 03 ...  [0] version
 *       02 10 ...  INTEGER serial number
 *       ...
 *
 * ── Scope ───────────────────────────────────────────────────────────────────
 *
 * We read what chapter 5 teaches: who this is, who vouched for them, when it
 * expires, which other names it covers, and what key it uses. We do not verify
 * signatures — that needs the full trust store and is not what the chapter is
 * about. `verify: false` says so honestly in the output.
 *
 * Every field is cross-checked against node:crypto's X509Certificate in the
 * tests, so "we wrote our own parser" is a claim with evidence behind it.
 */
import { Reader } from '../shared/bytes.js'

// ── tags ────────────────────────────────────────────────────────────────────

export const TAGS = {
  0x01: 'BOOLEAN',
  0x02: 'INTEGER',
  0x03: 'BIT STRING',
  0x04: 'OCTET STRING',
  0x05: 'NULL',
  0x06: 'OBJECT IDENTIFIER',
  0x0c: 'UTF8String',
  0x13: 'PrintableString',
  0x16: 'IA5String',
  0x17: 'UTCTime',
  0x18: 'GeneralizedTime',
  0x30: 'SEQUENCE',
  0x31: 'SET',
}

const CONSTRUCTED = 0x20
const CONTEXT = 0x80

// ── object identifiers ──────────────────────────────────────────────────────

/** The OIDs that appear in a certificate a learner will actually look at. */
export const OIDS = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '1.2.840.113549.1.9.1': 'emailAddress',

  '2.5.29.17': 'subjectAltName',
  '2.5.29.19': 'basicConstraints',
  '2.5.29.15': 'keyUsage',
  '2.5.29.37': 'extKeyUsage',
  '2.5.29.14': 'subjectKeyIdentifier',
  '2.5.29.35': 'authorityKeyIdentifier',

  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.10045.2.1': 'EC',
  '1.2.840.10045.3.1.7': 'P-256',
  '1.3.132.0.34': 'P-384',

  '1.2.840.113549.1.1.11': 'SHA256withRSA',
  '1.2.840.113549.1.1.12': 'SHA384withRSA',
  '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.10045.4.3.2': 'ECDSAwithSHA256',
  '1.2.840.10045.4.3.3': 'ECDSAwithSHA384',
}

export const oidName = (oid) => OIDS[oid] ?? oid

// ── the TLV walker ──────────────────────────────────────────────────────────

/**
 * Read one tag-length-value triple.
 * @returns {{tag, tagName, constructed, header, length, value, start, end}}
 */
export function readTLV(buf, offset = 0) {
  if (offset + 2 > buf.length) throw new RangeError(`truncated TLV at offset ${offset}`)

  const tag = buf[offset]
  let cursor = offset + 1
  let length = buf[cursor++]

  // A high bit on the length byte means "the next N bytes are the real length".
  if (length & 0x80) {
    const count = length & 0x7f
    if (count === 0) throw new Error('indefinite length is not valid in DER')
    if (count > 4) throw new Error(`length field of ${count} bytes is unreasonable`)
    if (cursor + count > buf.length) throw new RangeError('truncated length field')
    length = 0
    for (let i = 0; i < count; i++) length = (length << 8) | buf[cursor++]
  }

  if (cursor + length > buf.length) {
    throw new RangeError(`TLV at ${offset} claims ${length} bytes, only ${buf.length - cursor} remain`)
  }

  return {
    tag,
    tagName: TAGS[tag] ?? tagLabel(tag),
    constructed: Boolean(tag & CONSTRUCTED),
    header: cursor - offset,
    length,
    value: buf.subarray(cursor, cursor + length),
    start: offset,
    end: cursor + length,
  }
}

function tagLabel(tag) {
  if ((tag & 0xc0) === CONTEXT) return `[${tag & 0x1f}]`
  return `tag 0x${tag.toString(16).padStart(2, '0')}`
}

/** Every TLV directly inside a constructed value. */
export function children(tlv) {
  if (!tlv.constructed) return []
  const out = []
  let o = 0
  while (o < tlv.value.length) {
    const child = readTLV(tlv.value, o)
    out.push(child)
    o = child.end
  }
  return out
}

// ── primitive decoders ──────────────────────────────────────────────────────

/** An OID's first byte packs two components; the rest are base-128, big-endian. */
export function decodeOID(bytes) {
  if (!bytes.length) return ''
  const parts = [Math.floor(bytes[0] / 40), bytes[0] % 40]
  let value = 0
  for (let i = 1; i < bytes.length; i++) {
    value = (value << 7) | (bytes[i] & 0x7f)
    if (!(bytes[i] & 0x80)) { parts.push(value); value = 0 }
  }
  return parts.join('.')
}

/**
 * UTCTime is `YYMMDDHHMMSSZ` with a two-digit year — the pivot is 2049, per
 * RFC 5280. GeneralizedTime spells the year out.
 */
export function decodeTime(bytes, tag) {
  const s = Buffer.from(bytes).toString('ascii')
  const m = tag === 0x18
    ? /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z?$/.exec(s)
    : /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z?$/.exec(s)
  if (!m) return null

  let year = Number(m[1])
  if (tag !== 0x18) year += year >= 50 ? 1900 : 2000

  return new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)))
}

export const decodeString = (bytes) => Buffer.from(bytes).toString('utf8')

export const decodeInteger = (bytes) => {
  // Serial numbers are routinely larger than a JS number holds, so hex it is.
  const hex = Buffer.from(bytes).toString('hex').replace(/^00/, '')
  return hex || '0'
}

// ── certificate ─────────────────────────────────────────────────────────────

/**
 * Parse a DER certificate.
 *
 * Certificate ::= SEQUENCE {
 *   tbsCertificate       TBSCertificate,
 *   signatureAlgorithm   AlgorithmIdentifier,
 *   signatureValue       BIT STRING }
 *
 * TBSCertificate ::= SEQUENCE {
 *   version         [0] EXPLICIT INTEGER DEFAULT v1,
 *   serialNumber        INTEGER,
 *   signature           AlgorithmIdentifier,
 *   issuer              Name,
 *   validity            Validity,
 *   subject             Name,
 *   subjectPublicKeyInfo SubjectPublicKeyInfo,
 *   extensions      [3] EXPLICIT Extensions OPTIONAL }
 */
export function parseCertificate(der) {
  const buf = Buffer.from(der)
  const cert = readTLV(buf, 0)
  if (cert.tag !== 0x30) throw new Error('a certificate must start with a SEQUENCE')

  const [tbs, sigAlg] = children(cert)
  if (!tbs) throw new Error('certificate has no tbsCertificate')

  const parts = children(tbs)
  let i = 0

  // The version is optional and tagged [0]; without it the certificate is v1.
  let version = 1
  if (parts[i] && (parts[i].tag & 0xc0) === CONTEXT && (parts[i].tag & 0x1f) === 0) {
    const inner = children(parts[i])[0]
    if (inner) version = Number(decodeInteger(inner.value)) + 1 || 1
    i++
  }

  const serialNumber = parts[i] ? decodeInteger(parts[i].value) : null; i++
  const innerSigAlg = parts[i]; i++
  const issuer = parts[i] ? parseName(parts[i]) : null; i++
  const validity = parts[i] ? parseValidity(parts[i]) : null; i++
  const subject = parts[i] ? parseName(parts[i]) : null; i++
  const spki = parts[i]; i++

  // Extensions are [3] and optional.
  let extensions = []
  for (; i < parts.length; i++) {
    if ((parts[i].tag & 0xc0) === CONTEXT && (parts[i].tag & 0x1f) === 3) {
      const seq = children(parts[i])[0]
      if (seq) extensions = children(seq).map(parseExtension)
      break
    }
  }

  const san = extensions.find((e) => e.name === 'subjectAltName')
  const basic = extensions.find((e) => e.name === 'basicConstraints')

  return {
    version,
    serialNumber,
    issuer,
    subject,
    validity,
    publicKey: spki ? parsePublicKey(spki) : null,
    signatureAlgorithm: sigAlg ? algorithmName(sigAlg) : (innerSigAlg ? algorithmName(innerSigAlg) : null),
    extensions,
    altNames: san?.altNames ?? [],
    isCA: basic?.isCA ?? false,
    // We read the certificate; we do not check who signed it. Saying so is the
    // honest thing, and chapter 5 explains the difference.
    verified: false,
  }
}

/** Name ::= SEQUENCE OF SET OF { type OID, value }  — flattened to CN=…, O=… */
export function parseName(tlv) {
  const attrs = []
  for (const rdn of children(tlv)) {
    for (const pair of children(rdn)) {
      const [typeTlv, valueTlv] = children(pair)
      if (!typeTlv || !valueTlv) continue
      attrs.push({
        oid: decodeOID(typeTlv.value),
        type: oidName(decodeOID(typeTlv.value)),
        value: decodeString(valueTlv.value),
      })
    }
  }

  const get = (type) => attrs.find((a) => a.type === type)?.value ?? null
  return {
    attributes: attrs,
    CN: get('CN'),
    O: get('O'),
    C: get('C'),
    /** "CN=github.com, O=GitHub, Inc." — the way every tool prints a name. */
    toString: () => attrs.map((a) => `${a.type}=${a.value}`).join(', '),
  }
}

function parseValidity(tlv) {
  const [notBefore, notAfter] = children(tlv)
  const from = notBefore ? decodeTime(notBefore.value, notBefore.tag) : null
  const to = notAfter ? decodeTime(notAfter.value, notAfter.tag) : null
  return { notBefore: from, notAfter: to }
}

function parsePublicKey(tlv) {
  const [algSeq] = children(tlv)
  if (!algSeq) return null
  const algChildren = children(algSeq)
  const algorithm = algChildren[0] ? oidName(decodeOID(algChildren[0].value)) : null
  const curve = algChildren[1] && algChildren[1].tag === 0x06
    ? oidName(decodeOID(algChildren[1].value))
    : null

  // The key itself is a BIT STRING whose first byte counts unused bits.
  const bitString = children(tlv)[1]
  const bits = bitString ? (bitString.length - 1) * 8 : null

  return { algorithm, curve, bits }
}

function algorithmName(tlv) {
  const first = children(tlv)[0]
  return first && first.tag === 0x06 ? oidName(decodeOID(first.value)) : null
}

/** Extension ::= SEQUENCE { extnID OID, critical BOOLEAN DEFAULT FALSE, extnValue OCTET STRING } */
function parseExtension(tlv) {
  const parts = children(tlv)
  const oid = parts[0] ? decodeOID(parts[0].value) : null
  const critical = parts[1]?.tag === 0x01 ? Boolean(parts[1].value[0]) : false
  const valueTlv = parts.find((p) => p.tag === 0x04)

  const out = { oid, name: oidName(oid), critical }
  if (!valueTlv) return out

  try {
    if (out.name === 'subjectAltName') out.altNames = parseSAN(valueTlv.value)
    else if (out.name === 'basicConstraints') {
      const seq = readTLV(valueTlv.value, 0)
      const inner = children(seq)
      out.isCA = inner[0]?.tag === 0x01 ? Boolean(inner[0].value[0]) : false
    }
  } catch {
    // A malformed extension is not worth losing the rest of the certificate for.
  }
  return out
}

/**
 * GeneralNames ::= SEQUENCE OF GeneralName, where [2] is a DNS name and [7] an
 * IP address. DNS names are what a learner is looking for: the full list of
 * sites this one certificate covers.
 */
export function parseSAN(bytes) {
  const seq = readTLV(bytes, 0)
  const names = []
  for (const name of children(seq)) {
    const kind = name.tag & 0x1f
    if (kind === 2) names.push(Buffer.from(name.value).toString('ascii'))
    else if (kind === 7) names.push(ipFromBytes(name.value))
    else if (kind === 1) names.push(`email:${Buffer.from(name.value).toString('ascii')}`)
  }
  return names
}

const ipFromBytes = (b) =>
  b.length === 4
    ? Array.from(b).join('.')
    : Array.from({ length: 8 }, (_, i) => b.readUInt16BE(i * 2).toString(16)).join(':')

// ── presentation ────────────────────────────────────────────────────────────

export function daysUntil(date, now = Date.now()) {
  if (!date) return null
  return Math.round((date.getTime() - now) / 86_400_000)
}

/** A flat summary — what the terminal prints and the envelope carries. */
export function summarise(cert, now = Date.now()) {
  const left = daysUntil(cert.validity?.notAfter, now)
  return {
    subject: cert.subject?.toString() ?? null,
    commonName: cert.subject?.CN ?? null,
    issuer: cert.issuer?.toString() ?? null,
    issuerCN: cert.issuer?.CN ?? null,
    serialNumber: cert.serialNumber,
    notBefore: cert.validity?.notBefore ?? null,
    notAfter: cert.validity?.notAfter ?? null,
    daysLeft: left,
    expired: left != null && left < 0,
    altNames: cert.altNames,
    keyAlgorithm: cert.publicKey?.algorithm ?? null,
    keyCurve: cert.publicKey?.curve ?? null,
    signatureAlgorithm: cert.signatureAlgorithm,
    isCA: cert.isCA,
    verified: cert.verified,
  }
}

/**
 * Does this certificate actually cover the name we asked for?
 * A single wildcard label matches one level and no more, which is the rule most
 * people get wrong.
 */
export function coversHost(cert, host) {
  const names = [...(cert.altNames ?? [])]
  if (cert.subject?.CN) names.push(cert.subject.CN)
  const target = String(host).toLowerCase()

  return names.some((name) => {
    const n = String(name).toLowerCase()
    if (n === target) return true
    if (!n.startsWith('*.')) return false
    const suffix = n.slice(1)                       // ".example.com"
    if (!target.endsWith(suffix)) return false
    // *.example.com covers a.example.com but not a.b.example.com.
    return !target.slice(0, target.length - suffix.length).includes('.')
  })
}
