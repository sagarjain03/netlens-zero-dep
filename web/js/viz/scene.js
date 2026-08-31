/**
 * scene.js — turns timeline events into something drawable.
 *
 * Pure geometry: no canvas, no DOM, so the layout is unit-tested directly.
 *
 * The important property is that this knows nothing about DNS. It reads the
 * `from`/`to` of each event and lays out whatever endpoints it finds — two
 * nodes for a lookup, a dozen for a traceroute — which is what lets chapters 3,
 * 5, 6 and 7 reuse it without a second renderer.
 */

const LOCAL_IDS = new Set(['you', 'local', 'me'])

/** Strip the port for display but keep the full string as the identity. */
export function displayName(endpoint) {
  if (LOCAL_IDS.has(endpoint)) return 'You'
  // A router that declined to answer still occupies a place on the path, but it
  // has no address to show — so it is named by its position, not by an id.
  const silent = /^hop-(\d+)$/.exec(endpoint)
  if (silent) return `hop ${silent[1]}`
  const m = /^(.*):(\d+)$/.exec(endpoint)
  return m ? m[1] : endpoint
}

export const isSilentHop = (id) => /^hop-\d+$/.test(String(id))

export function portOf(endpoint) {
  const m = /^(.*):(\d+)$/.exec(endpoint)
  return m ? m[2] : null
}

/** Which side of the wire an endpoint sits on. */
const isLocal = (id) => LOCAL_IDS.has(id)

/**
 * @param {Array} events   envelope events
 * @param {{width:number, height:number}} size
 * @returns {{nodes:Array, links:Array, order:Array}}
 */
export function layoutFromEvents(events, { width, height }) {
  if (!events?.length) return { nodes: [], links: [], order: [] }

  // Endpoints in order of first appearance. For a request/response pair this is
  // [you, resolver]; for a traceroute it is [you, hop1, hop2, …].
  const order = []
  const seen = new Set()
  for (const e of events) {
    for (const id of [e.from, e.to]) {
      if (id && !seen.has(id)) { seen.add(id); order.push(id) }
    }
  }

  const localFirst = [
    ...order.filter(isLocal),
    ...order.filter((id) => !isLocal(id)),
  ]

  const nodes = placeNodes(localFirst, { width, height }, events)
  const links = buildLinks(events, nodes)
  return { nodes, links, order: localFirst }
}

function placeNodes(ids, { width, height }, events) {
  const cy = height * 0.46
  const count = ids.length

  // Two endpoints sit opposite each other; more than two form a chain, which is
  // what a traceroute looks like.
  const marginX = count <= 2 ? width * 0.2 : width * 0.1
  const usable = width - marginX * 2

  return ids.map((id, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1)
    // A gentle alternating offset keeps a long chain from reading as one flat
    // line and gives each hop room for its label.
    const wobble = count > 2 ? (i % 2 === 0 ? -1 : 1) * Math.min(46, height * 0.09) : 0
    return {
      id,
      x: marginX + usable * t,
      y: cy + wobble,
      label: displayName(id),
      port: portOf(id),
      kind: kindFor(id, i, count, events),
      sub: '',
    }
  })
}

function kindFor(id, index, count, events) {
  if (isLocal(id)) return 'device'
  if (isSilentHop(id)) return 'silent'
  if (index === count - 1 && count > 2) return 'server'
  if (count > 2 && index > 0) return 'router'
  const port = portOf(id)
  if (port === '53') return 'resolver'
  if (port === '443' || port === '80') return 'server'
  return 'server'
}

function buildLinks(events, nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const links = []
  const seen = new Set()

  for (const e of events) {
    const a = byId.get(e.from)
    const b = byId.get(e.to)
    if (!a || !b) continue
    const key = [a.id, b.id].sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    links.push({ from: a.id, to: b.id, state: 'up' })
  }

  // A chain layout (traceroute) also wants the hop-to-hop links, which no single
  // event names because each event is you→hop.
  if (nodes.length > 2 && links.length < nodes.length - 1) {
    for (let i = 0; i < nodes.length - 1; i++) {
      const key = [nodes[i].id, nodes[i + 1].id].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      links.push({ from: nodes[i].id, to: nodes[i + 1].id, state: 'up' })
    }
  }

  return links
}

/**
 * Where a packet sits at a given progress along its event.
 * @returns {{x:number, y:number}|null}
 */
export function packetPosition(scene, event, progress) {
  const from = scene.nodes.find((n) => n.id === event.from)
  const to = scene.nodes.find((n) => n.id === event.to)
  if (!from || !to) return null
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  }
}

/** Nothing has happened yet — a single device on its own. */
export function idleScene({ width, height }) {
  return {
    nodes: [{ id: 'you', x: width * 0.5, y: height * 0.46, label: 'You', kind: 'device', port: null, sub: '' }],
    links: [],
    order: ['you'],
  }
}
