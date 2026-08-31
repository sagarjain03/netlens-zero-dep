/**
 * topo.js — network topologies as graphs.
 *
 * Fourth in the family with algo.js, arq.js and addr.js: pure, tested, no DOM.
 *
 * Topology is usually taught as four pictures and a table of adjectives —
 * "reliable", "expensive", "easy to extend". None of that is checkable. What
 * IS checkable is the graph: how many cables it costs, who can still hear you
 * once a cable is cut, and whether the whole thing splits in two. Those are
 * the three questions the widget lets a learner ask, so they live here.
 *
 * Positions are on a 0..1 square; the renderer scales them.
 */

export const KINDS = ['bus', 'star', 'ring', 'mesh']

/**
 * @returns {{kind, n, nodes: Array<{id,x,y,role}>, links: Array<{id,a,b}>}}
 *   For a star, node 0 is the hub. For a bus, the links are the segments of
 *   the shared cable between consecutive taps.
 */
export function build(kind, n) {
  const count = Math.max(2, Math.min(12, n))
  const nodes = []
  const links = []
  const link = (a, b) => links.push({ id: `${a}-${b}`, a, b })

  if (kind === 'bus') {
    // Taps along one cable. The cable itself is what breaks.
    for (let i = 0; i < count; i++) {
      nodes.push({ id: i, x: (i + 0.5) / count, y: 0.25, role: 'host' })
    }
    for (let i = 0; i + 1 < count; i++) link(i, i + 1)
    return { kind, n: count, nodes, links }
  }

  if (kind === 'star') {
    // The hub is node 0 and sits in the middle. Everything else is a spoke.
    nodes.push({ id: 0, x: 0.5, y: 0.5, role: 'hub' })
    for (let i = 1; i < count; i++) {
      const a = (2 * Math.PI * (i - 1)) / (count - 1) - Math.PI / 2
      nodes.push({ id: i, x: 0.5 + 0.36 * Math.cos(a), y: 0.5 + 0.36 * Math.sin(a), role: 'host' })
      link(0, i)
    }
    return { kind, n: count, nodes, links }
  }

  // ring and mesh both sit on a circle
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * i) / count - Math.PI / 2
    nodes.push({ id: i, x: 0.5 + 0.36 * Math.cos(a), y: 0.5 + 0.36 * Math.sin(a), role: 'host' })
  }

  if (kind === 'ring') {
    for (let i = 0; i < count; i++) link(i, (i + 1) % count)
  } else {
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) link(i, j)
  }

  return { kind, n: count, nodes, links }
}

/** What the topology costs in cable, before anyone has sent anything. */
export function cableCount(kind, n) {
  const c = Math.max(2, Math.min(12, n))
  if (kind === 'bus') return c - 1
  if (kind === 'star') return c - 1
  if (kind === 'ring') return c
  return (c * (c - 1)) / 2      // mesh: every pair, so it grows as the square
}

/**
 * Who hears a frame sent from `from`, given some broken links.
 *
 * A bus is a shared medium, not a chain of hops: everything electrically
 * connected hears the signal at once, which is exactly why it needs collision
 * detection and why nothing on it is private. So hop distance is 1 for every
 * reachable node rather than the number of taps in between. The other three
 * are ordinary graphs and get an ordinary breadth-first search.
 *
 * @returns {Map<number, number>} node id -> hops (0 for the sender)
 */
export function reach(topology, from, broken = new Set()) {
  const live = topology.links.filter((l) => !broken.has(l.id))
  const seen = new Map([[from, 0]])

  const neighbours = new Map(topology.nodes.map((nd) => [nd.id, []]))
  for (const l of live) {
    neighbours.get(l.a).push(l.b)
    neighbours.get(l.b).push(l.a)
  }

  const queue = [from]
  while (queue.length) {
    const at = queue.shift()
    for (const next of neighbours.get(at) ?? []) {
      if (seen.has(next)) continue
      seen.set(next, seen.get(at) + 1)
      queue.push(next)
    }
  }

  if (topology.kind === 'bus') {
    for (const id of seen.keys()) if (id !== from) seen.set(id, 1)
  }

  return seen
}

/** Is every machine still able to reach every other one? */
export function connected(topology, broken = new Set()) {
  const first = topology.nodes[0]?.id
  if (first === undefined) return true
  return reach(topology, first, broken).size === topology.nodes.length
}

/**
 * The honest resilience answer: how many single cables can be cut before
 * somebody is cut off. Computed by trying each one, not asserted from a table.
 */
export function survivesAnySingleBreak(topology) {
  return topology.links.every((l) => connected(topology, new Set([l.id])))
}

/**
 * A node whose removal splits the network — an articulation point, which is
 * what "single point of failure" actually means. Found by removing each node
 * and checking, which is slow and completely clear.
 */
export function singlePointsOfFailure(topology) {
  const out = []
  for (const node of topology.nodes) {
    const rest = topology.nodes.filter((nd) => nd.id !== node.id)
    if (rest.length < 2) continue

    const gone = new Set(topology.links.filter((l) => l.a === node.id || l.b === node.id).map((l) => l.id))
    const seen = reach({ ...topology, kind: 'graph' }, rest[0].id, gone)
    const stillTogether = rest.every((nd) => seen.has(nd.id))
    if (!stillTogether) out.push(node.id)
  }
  return out
}

/** The one-line character of each topology, so the widget stays data-driven. */
export const TRAITS = {
  bus: {
    cable: 'one shared cable, tapped once per machine',
    listen: 'everyone hears everything — privacy needs encryption, not the wiring',
    fail: 'cut the cable anywhere and it splits into two networks that cannot see each other',
    why: 'cheap and easy to extend, which is why early Ethernet worked this way. Switches replaced it.',
  },
  star: {
    cable: 'one cable per machine, all of them to the middle',
    listen: 'only the hub hears everything; a switch sends each frame to just one port',
    fail: 'a broken spoke loses one machine — a broken hub loses all of them',
    why: 'what almost every real network looks like today, because one failure is usually one machine.',
  },
  ring: {
    cable: 'one cable per machine, joined into a loop',
    listen: 'a frame travels around until it reaches its destination',
    fail: 'one break still leaves a path the long way round; two breaks split it',
    why: 'the loop is the redundancy, and it is also the thing that makes adding a machine disruptive.',
  },
  mesh: {
    cable: 'a cable between every pair of machines',
    listen: 'every conversation has its own wire',
    fail: 'nothing short of isolating a machine takes anyone off the network',
    why: 'the most robust and the least affordable: cables grow as the square of machines.',
  },
}
