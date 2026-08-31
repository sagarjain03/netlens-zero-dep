/**
 * addr.js — addressing arithmetic.
 *
 * Third in the same family as algo.js and arq.js: pure functions, no DOM, its
 * own tests. Subnetting is the part of the syllabus students most need to
 * *practise* rather than read, and the only way a lab can be trusted to teach
 * it is if the arithmetic is the real thing.
 *
 * Addresses are handled as unsigned 32-bit integers. JavaScript's bitwise
 * operators produce signed results, so every one of them is followed by
 * `>>> 0` — miss one and 128.0.0.0 comes out negative.
 */

// ── IPv4 addresses ─────────────────────────────────────────────────────────

/** @returns {{ok: boolean, value?: number, octets?: number[], error?: string}} */
export function parseIPv4(text) {
  const parts = String(text).trim().split('.')
  if (parts.length !== 4) return { ok: false, error: 'an address has four parts separated by dots' }

  const octets = []
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return { ok: false, error: `"${p}" is not a number between 0 and 255` }
    const n = Number(p)
    if (n > 255) return { ok: false, error: `${n} is too big — one octet holds 0 to 255` }
    octets.push(n)
  }

  const value = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
  return { ok: true, value, octets }
}

export const formatIPv4 = (value) => [24, 16, 8, 0]
  .map((shift) => (value >>> shift) & 0xff)
  .join('.')

/** All 32 bits, most significant first — what the mask actually operates on. */
export const bitsOf = (value) =>
  Array.from({ length: 32 }, (_, i) => (value >>> (31 - i)) & 1)

// ── masks ──────────────────────────────────────────────────────────────────

/** A shift of 32 is a no-op in JavaScript, so /0 has to be handled by hand. */
export const maskFromPrefix = (prefix) =>
  (prefix <= 0 ? 0 : prefix >= 32 ? 0xffffffff : (0xffffffff << (32 - prefix)) >>> 0) >>> 0

/**
 * A mask is only valid if its ones are contiguous from the left.
 * 255.255.255.0 is a mask; 255.0.255.0 is a typo.
 * @returns {number|null} the prefix length, or null if the mask is not contiguous
 */
export function prefixFromMask(mask) {
  const m = mask >>> 0
  const inverted = (~m) >>> 0
  // A contiguous mask has an inverse that is all ones at the bottom, so
  // adding one to it must roll over to a single high bit (or to zero).
  if (((inverted + 1) & inverted) !== 0) return null
  let prefix = 0
  for (let i = 0; i < 32; i++) if ((m >>> (31 - i)) & 1) prefix++
  return prefix
}

// ── what a prefix actually gives you ───────────────────────────────────────

/**
 * @returns {{
 *   prefix, mask, wildcard, network, broadcast,
 *   firstHost, lastHost, total, usable
 * }}
 */
export function subnetInfo(address, prefix) {
  const p = Math.max(0, Math.min(32, prefix))
  const mask = maskFromPrefix(p)
  const network = (address & mask) >>> 0
  const wildcard = (~mask) >>> 0
  const broadcast = (network | wildcard) >>> 0
  const total = 2 ** (32 - p)

  // /31 and /32 are the exceptions everyone forgets. A /32 is one host and no
  // network or broadcast to spare; a /31 is a point-to-point link where both
  // addresses are usable (RFC 3021) precisely because there is no room for the
  // usual two.
  const usable = p >= 31 ? (p === 32 ? 1 : 2) : total - 2
  const firstHost = p >= 31 ? network : (network + 1) >>> 0
  const lastHost = p >= 31 ? broadcast : (broadcast - 1) >>> 0

  return { prefix: p, mask, wildcard, network, broadcast, firstHost, lastHost, total, usable }
}

/** Do two addresses sit on the same network under this mask? */
export const sameNetwork = (a, b, prefix) => {
  const mask = maskFromPrefix(prefix)
  return ((a & mask) >>> 0) === ((b & mask) >>> 0)
}

// ── classful addressing, and why it went away ──────────────────────────────

const CLASSES = [
  { letter: 'A', from: 0, to: 127, prefix: 8, note: '126 networks of 16 million hosts each' },
  { letter: 'B', from: 128, to: 191, prefix: 16, note: '16,384 networks of 65,534 hosts each' },
  { letter: 'C', from: 192, to: 223, prefix: 24, note: '2 million networks of just 254 hosts each' },
  { letter: 'D', from: 224, to: 239, prefix: null, note: 'multicast — one packet, many receivers' },
  { letter: 'E', from: 240, to: 255, prefix: null, note: 'reserved, and never used for anything' },
]

export function classOf(address) {
  const first = (address >>> 24) & 0xff
  return CLASSES.find((c) => first >= c.from && first <= c.to) ?? null
}

// ── ranges that are not ordinary addresses ─────────────────────────────────

const SPECIAL = [
  { cidr: '0.0.0.0/8', kind: 'this network', note: 'means "this network", used before a machine has an address' },
  { cidr: '10.0.0.0/8', kind: 'private', note: 'private — no public router will forward it' },
  { cidr: '127.0.0.0/8', kind: 'loopback', note: 'loopback — never leaves the machine' },
  { cidr: '169.254.0.0/16', kind: 'link-local', note: 'link-local — what a machine assigns itself when DHCP fails' },
  { cidr: '172.16.0.0/12', kind: 'private', note: 'private — no public router will forward it' },
  { cidr: '192.168.0.0/16', kind: 'private', note: 'private — no public router will forward it' },
  { cidr: '100.64.0.0/10', kind: 'carrier NAT', note: 'shared space for ISPs that run their own NAT' },
  { cidr: '224.0.0.0/4', kind: 'multicast', note: 'multicast — a group, not a machine' },
  { cidr: '240.0.0.0/4', kind: 'reserved', note: 'reserved, and never used for anything' },
]

/** @returns {{cidr, kind, note}|null} */
export function specialOf(address) {
  if (address >>> 0 === 0xffffffff) {
    return { cidr: '255.255.255.255', kind: 'broadcast', note: 'everyone on this link, all at once' }
  }
  for (const s of SPECIAL) {
    const [base, prefix] = s.cidr.split('/')
    const parsed = parseIPv4(base)
    if (parsed.ok && sameNetwork(address, parsed.value, Number(prefix))) return s
  }
  return null
}

// ── splitting one network into several ─────────────────────────────────────

/**
 * Borrow bits from the host part. Borrowing n bits doubles the subnet count
 * n times and halves the hosts each one holds — the whole trade in one line.
 *
 * @param {number} limit  how many to return; the rest are counted, not built
 */
export function splitSubnets(network, prefix, newPrefix, limit = 16) {
  if (newPrefix < prefix || newPrefix > 32) return { count: 0, borrowed: 0, subnets: [], truncated: 0 }

  const borrowed = newPrefix - prefix
  const count = 2 ** borrowed
  const step = 2 ** (32 - newPrefix)
  const base = (network & maskFromPrefix(prefix)) >>> 0

  const subnets = []
  for (let i = 0; i < Math.min(count, limit); i++) {
    subnets.push(subnetInfo((base + i * step) >>> 0, newPrefix))
  }

  return { count, borrowed, subnets, truncated: Math.max(0, count - subnets.length) }
}

// ── the IPv4 header ────────────────────────────────────────────────────────

export const PROTOCOLS = { 1: 'ICMP', 6: 'TCP', 17: 'UDP', 41: 'IPv6', 89: 'OSPF' }

/**
 * The 20-byte header, built from its values so that changing one and watching
 * the checksum move is a thing the learner can do.
 */
export function buildIPv4Header({
  dscp = 0, totalLength = 60, id = 0x1c46, dontFragment = true,
  fragmentOffset = 0, ttl = 64, protocol = 6, src = 0, dst = 0,
} = {}) {
  const b = new Uint8Array(20)

  b[0] = (4 << 4) | 5                       // version 4, header length 5 words
  b[1] = (dscp & 0x3f) << 2
  b[2] = (totalLength >>> 8) & 0xff
  b[3] = totalLength & 0xff
  b[4] = (id >>> 8) & 0xff
  b[5] = id & 0xff

  const flags = dontFragment ? 0b010 : 0
  b[6] = (flags << 5) | ((fragmentOffset >>> 8) & 0x1f)
  b[7] = fragmentOffset & 0xff

  b[8] = ttl & 0xff
  b[9] = protocol & 0xff
  // bytes 10-11 are the checksum, left at zero while it is computed

  for (let i = 0; i < 4; i++) {
    b[12 + i] = (src >>> (24 - 8 * i)) & 0xff
    b[16 + i] = (dst >>> (24 - 8 * i)) & 0xff
  }

  const checksum = ipv4Checksum(b)
  b[10] = (checksum >>> 8) & 0xff
  b[11] = checksum & 0xff

  return { bytes: b, checksum, fields: describeIPv4(b) }
}

/**
 * One's-complement sum of the header as 16-bit words, with the checksum field
 * itself counted as zero. Every router recomputes this on every hop, because
 * every router has just decremented the TTL.
 */
export function ipv4Checksum(bytes) {
  let sum = 0
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    if (i === 10) continue                                   // the checksum field
    sum += ((bytes[i] << 8) | bytes[i + 1]) >>> 0
  }
  while (sum >>> 16) sum = ((sum & 0xffff) + (sum >>> 16)) >>> 0
  return (~sum) & 0xffff
}

/** Does the checksum in the header match the header it is attached to? */
export function verifyIPv4Checksum(bytes) {
  const stored = ((bytes[10] << 8) | bytes[11]) >>> 0
  const computed = ipv4Checksum(bytes)
  return { ok: stored === computed, stored, computed }
}

/** Field map for the header view: name, byte span, value and what it means. */
export function describeIPv4(b) {
  const u16 = (i) => ((b[i] << 8) | b[i + 1]) >>> 0
  const ip = (i) => formatIPv4(((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0)
  const proto = PROTOCOLS[b[9]] ?? 'unknown'

  return [
    { name: 'Version', at: 0, bits: '0-3', value: b[0] >> 4, note: '4 means IPv4' },
    { name: 'IHL', at: 0, bits: '4-7', value: b[0] & 0x0f, note: 'header length in 4-byte words, so 5 means 20 bytes' },
    { name: 'DSCP', at: 1, len: 1, value: b[1] >> 2, note: 'traffic class — how routers should prioritise this' },
    { name: 'Total length', at: 2, len: 2, value: u16(2), note: 'header plus payload, in bytes' },
    { name: 'Identification', at: 4, len: 2, value: u16(4), note: 'ties fragments of one packet back together' },
    { name: 'Flags', at: 6, bits: '0-2', value: b[6] >> 5, note: 'bit 1 is "do not fragment"' },
    { name: 'Fragment offset', at: 6, len: 2, value: u16(6) & 0x1fff, note: 'where this fragment sits in the original' },
    { name: 'TTL', at: 8, len: 1, value: b[8], note: 'every router subtracts one; at zero the packet is discarded' },
    { name: 'Protocol', at: 9, len: 1, value: `${b[9]} (${proto})`, note: 'what is inside — this is how the kernel knows who to hand it to' },
    { name: 'Checksum', at: 10, len: 2, value: `0x${u16(10).toString(16).padStart(4, '0')}`, note: 'covers the header only, and is recomputed at every hop' },
    { name: 'Source', at: 12, len: 4, value: ip(12), note: 'who sent it' },
    { name: 'Destination', at: 16, len: 4, value: ip(16), note: 'where it is going — the only field routing looks at' },
  ]
}

// ── IPv6 notation ──────────────────────────────────────────────────────────

/** Full form: eight groups of four hex digits, nothing left out. */
export function expandIPv6(text) {
  const s = String(text).trim()
  if (!s.includes(':')) return null

  const [head, tail = ''] = s.split('::')
  const left = head ? head.split(':').filter(Boolean) : []
  const right = tail ? tail.split(':').filter(Boolean) : []
  if (!s.includes('::') && left.length !== 8) return null
  if (left.length + right.length > 8) return null

  const middle = new Array(8 - left.length - right.length).fill('0')
  const groups = [...left, ...(s.includes('::') ? middle : []), ...right]
  if (groups.length !== 8) return null
  if (!groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g))) return null

  return groups.map((g) => g.toLowerCase().padStart(4, '0'))
}

/**
 * Shortest legal form: drop leading zeros, then collapse the single longest
 * run of zero groups. Only one run may be collapsed, or the address would be
 * ambiguous — that rule is the whole reason `::` appears at most once.
 */
export function compressIPv6(groups) {
  const trimmed = groups.map((g) => g.replace(/^0+(?=.)/, ''))

  let bestAt = -1
  let bestLen = 0
  let at = -1
  let len = 0

  for (let i = 0; i <= trimmed.length; i++) {
    if (i < trimmed.length && trimmed[i] === '0') {
      if (at < 0) at = i
      len++
    } else {
      if (len > bestLen) { bestLen = len; bestAt = at }
      at = -1
      len = 0
    }
  }

  if (bestLen < 2) return trimmed.join(':')

  const head = trimmed.slice(0, bestAt).join(':')
  const tail = trimmed.slice(bestAt + bestLen).join(':')
  return `${head}::${tail}`
}
