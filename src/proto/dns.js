/**
 * dns.js — a DNS wire-format codec, written by hand.
 * Replaces: dns-packet (20M weekly), dns2, native-dns, and node's own `dns`.
 *
 * LAYER 0: pure. encode() takes an object and returns bytes; decode() takes
 * bytes and returns an object. No sockets, no timers, no await. That is what
 * makes every test in dns.test.js run offline against captured fixtures, and
 * what makes the byte editor work — editing bytes and re-decoding is just
 * decode() again.
 *
 * Wire format (RFC 1035):
 *
 *   Header    12 bytes   ID, flags, and four section counts
 *   Question  QNAME + QTYPE + QCLASS
 *   Answer/Authority/Additional   NAME TYPE CLASS TTL RDLENGTH RDATA
 *
 * Two things surprise everyone reading this format for the first time, and both
 * are handled below:
 *
 *   1. A name is not a dotted string. "github.com" goes on the wire as
 *      06 g i t h u b 03 c o m 00 — each label prefixed by its length, and a
 *      zero byte to finish.
 *   2. Names are compressed. A byte pair whose top two bits are set (0xC0)
 *      is a pointer to an earlier offset in the same packet. Real responses use
 *      this constantly; a parser that ignores it fails on almost every reply.
 */
import { Reader, Writer, bitsOf, u16hex } from '../shared/bytes.js'
import { explain, NOTES } from '../shared/explain.js'

// ── tables ──────────────────────────────────────────────────────────────────

export const TYPES = {
  A: 1, NS: 2, CNAME: 5, SOA: 6, PTR: 12, MX: 15, TXT: 16,
  AAAA: 28, SRV: 33, OPT: 41, CAA: 257, ANY: 255,
}
const TYPE_NAMES = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k]))

export const CLASSES = { IN: 1, CH: 3, HS: 4 }
const CLASS_NAMES = Object.fromEntries(Object.entries(CLASSES).map(([k, v]) => [v, k]))

export const RCODES = {
  0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN',
  4: 'NOTIMP', 5: 'REFUSED', 9: 'NOTAUTH', 16: 'BADVERS',
}
const OPCODES = { 0: 'QUERY', 1: 'IQUERY', 2: 'STATUS', 4: 'NOTIFY', 5: 'UPDATE' }

export const typeName = (n) => TYPE_NAMES[n] ?? `TYPE${n}`
export const typeNumber = (s) => (typeof s === 'number' ? s : TYPES[String(s).toUpperCase()])
export const className = (n) => CLASS_NAMES[n] ?? `CLASS${n}`
export const rcodeName = (n) => RCODES[n] ?? `RCODE${n}`

const MAX_LABEL = 63
const MAX_NAME = 255
const PTR_MASK = 0xc0

// ── encode ──────────────────────────────────────────────────────────────────

/**
 * Build a DNS query.
 * @param {object} q
 * @param {string} q.domain
 * @param {string|number} [q.type='A']
 * @param {number} [q.id]        random if omitted
 * @param {boolean} [q.rd=true]  recursion desired
 * @returns {Buffer}
 */
export function encode({ domain, type = 'A', klass = 'IN', id, rd = true } = {}) {
  if (!domain || typeof domain !== 'string') throw new Error('domain is required')

  const qtype = typeNumber(type)
  if (qtype === undefined) throw new Error(`unknown record type "${type}"`)
  const qclass = typeof klass === 'number' ? klass : CLASSES[klass] ?? 1

  const w = new Writer(64)
  w.u16(id ?? randomId())
  w.u16(rd ? 0x0100 : 0x0000)   // QR=0 Opcode=0 … RD=rd
  w.u16(1)                      // QDCOUNT — exactly one question
  w.u16(0)                      // ANCOUNT
  w.u16(0)                      // NSCOUNT
  w.u16(0)                      // ARCOUNT

  encodeName(w, domain)
  w.u16(qtype)
  w.u16(qclass)

  return Buffer.from(w.done())
}

/** "github.com" → 06 g i t h u b 03 c o m 00 */
export function encodeName(w, domain) {
  const name = String(domain).replace(/\.$/, '')
  if (name === '') { w.u8(0); return w }

  let total = 1
  for (const label of name.split('.')) {
    if (label.length === 0) throw new Error(`empty label in "${domain}" (double dot?)`)
    if (label.length > MAX_LABEL) throw new Error(`label "${label}" exceeds ${MAX_LABEL} bytes`)
    total += 1 + label.length
    if (total > MAX_NAME) throw new Error(`name "${domain}" exceeds ${MAX_NAME} bytes`)
    w.u8(label.length)
    w.ascii(label)
  }
  w.u8(0)   // root label terminates the name
  return w
}

/** 16-bit query id. Unpredictability here is what makes off-path spoofing hard. */
function randomId() {
  return Math.floor(Math.random() * 0x10000)
}

// ── name decoding (with compression) ────────────────────────────────────────

/**
 * Read a name at the reader's cursor, following 0xC0 pointers.
 * Returns the name, the number of bytes consumed *in place* (a pointer is 2),
 * and whether compression was involved.
 */
export function decodeName(r) {
  const labels = []
  const start = r.offset
  const seen = new Set()          // pointer loop guard — a malicious packet can cycle
  let cursor = r.offset
  let jumped = false
  let consumed = 0
  let compressed = false

  for (;;) {
    if (cursor >= r.buf.length) throw new RangeError(`name runs past end of packet at ${cursor}`)
    const len = r.buf[cursor]

    if (len === 0) {
      cursor += 1
      if (!jumped) consumed = cursor - start
      break
    }

    if ((len & PTR_MASK) === PTR_MASK) {
      if (cursor + 1 >= r.buf.length) throw new RangeError('compression pointer truncated')
      const target = ((len & 0x3f) << 8) | r.buf[cursor + 1]
      if (seen.has(target)) throw new Error(`compression pointer loop at offset ${target}`)
      seen.add(target)
      if (!jumped) {
        consumed = cursor + 2 - start   // a pointer occupies exactly two bytes here
        jumped = true
      }
      compressed = true
      cursor = target
      continue
    }

    if ((len & PTR_MASK) !== 0) throw new Error(`invalid label length byte 0x${len.toString(16)}`)
    if (len > MAX_LABEL) throw new Error(`label length ${len} exceeds ${MAX_LABEL}`)
    if (cursor + 1 + len > r.buf.length) throw new RangeError('label runs past end of packet')

    labels.push(r.buf.subarray(cursor + 1, cursor + 1 + len).toString('ascii'))
    cursor += 1 + len
  }

  r.offset = start + consumed
  return { name: labels.join('.') || '.', consumed, compressed }
}

// ── decode ──────────────────────────────────────────────────────────────────

/**
 * Parse a full DNS message.
 * @param {Buffer|Uint8Array} input
 * @param {{lang?: 'en'|'hi'}} [opts]
 * @returns {{header, question, answers, authority, additional, tree, truncatedParse?: string}}
 */
export function decode(input, { lang = 'en' } = {}) {
  const r = new Reader(input)
  if (r.length < 12) throw new RangeError(`DNS message must be at least 12 bytes, got ${r.length}`)

  const tree = []

  // ── header ────────────────────────────────────────────────────────────────
  const id = r.u16()
  const flagsOffset = r.offset
  const hi = r.u8()
  const lo = r.u8()
  const qdcount = r.u16()
  const ancount = r.u16()
  const nscount = r.u16()
  const arcount = r.u16()

  const header = {
    id,
    qr: bitsOf(hi, 0, 1),
    opcode: bitsOf(hi, 1, 4),
    aa: bitsOf(hi, 5, 1),
    tc: bitsOf(hi, 6, 1),
    rd: bitsOf(hi, 7, 1),
    ra: bitsOf(lo, 0, 1),
    z: bitsOf(lo, 1, 3),
    rcode: bitsOf(lo, 4, 4),
    qdcount, ancount, nscount, arcount,
  }

  const f = (name, value, spanArr, bits, path, extra = {}) => ({
    name, value, span: spanArr, ...(bits ? { bits } : {}),
    ...(explain(path, lang) ? { explain: explain(path, lang) } : {}),
    ...extra,
  })

  tree.push({
    name: 'Header',
    span: [0, 12],
    children: [
      f('ID', u16hex(id), [0, 2], null, 'dns.Header.ID', { editHint: 'Change this and the reply no longer matches the question' }),
      f('QR', `${header.qr} (${header.qr ? 'response' : 'query'})`, [flagsOffset, 1], [0, 1], 'dns.Header.QR'),
      f('Opcode', `${header.opcode} (${OPCODES[header.opcode] ?? '?'})`, [flagsOffset, 1], [1, 4], 'dns.Header.Opcode'),
      f('AA', String(header.aa), [flagsOffset, 1], [5, 1], 'dns.Header.AA'),
      f('TC', String(header.tc), [flagsOffset, 1], [6, 1], 'dns.Header.TC'),
      f('RD', String(header.rd), [flagsOffset, 1], [7, 1], 'dns.Header.RD', { editHint: 'Clear this bit to ask the server NOT to do the work for you' }),
      f('RA', String(header.ra), [flagsOffset + 1, 1], [0, 1], 'dns.Header.RA'),
      f('Z', String(header.z), [flagsOffset + 1, 1], [1, 3], 'dns.Header.Z'),
      f('RCODE', `${header.rcode} (${rcodeName(header.rcode)})`, [flagsOffset + 1, 1], [4, 4], 'dns.Header.RCODE'),
      f('QDCOUNT', String(qdcount), [4, 2], null, 'dns.Header.QDCOUNT'),
      f('ANCOUNT', String(ancount), [6, 2], null, 'dns.Header.ANCOUNT'),
      f('NSCOUNT', String(nscount), [8, 2], null, 'dns.Header.NSCOUNT'),
      f('ARCOUNT', String(arcount), [10, 2], null, 'dns.Header.ARCOUNT'),
    ],
  })

  // Malformed packets are a feature here: the byte editor exists to create them.
  // Parse as far as we can, record why we stopped, and still return a tree.
  let truncatedParse
  const questions = []
  const answers = []
  const authority = []
  const additional = []

  try {
    // ── question section ────────────────────────────────────────────────────
    for (let i = 0; i < qdcount; i++) {
      const qStart = r.offset
      const { name, consumed, compressed } = decodeName(r)
      const qtype = r.u16()
      const qclass = r.u16()
      questions.push({ name, type: qtype, typeName: typeName(qtype), class: qclass })

      tree.push({
        name: qdcount > 1 ? `Question ${i + 1}` : 'Question',
        span: [qStart, r.offset - qStart],
        children: [
          f('QNAME', name, [qStart, consumed], null, 'dns.Question.QNAME',
            compressed ? { note: NOTES.compression[lang] ?? NOTES.compression.en } : {}),
          f('QTYPE', `${qtype} (${typeName(qtype)})`, [qStart + consumed, 2], null, 'dns.Question.QTYPE',
            { editHint: '0x001c asks for IPv6 (AAAA) instead of IPv4' }),
          f('QCLASS', `${qclass} (${className(qclass)})`, [qStart + consumed + 2, 2], null, 'dns.Question.QCLASS'),
        ],
      })
    }

    // ── resource-record sections ────────────────────────────────────────────
    for (const [label, count, sink] of [
      ['Answer', ancount, answers],
      ['Authority', nscount, authority],
      ['Additional', arcount, additional],
    ]) {
      for (let i = 0; i < count; i++) {
        const { record, node } = decodeRecord(r, label, count > 1 ? i + 1 : null, f, lang)
        sink.push(record)
        tree.push(node)
      }
    }
  } catch (err) {
    truncatedParse = err.message
  }

  return {
    header,
    question: questions[0] ?? null,
    questions,
    answers,
    authority,
    additional,
    tree,
    ...(truncatedParse ? { truncatedParse } : {}),
  }
}

function decodeRecord(r, sectionLabel, index, f, lang) {
  const start = r.offset
  const { name, consumed, compressed } = decodeName(r)
  const nameSpan = [start, consumed]

  const typeOffset = r.offset
  const type = r.u16()
  const klass = r.u16()
  const ttl = r.u32()
  const rdlength = r.u16()
  const rdataOffset = r.offset
  const rdata = r.bytes(rdlength)

  const value = decodeRdata(type, rdata, r, rdataOffset)

  const record = {
    name, type, typeName: typeName(type), class: klass, ttl, rdlength, value,
    data: Buffer.from(rdata).toString('hex'),
  }

  const children = [
    f('NAME', name, nameSpan, null, 'dns.RR.NAME',
      compressed ? { note: NOTES.compression[lang] ?? NOTES.compression.en } : {}),
    f('TYPE', `${type} (${typeName(type)})`, [typeOffset, 2], null, 'dns.RR.TYPE'),
    f('CLASS', `${klass} (${className(klass)})`, [typeOffset + 2, 2], null, 'dns.RR.CLASS'),
    f('TTL', `${ttl}s (${humanTtl(ttl)})`, [typeOffset + 4, 4], null, 'dns.RR.TTL'),
    f('RDLENGTH', String(rdlength), [typeOffset + 8, 2], null, 'dns.RR.RDLENGTH'),
    f(typeName(type), value, [rdataOffset, rdlength], null, 'dns.RR.RDATA'),
  ]

  return {
    record,
    node: {
      name: `${sectionLabel}${index ? ' ' + index : ''} · ${typeName(type)}`,
      span: [start, r.offset - start],
      children,
    },
  }
}

/** Turn RDATA bytes into something a human reads. Unknown types fall back to hex. */
function decodeRdata(type, rdata, r, rdataOffset) {
  switch (type) {
    case TYPES.A:
      if (rdata.length !== 4) return `malformed A record (${rdata.length} bytes, expected 4)`
      return Array.from(rdata).join('.')

    case TYPES.AAAA: {
      if (rdata.length !== 16) return `malformed AAAA record (${rdata.length} bytes, expected 16)`
      const groups = []
      for (let i = 0; i < 16; i += 2) groups.push(rdata.readUInt16BE(i).toString(16))
      return compressIPv6(groups)
    }

    case TYPES.NS:
    case TYPES.CNAME:
    case TYPES.PTR:
      return decodeName(r.at(rdataOffset)).name

    case TYPES.MX: {
      const pref = rdata.readUInt16BE(0)
      return `${pref} ${decodeName(r.at(rdataOffset + 2)).name}`
    }

    case TYPES.TXT: {
      const parts = []
      let o = 0
      while (o < rdata.length) {
        const len = rdata[o]
        parts.push(rdata.subarray(o + 1, o + 1 + len).toString('utf8'))
        o += 1 + len
      }
      return parts.join(' ')
    }

    case TYPES.SOA: {
      const rr = r.at(rdataOffset)
      const mname = decodeName(rr).name
      const rname = decodeName(rr).name
      const serial = rr.u32()
      return `${mname} ${rname} serial=${serial}`
    }

    case TYPES.SRV: {
      const priority = rdata.readUInt16BE(0)
      const weight = rdata.readUInt16BE(2)
      const port = rdata.readUInt16BE(4)
      return `${priority} ${weight} ${port} ${decodeName(r.at(rdataOffset + 6)).name}`
    }

    case TYPES.CAA: {
      const tagLen = rdata[1]
      const tag = rdata.subarray(2, 2 + tagLen).toString('ascii')
      return `${rdata[0]} ${tag} "${rdata.subarray(2 + tagLen).toString('ascii')}"`
    }

    default:
      return Buffer.from(rdata).toString('hex')
  }
}

/** RFC 5952 :: compression — collapse the longest run of zero groups. */
function compressIPv6(groups) {
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0
  groups.forEach((g, i) => {
    if (g === '0') {
      if (curStart < 0) { curStart = i; curLen = 0 }
      curLen++
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart }
    } else {
      curStart = -1; curLen = 0
    }
  })
  if (bestLen < 2) return groups.join(':')
  return `${groups.slice(0, bestStart).join(':')}::${groups.slice(bestStart + bestLen).join(':')}`
}

function humanTtl(s) {
  if (s < 60) return `${s} sec`
  if (s < 3600) return `${Math.round(s / 60)} min`
  if (s < 86400) return `${Math.round(s / 3600)} hr`
  return `${Math.round(s / 86400)} days`
}

// ── presentation ────────────────────────────────────────────────────────────

/** dig-style answer lines for the terminal. */
export function formatAnswers(msg) {
  return msg.answers.map(
    (a) => `${a.name}.\t${a.ttl}\t${className(a.class)}\t${a.typeName}\t${a.value}`,
  )
}
