/**
 * stack.js — encapsulation, counted.
 *
 * "Each layer wraps the one above it in its own header" is the whole meaning
 * of the network stack, and it is usually left as a picture. It is also
 * arithmetic, and the arithmetic is where the lesson actually is: a one-byte
 * message costs the same bytes of envelopes as a large one.
 * Overhead is not a percentage of anything — it is a fixed toll.
 *
 * Sizes are the ordinary ones: no IP or TCP options, Ethernet II framing.
 * Where a real packet would vary, the interface says so rather than pretending.
 */

/**
 * The layers a netlens journey actually passes through, outermost last.
 * `chapter` is where the learner met each one for real, which is what lets
 * the widget link a diagram back to a live packet.
 */
export const STACK = [
  {
    id: 'http', name: 'HTTP', osi: 7, tcpip: 'Application', chapter: 6,
    header: 0, trailer: 0,
    role: 'the request itself — this is the part you actually meant to send',
    roleHi: 'khud request — asal me tum yahi bhejna chahte the',
  },
  {
    id: 'tls', name: 'TLS record', osi: 6, tcpip: 'Application', chapter: 5,
    header: 5, trailer: 0, optional: true,
    role: 'seals it, so nothing on the path can read what is inside',
    roleHi: 'ise seal kar deta hai, taaki raaste me koi andar ka na padh sake',
  },
  {
    id: 'tcp', name: 'TCP', osi: 4, tcpip: 'Transport', chapter: 4,
    header: 20, trailer: 0,
    role: 'adds ports, so the far machine knows which program this is for',
    roleHi: 'ports jodta hai, taaki doosri machine jaane ye kis program ke liye hai',
  },
  {
    id: 'ip', name: 'IPv4', osi: 3, tcpip: 'Internet', chapter: 3,
    header: 20, trailer: 0,
    role: 'adds addresses, so every router on the way knows where to send it',
    roleHi: 'address jodta hai, taaki raaste ka har router jaane kahan bhejna hai',
  },
  {
    id: 'eth', name: 'Ethernet', osi: 2, tcpip: 'Link', chapter: 1,
    header: 14, trailer: 4,
    role: 'adds MAC addresses for the next machine, and a check that it arrived intact',
    roleHi: 'agli machine ke liye MAC address jodta hai, aur ek check ki poora pahuncha ya nahi',
  },
]

/**
 * Wrap a payload and report the size at every layer.
 *
 * @returns {{
 *   layers: Array<{...layer, before: number, after: number, added: number}>,
 *   payload: number, total: number, overhead: number, overheadPct: number
 * }}  `layers` is ordered outermost last, the order the headers go on.
 */
export function encapsulate(payload = 142, { tls = true } = {}) {
  const bytes = Math.max(0, Math.round(payload))
  const used = STACK.filter((l) => !l.optional || tls)

  let size = bytes
  const layers = used.map((l) => {
    const before = size
    const added = l.header + l.trailer
    size += added
    return { ...l, before, after: size, added }
  })

  const overhead = size - bytes
  return {
    layers,
    payload: bytes,
    total: size,
    overhead,
    overheadPct: size ? (overhead / size) * 100 : 0,
  }
}

/** Going up the stack is the same list read backwards, losing a header each time. */
export function peel(payload = 142, options = {}) {
  return encapsulate(payload, options).layers.slice().reverse()
}

/**
 * The fixed toll, stated plainly: the same envelopes cost the same bytes
 * whatever is inside them.
 */
export const overheadFor = (payload, options = {}) => encapsulate(payload, options).overhead

/**
 * OSI's seven against TCP/IP's four. Layers 5 and 6 map to nothing anybody
 * implements separately, and saying so is the point of the row.
 */
export const MODELS = [
  { osi: 7, osiName: 'Application', tcpip: 'Application', real: true },
  { osi: 6, osiName: 'Presentation', tcpip: 'Application', real: false },
  { osi: 5, osiName: 'Session', tcpip: 'Application', real: false },
  { osi: 4, osiName: 'Transport', tcpip: 'Transport', real: true },
  { osi: 3, osiName: 'Network', tcpip: 'Internet', real: true },
  { osi: 2, osiName: 'Data link', tcpip: 'Link', real: true },
  { osi: 1, osiName: 'Physical', tcpip: 'Link', real: true },
]

/** Which layer you would change to achieve a given goal — the chapter 8 challenge. */
export const SWAPS = [
  { goal: 'move the server to another country', layer: 3, why: 'a different address, and routing does the rest' },
  { goal: 'switch from Wi-Fi to a cable', layer: 2, why: 'nothing above layer 2 finds out' },
  { goal: 'replace HTTP with a chat protocol', layer: 7, why: 'the layers below carry anything' },
  { goal: 'stop anyone on the path reading it', layer: 6, why: 'that is what a TLS record does' },
  { goal: 'let one machine run two servers at once', layer: 4, why: 'two ports, one address' },
]
