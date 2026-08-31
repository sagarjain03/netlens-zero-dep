/**
 * index.js — the topic registry.
 *
 * TOPICS is the reference half of the app. JOURNEY is a story you take once,
 * start to finish; this is what you come back to the night before an exam,
 * organised the way a syllabus is rather than the way a narrative is.
 *
 * The two are wired to each other in both directions: a topic names the
 * chapter where the thing is visible on a live packet, and a chapter's
 * glossary terms point at the topics that go deeper. That link is the one
 * move a textbook cannot make, and it is why this is not a worse copy of one.
 *
 * Only the index is eager. A topic's content is a dynamic `import()`, so the
 * browser fetches one small file when it is opened rather than thirty-four on
 * boot. (Note for build.js: a single-file build has to inline these.)
 *
 * The rule for what earns a topic file: it has to have something you can
 * operate. A topic that would only ever be prose belongs inside its
 * neighbour, not on its own page.
 */

/** @typedef {{id: string, title: string, lab?: string, see?: number}} TopicEntry */

export const MODULES = [
  {
    id: 'basics',
    title: 'Computer Networks',
    topics: [
      { id: 'what-is-a-network', title: 'What a network is', see: 1 },
      { id: 'internet', title: 'The internet', see: 3 },
      { id: 'devices', title: 'Network devices', lab: 'compare', see: 1 },
      { id: 'models', title: 'OSI and TCP/IP', lab: 'layers', see: 8 },
    ],
  },
  {
    id: 'physical',
    title: 'Physical Layer',
    topics: [
      { id: 'physical-layer', title: 'The physical layer' },
      { id: 'topology', title: 'Network topology', lab: 'topology' },
      { id: 'transmission', title: 'Transmission modes and media' },
    ],
  },
  {
    id: 'data-link',
    title: 'Data Link Layer',
    topics: [
      { id: 'data-link-layer', title: 'The data link layer', see: 1 },
      { id: 'framing', title: 'Framing', lab: 'bitstuff' },
      { id: 'error-detection', title: 'Error detection', lab: 'crc' },
      { id: 'error-correction', title: 'Error correction', lab: 'hamming' },
      { id: 'flow-control', title: 'Flow control', lab: 'arq' },
      { id: 'piggybacking', title: 'Piggybacking', lab: 'arq' },
      { id: 'switching', title: 'Switching and VLANs', lab: 'compare' },
    ],
  },
  {
    id: 'network',
    title: 'Network Layer',
    topics: [
      { id: 'network-layer', title: 'The network layer', see: 3 },
      { id: 'ip-address', title: 'IP addresses', lab: 'subnet', see: 1 },
      { id: 'classful', title: 'Classful and classless', lab: 'subnet' },
      { id: 'subnetting', title: 'Subnetting', lab: 'subnet' },
      { id: 'ipv4-header', title: 'The IPv4 header', lab: 'ipv4' },
      { id: 'ipv4-vs-ipv6', title: 'IPv4 vs IPv6', lab: 'compare', see: 2 },
      { id: 'public-private', title: 'Public and private addresses', lab: 'subnet', see: 1 },
      { id: 'routing', title: 'Routing', see: 3 },
    ],
  },
  {
    id: 'transport',
    title: 'Transport Layer',
    topics: [
      { id: 'transport-layer', title: 'The transport layer', see: 4 },
      { id: 'tcp', title: 'TCP', see: 4 },
      { id: 'udp', title: 'UDP', see: 2 },
      { id: 'tcp-vs-udp', title: 'TCP vs UDP', lab: 'compare', see: 4 },
      { id: 'ports', title: 'Ports and sockets', see: 4 },
    ],
  },
  {
    id: 'session',
    title: 'Session & Presentation',
    topics: [
      { id: 'session-presentation', title: 'Session and presentation', lab: 'layers', see: 8 },
      { id: 'ssl-tls', title: 'SSL and TLS', see: 5 },
      { id: 'mime', title: 'MIME', see: 6 },
    ],
  },
  {
    id: 'application',
    title: 'Application Layer',
    topics: [
      { id: 'application-layer', title: 'The application layer', see: 6 },
      { id: 'client-server', title: 'Client and server', see: 6 },
      { id: 'dns', title: 'DNS', see: 2 },
      { id: 'www-http', title: 'The web and HTTP', see: 6 },
      { id: 'email', title: 'Electronic mail', see: 2 },
      { id: 'cdn', title: 'Content delivery networks', see: 3 },
    ],
  },
]

/** Flat list, in syllabus order — what "next topic" walks. */
export const TOPICS = MODULES.flatMap((m) =>
  m.topics.map((t) => ({ ...t, module: m.id, moduleTitle: m.title })))

export const IDS = TOPICS.map((t) => t.id)

export const entry = (id) => TOPICS.find((t) => t.id === id) ?? null

export const moduleOf = (id) => MODULES.find((m) => m.topics.some((t) => t.id === id)) ?? null

/** The one before and after, for walking a module without going back to the rail. */
export function neighbours(id) {
  const at = IDS.indexOf(id)
  return {
    prev: at > 0 ? TOPICS[at - 1] : null,
    next: at >= 0 && at < TOPICS.length - 1 ? TOPICS[at + 1] : null,
  }
}

/**
 * Content is loaded a module at a time, not a topic at a time. Somebody who
 * opens "framing" opens "error detection" next; fetching those separately
 * buys nothing and costs a round trip each.
 *
 * Written as a static map rather than a computed template literal so a bundler
 * can see every target — a computed `import()` is invisible to static analysis
 * and would leave the single-file build with no topics in it.
 */
const MODULE_FILES = {
  basics: () => import('./basics.js'),
  physical: () => import('./physical.js'),
  'data-link': () => import('./data-link.js'),
  network: () => import('./network.js'),
  transport: () => import('./transport.js'),
  session: () => import('./session.js'),
  application: () => import('./application.js'),
}

/**
 * Which topics actually have content written. Kept explicit rather than
 * inferred, so the rail can show the whole syllabus honestly — a topic that
 * is listed but not yet written says so instead of opening blank.
 */
export const WRITTEN = new Set([
  // Basics — written last on purpose: an introduction is easier to write
  // once you know what it has to introduce.
  'what-is-a-network', 'internet', 'devices', 'models',
  // Physical — the one module a program cannot observe directly, so it
  // measures the mark the medium does leave: time.
  'physical-layer', 'topology', 'transmission',
  // Data Link — nothing here is observable from a process, so every topic
  // opens a lab.
  'data-link-layer', 'framing', 'error-detection', 'error-correction',
  'flow-control', 'piggybacking', 'switching',
  // Network — the most arithmetic in the syllabus, and the part most likely
  // to be examined with a pencil. Every topic opens the lab that does it.
  'network-layer', 'ip-address', 'classful', 'subnetting',
  'ipv4-header', 'ipv4-vs-ipv6', 'public-private', 'routing',
  // Transport — where the honest limits matter most: a process sees the
  // socket, never the handshake bytes.
  'transport-layer', 'tcp', 'udp', 'tcp-vs-udp', 'ports',
  // Session & Presentation — the module that has to be most honest: the
  // jobs are real, the layers are not implemented separately by anybody.
  'session-presentation', 'ssl-tls', 'mime',
  // Application — the opposite: almost all of it is REAL, so these are
  // driven by live commands instead.
  'application-layer', 'client-server', 'dns', 'www-http', 'email', 'cdn',
])

export const hasContent = (id) => WRITTEN.has(id)

/** Progress through the syllabus, for the rail's counter. */
export const coverage = () => ({ written: WRITTEN.size, total: IDS.length })

const cache = new Map()

export async function loadTopic(id) {
  if (!WRITTEN.has(id)) return null

  const mod = moduleOf(id)
  const load = mod && MODULE_FILES[mod.id]
  if (!load) return null

  if (!cache.has(mod.id)) cache.set(mod.id, load().then((m) => m.default ?? {}))
  const topics = await cache.get(mod.id)
  return topics[id] ?? null
}
