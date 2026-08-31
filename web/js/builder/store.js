
import { spec } from './devices.js'

const KEY = 'netlens.builder.topology'

let seq = 1
const listeners = new Set()

let state = {
  nodes: [],          // { id, kind, name, x, y, ip, mask, gw, ports }
  links: [],          // { id, a, b, kind }
  selected: null,     // node id
  tool: 'select',     // select | cable | delete
  cableKind: 'straight',
  pending: null,      // first endpoint while drawing a cable
  log: [],            // commands the learner has run — the tutor reads this
}

export const get = () => state
export const sub = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export function set(patch) {
  state = { ...state, ...patch }
  for (const fn of listeners) fn(state)
}

export const node = (id) => state.nodes.find((n) => n.id === id) ?? null
export const linksOf = (id) => state.links.filter((l) => l.a === id || l.b === id)

/** How many free ports a device has left. */
export function freePorts(id) {
  const n = node(id)
  if (!n) return 0
  return Math.max(0, n.ports - linksOf(id).length)
}

// ── mutations ───────────────────────────────────────────────────────────────

export function addNode(kind, x, y) {
  const s = spec(kind)
  if (!s) return null
  const n = {
    id: `n${seq++}`,
    kind,
    name: nextName(s.name),
    x: Math.round(x),
    y: Math.round(y),
    ports: s.ports,
    ip: s.defaults?.ip ?? '',
    mask: s.defaults?.mask ?? '',
    gw: s.defaults?.gw ?? '',
  }
  set({ nodes: [...state.nodes, n], selected: n.id })
  return n
}

/** PC0, PC1, PC2 … the way every network tool has always named things. */
function nextName(base) {
  const used = new Set(state.nodes.map((n) => n.name))
  for (let i = 0; ; i++) {
    const candidate = `${base}${i}`
    if (!used.has(candidate)) return candidate
  }
}

export function moveNode(id, x, y) {
  set({ nodes: state.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) })
}

export function updateNode(id, patch) {
  set({ nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })
}

export function removeNode(id) {
  set({
    nodes: state.nodes.filter((n) => n.id !== id),
    links: state.links.filter((l) => l.a !== id && l.b !== id),
    selected: state.selected === id ? null : state.selected,
    pending: state.pending === id ? null : state.pending,
  })
}

/** @returns {{ok:boolean, reason?:string}} */
export function addLink(a, b, kind) {
  if (a === b) return { ok: false, reason: 'a cable needs two different devices' }
  if (state.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) {
    return { ok: false, reason: 'those two are already wired together' }
  }
  if (freePorts(a) <= 0) return { ok: false, reason: `${node(a).name} has no free port` }
  if (freePorts(b) <= 0) return { ok: false, reason: `${node(b).name} has no free port` }

  set({ links: [...state.links, { id: `l${seq++}`, a, b, kind }] })
  return { ok: true }
}

export function removeLink(id) {
  set({ links: state.links.filter((l) => l.id !== id) })
}

export function clear() {
  set({ nodes: [], links: [], selected: null, pending: null })
}

/** Force a repaint without changing anything. The tutor uses it for its own UI. */
export function touch() { set({}) }

/**
 * A record of what the learner has actually run. Lesson checks read this, which
 * is how a step can be "run ping and watch it fail" rather than only "arrange
 * the boxes correctly".
 */
export function recordCommand(entry) {
  set({ log: [...state.log, { t: Date.now(), ...entry }] })
}

export function clearLog() { set({ log: [] }) }

/** Drop a whole prepared topology in. Used by lesson setups. */
export function loadTopology(topo) {
  seq = 1 + [...(topo.nodes ?? []), ...(topo.links ?? [])]
    .reduce((max, o) => Math.max(max, Number(String(o.id).slice(1)) || 0), 0)
  set({
    nodes: (topo.nodes ?? []).map((n) => ({ ...n })),
    links: (topo.links ?? []).map((l) => ({ ...l })),
    selected: (topo.nodes ?? [])[0]?.id ?? null,
    pending: null,
  })
}

// ── persistence ─────────────────────────────────────────────────────────────
// localStorage is the right size of tool here: the topology belongs to this
// browser, and saving it must not need a server route we are not allowed to add.

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ nodes: state.nodes, links: state.links }))
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err.message }
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ok: false, reason: 'nothing saved yet' }
    const data = JSON.parse(raw)
    if (!Array.isArray(data.nodes)) return { ok: false, reason: 'saved file is not a topology' }
    seq = 1 + data.nodes.concat(data.links ?? [])
      .reduce((max, o) => Math.max(max, Number(String(o.id).slice(1)) || 0), 0)
    set({ nodes: data.nodes, links: data.links ?? [], selected: null, pending: null })
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err.message }
  }
}

/** A worked topology, so an empty screen is never the first thing anyone meets. */
export function example() {
  const mk = (id, kind, name, x, y, ip, mask, gw) => ({
    id, kind, name, x, y, ports: spec(kind).ports, ip, mask, gw,
  })
  const nodes = [
    mk('n1', 'pc', 'PC0', 90, 90, '192.168.1.10', '255.255.255.0', '192.168.1.1'),
    mk('n2', 'pc', 'PC1', 90, 260, '192.168.1.11', '255.255.255.0', '192.168.1.1'),
    mk('n3', 'printer', 'PRINTER0', 90, 420, '192.168.1.50', '255.255.255.0', '192.168.1.1'),
    mk('n4', 'switch8', 'SWITCH_8P0', 330, 260, '', '', ''),
    mk('n5', 'homerouter', 'HOME_ROUTER0', 560, 260, '192.168.1.1', '255.255.255.0', ''),
    mk('n6', 'cloud', 'INTERNET0', 790, 260, '', '', ''),
  ]
  const links = [
    { id: 'l7', a: 'n1', b: 'n4', kind: 'straight' },
    { id: 'l8', a: 'n2', b: 'n4', kind: 'straight' },
    { id: 'l9', a: 'n3', b: 'n4', kind: 'straight' },
    { id: 'l10', a: 'n4', b: 'n5', kind: 'straight' },
    { id: 'l11', a: 'n5', b: 'n6', kind: 'fiber' },
  ]
  seq = 12
  set({ nodes, links, selected: 'n1', pending: null })
}
