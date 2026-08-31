
import { spec } from './devices.js'

// ── addresses ───────────────────────────────────────────────────────────────

export function parseIp(text) {
  const parts = String(text ?? '').trim().split('.')
  if (parts.length !== 4) return null
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : -1))
  if (nums.some((n) => n < 0 || n > 255)) return null
  return ((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3]
}

export const ipValid = (t) => parseIp(t) !== null

/** 255.255.255.0 -> 24, and rejects a mask with a hole in it. */
export function maskToPrefix(text) {
  const v = parseIp(text)
  if (v === null) return null
  const bits = v.toString(2).padStart(32, '0')
  if (!/^1*0*$/.test(bits)) return null
  return bits.indexOf('0') === -1 ? 32 : bits.indexOf('0')
}

export function sameSubnet(ipA, ipB, mask) {
  const a = parseIp(ipA); const b = parseIp(ipB); const m = parseIp(mask)
  if (a === null || b === null || m === null) return false
  return ((a & m) >>> 0) === ((b & m) >>> 0)
}

export function networkAddress(ip, mask) {
  const a = parseIp(ip); const m = parseIp(mask)
  if (a === null || m === null) return null
  const n = (a & m) >>> 0
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

// ── topology walks ──────────────────────────────────────────────────────────

/**
 * The devices a frame from `startId` can reach WITHOUT a router.
 * Walks the cables and stops whenever it arrives at a layer-3 box. The router
 * itself is included — its near-side port really is on this wire — but the walk
 * does not continue through it. That single rule is the whole of layer 2.
 */
export function broadcastDomain(startId, { nodes, links }) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const seen = new Set([startId])
  const queue = [startId]

  while (queue.length) {
    const id = queue.shift()
    const here = byId.get(id)
    if (!here) continue
    if (id !== startId && spec(here.kind)?.forwards === 'route') continue

    for (const link of links) {
      const other = link.a === id ? link.b : link.b === id ? link.a : null
      if (!other || seen.has(other)) continue
      seen.add(other)
      queue.push(other)
    }
  }
  return seen
}

/** Every device joined by cable, ignoring layers. "Is it physically plugged in." */
export function connectedSet(startId, links) {
  const seen = new Set([startId])
  const queue = [startId]
  while (queue.length) {
    const id = queue.shift()
    for (const link of links) {
      const other = link.a === id ? link.b : link.b === id ? link.a : null
      if (!other || seen.has(other)) continue
      seen.add(other)
      queue.push(other)
    }
  }
  return seen
}

/**
 * Every address a device answers to.
 *
 * End devices have one. Routers have one per subnet they serve, which is the
 * whole reason a router exists — it must stand inside both networks at once.
 * `ip`/`mask` is interface 0; `ifaces` holds the rest.
 */
export function addressesOf(n) {
  const out = []
  if (n.ip) out.push({ ip: n.ip, mask: n.mask || '255.255.255.0' })
  for (const f of n.ifaces ?? []) if (f.ip) out.push({ ip: f.ip, mask: f.mask || '255.255.255.0' })
  return out
}

/** Does this device answer to that address on any of its interfaces? */
export const hasAddress = (n, ip) => addressesOf(n).some((a) => a.ip === ip)

/** The interface a router would use to reach `dstIp`, or null if it has no route. */
export function routeFor(n, dstIp) {
  return addressesOf(n).find((a) => sameSubnet(a.ip, dstIp, a.mask)) ?? null
}

/** The router a device would hand an off-subnet packet to, or a reason it has none. */
export function gatewayOf(dev, topo) {
  if (!ipValid(dev.gw)) return { ok: false, why: `${dev.name} has no default gateway set` }
  if (!sameSubnet(dev.ip, dev.gw, dev.mask)) {
    return { ok: false, why: `${dev.name}'s gateway ${dev.gw} is outside its own subnet — a gateway has to be an address it can reach directly` }
  }
  const domain = broadcastDomain(dev.id, topo)
  const gw = [...domain].map((id) => topo.nodes.find((n) => n.id === id))
    .find((n) => n && hasAddress(n, dev.gw))
  if (!gw) return { ok: false, why: `nothing on ${dev.name}'s wire is using ${dev.gw}, so its gateway does not exist` }
  if (spec(gw.kind)?.forwards !== 'route') {
    return { ok: false, why: `${gw.name} holds ${dev.gw}, but a ${spec(gw.kind).name} cannot move packets between subnets` }
  }
  return { ok: true, gw }
}

// ── the two questions the console asks ──────────────────────────────────────

/**
 * Can `fromId` reach `targetIp`, where the target is a device on this grid?
 * @returns {{ok:boolean, why:string, scope:'local'|'routed'|'offgrid', peer?:object}}
 */
export function canReach(fromId, targetIp, topo) {
  const from = topo.nodes.find((n) => n.id === fromId)
  if (!from) return no('that device is gone')

  const s = spec(from.kind)
  if (!s?.hasIp) return no(`${from.name} has no IP address of its own`)
  if (!ipValid(from.ip)) return no(`${from.name} has no valid IP address set`)
  if (maskToPrefix(from.mask) === null) return no(`${from.name} has an invalid subnet mask`)
  if (!topo.links.some((l) => l.a === from.id || l.b === from.id)) {
    return no(`${from.name} is not plugged into anything`)
  }

  const peer = topo.nodes.find((n) => n.id !== from.id && hasAddress(n, targetIp))
  if (!peer) return { ok: false, why: 'not a device on this grid', scope: 'offgrid' }

  // ── same subnet: no router may be involved, so they must share a wire ──────
  if (sameSubnet(from.ip, targetIp, from.mask)) {
    const domain = broadcastDomain(fromId, topo)
    if (!domain.has(peer.id)) {
      return no(`${peer.name} has an address in ${from.name}'s subnet, but there is no layer-2 path between them — a router in the way, or a missing cable`)
    }
    return { ok: true, scope: 'local', peer, why: `${peer.name} is on the same wire and the same subnet, so this never touches a router` }
  }

  // ── different subnets: both ends need a working gateway ───────────────────
  const out = gatewayOf(from, topo)
  if (!out.ok) return no(`${targetIp} is outside ${from.name}'s subnet, and ${out.why}`)

  if (!ipValid(peer.mask)) return no(`${peer.name} has no valid mask, so it cannot work out where to send a reply`)
  const back = gatewayOf(peer, topo)
  if (!back.ok) {
    return no(`the packet can reach ${peer.name}, but the reply cannot get home: ${back.why}`)
  }

  if (!connectedSet(out.gw.id, topo.links).has(peer.id)) {
    return no(`${out.gw.name} has no cable path to ${peer.name}`)
  }

  return {
    ok: true, scope: 'routed', peer,
    why: `${from.name} → ${out.gw.name} → ${peer.name}, and ${peer.name} routes the reply back through ${back.gw.name}`,
  }
}

/**
 * Is there a real way out to the internet?
 * @returns {{ok:boolean, why:string, hops:string[]}}
 */
export function pathToInternet(fromId, topo) {
  const cloud = topo.nodes.find((n) => spec(n.kind)?.wan)
  if (!cloud) return no('there is no INTERNET device on the grid — drag one from WAN_EMULATION and wire your router to it')

  const from = topo.nodes.find((n) => n.id === fromId)
  if (!from) return no('that device is gone')

  const s = spec(from.kind)
  if (!s?.hasIp) return no(`a ${s?.name ?? 'device'} has no address, so it cannot send anything itself`)
  if (!ipValid(from.ip)) return no(`${from.name} needs a valid IP address first`)

  const out = gatewayOf(from, topo)
  if (!out.ok) return no(out.why)

  const hops = [from.name, out.gw.name]
  const visited = new Set([out.gw.id])
  let current = out.gw

  for (let guard = 0; guard < 32; guard++) {
    const reachable = connectedSet(current.id, topo.links)
    if (reachable.has(cloud.id)) {
      if (current.id !== cloud.id) hops.push(cloud.name)
      return { ok: true, hops, why: `${hops.join(' → ')} — the packet has a way out` }
    }
    const next = topo.nodes.find((n) =>
      !visited.has(n.id) && spec(n.kind)?.forwards === 'route' && reachable.has(n.id))
    if (!next) break
    visited.add(next.id)
    hops.push(next.name)
    current = next
  }

  return no(`${out.gw.name} has no cable leading to ${cloud.name}, so traffic reaches your router and stops there`)
}

// ── whole-grid audit ────────────────────────────────────────────────────────

export function audit(topo) {
  const problems = []
  const seen = new Map()

  for (const n of topo.nodes) {
    const s = spec(n.kind)
    if (!topo.links.some((l) => l.a === n.id || l.b === n.id)) {
      problems.push({ id: n.id, level: 'warn', text: `${n.name} is not plugged into anything` })
    }
    if (!s?.hasIp) continue

    if (n.ip && !ipValid(n.ip)) problems.push({ id: n.id, level: 'err', text: `${n.name} has an invalid IP` })
    if (n.mask && maskToPrefix(n.mask) === null) problems.push({ id: n.id, level: 'err', text: `${n.name} has an invalid mask` })
    if (!n.ip) problems.push({ id: n.id, level: 'warn', text: `${n.name} has no IP address yet` })

    for (const a of addressesOf(n)) {
      if (!ipValid(a.ip)) continue
      if (seen.has(a.ip)) {
        problems.push({ id: n.id, level: 'err', text: `${n.name} and ${seen.get(a.ip)} both use ${a.ip}` })
      } else seen.set(a.ip, n.name)
    }
    if (n.gw && ipValid(n.gw) && n.ip && n.mask && !sameSubnet(n.ip, n.gw, n.mask)) {
      problems.push({ id: n.id, level: 'err', text: `${n.name}'s gateway is outside its own subnet` })
    }
  }
  return problems
}

const no = (why) => ({ ok: false, why, scope: 'local' })
