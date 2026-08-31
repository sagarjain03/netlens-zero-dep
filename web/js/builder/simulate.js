
import { spec } from './devices.js'
import {
  sameSubnet, ipValid, maskToPrefix, broadcastDomain,
  addressesOf, hasAddress, routeFor,
} from './net.js'

const TTL = 16

/**
 * @returns {{
 *   ok: boolean, reason: string,
 *   steps: Array<{nodeId, kind, title, text}>,
 *   phase: 'request'|'reply'|'none'
 * }}
 * kind: send | forward | route | deliver | reply | drop
 */
export function simulatePdu(srcId, dstIp, topo) {
  const src = topo.nodes.find((n) => n.id === srcId)
  if (!src) return dead('that device is gone')

  const s = spec(src.kind)
  if (!s?.hasIp) return dead(`a ${s?.name ?? 'device'} cannot originate a packet — it has no address of its own`)
  if (!ipValid(src.ip)) return dead(`${src.name} has no valid IP address`)
  if (maskToPrefix(src.mask) === null) return dead(`${src.name} has an invalid subnet mask`)

  const dst = topo.nodes.find((n) => n.id !== src.id && hasAddress(n, dstIp))
  if (!dst) return dead(`no device on this grid is using ${dstIp}`)

  const steps = []
  const req = walk(src, dstIp, topo, steps, 'request')
  if (!req.ok) return { ...req, steps, phase: 'request' }

  // The reply is a packet like any other, and it has to find its own way home.
  steps.push({
    nodeId: dst.id, kind: 'reply',
    title: `${dst.name} replies`,
    text: `${dst.name} accepted the packet and now sends an echo reply back to ${src.ip}. From here everything happens again, in reverse.`,
  })

  const rep = walk(dst, src.ip, topo, steps, 'reply')
  if (!rep.ok) {
    return {
      ok: false, phase: 'reply', steps,
      reason: `the packet ARRIVED, but the reply could not get home — ${rep.reason}`,
    }
  }

  steps.push({
    nodeId: src.id, kind: 'deliver',
    title: `${src.name} receives the reply`,
    text: 'Round trip complete. This is what a successful ping is: a packet out and the same packet back.',
  })

  return { ok: true, reason: 'delivered, and the reply came back', steps, phase: 'reply' }
}

// ── one direction ───────────────────────────────────────────────────────────

function walk(from, dstIp, topo, steps, phase) {
  let cur = from
  let curAddr = { ip: from.ip, mask: from.mask }

  for (let ttl = TTL; ttl > 0; ttl--) {
    const direct = sameSubnet(curAddr.ip, dstIp, curAddr.mask)
    let nextHopIp

    if (cur === from) {
      // The originating device makes the only decision an end device ever makes.
      if (direct) {
        nextHopIp = dstIp
        steps.push({
          nodeId: cur.id, kind: 'send',
          title: `${cur.name} sends`,
          text: `${dstIp} is inside ${cur.name}'s own subnet (${curAddr.ip}/${maskToPrefix(curAddr.mask)}), so it addresses the frame straight to it. No router will be involved.`,
        })
      } else {
        if (!ipValid(cur.gw)) {
          return stop(steps, cur, `${dstIp} is outside ${cur.name}'s subnet and ${cur.name} has no default gateway, so it has nowhere to send the packet`)
        }
        if (!sameSubnet(curAddr.ip, cur.gw, curAddr.mask)) {
          return stop(steps, cur, `${cur.name}'s gateway ${cur.gw} is outside its own subnet — it cannot reach its own gateway`)
        }
        nextHopIp = cur.gw
        steps.push({
          nodeId: cur.id, kind: 'send',
          title: `${cur.name} sends`,
          text: `${dstIp} is outside ${cur.name}'s subnet, so it hands the packet to its default gateway ${cur.gw}. It does not know the route — that is the gateway's problem now.`,
        })
      }
    } else {
      // A router deciding where to send it next.
      const iface = routeFor(cur, dstIp)
      if (iface) {
        nextHopIp = dstIp
        steps.push({
          nodeId: cur.id, kind: 'route',
          title: `${cur.name} routes`,
          text: `${cur.name} reads the destination ${dstIp}, finds it inside its own ${iface.ip}/${maskToPrefix(iface.mask)} interface, and sends it out there. TTL drops by one.`,
        })
        curAddr = iface
      } else if (ipValid(cur.gw)) {
        nextHopIp = cur.gw
        const own = addressesOf(cur).find((a) => sameSubnet(a.ip, cur.gw, a.mask))
        if (!own) return stop(steps, cur, `${cur.name}'s next-hop ${cur.gw} is not on any of its interfaces`)
        steps.push({
          nodeId: cur.id, kind: 'route',
          title: `${cur.name} routes upstream`,
          text: `${cur.name} has no interface covering ${dstIp}, so it follows its default route to ${cur.gw}.`,
        })
        curAddr = own
      } else {
        const owned = addressesOf(cur).map((a) => `${a.ip}/${maskToPrefix(a.mask)}`).join(', ') || 'none'
        return stop(steps, cur, `${cur.name} has no route to ${dstIp}. Its interfaces cover ${owned}, and it has no default route. The packet dies here.`)
      }
    }

    // ── layer 2: physically carry the frame to whoever holds nextHopIp ──────
    const domain = broadcastDomain(cur.id, topo)
    const target = [...domain]
      .map((id) => topo.nodes.find((n) => n.id === id))
      .find((n) => n && n.id !== cur.id && hasAddress(n, nextHopIp))

    if (!target) {
      return stop(steps, cur, `nothing on ${cur.name}'s wire is using ${nextHopIp} — a missing cable, or an address that does not exist`)
    }

    for (const mid of pathBetween(cur.id, target.id, topo)) {
      const m = topo.nodes.find((n) => n.id === mid)
      const ms = spec(m.kind)
      steps.push({
        nodeId: mid, kind: 'forward',
        title: `${m.name} forwards`,
        text: ms.layer === 1
          ? `${m.name} is a layer-1 device. It copies the signal to every other port without reading anything, so every device on it hears this frame.`
          : `${m.name} reads the destination MAC, looks up which port it learned that address on, and forwards the frame only there. It never sees the IP address.`,
      })
    }

    if (hasAddress(target, dstIp)) {
      steps.push({
        nodeId: target.id, kind: 'deliver',
        title: `${target.name} accepts`,
        text: `The destination address matches ${target.name}'s own, so it accepts the packet${phase === 'request' ? '' : ' — the reply is home'}.`,
      })
      return { ok: true, reason: 'delivered' }
    }

    cur = target
  }

  return stop(steps, cur, 'TTL expired — the packet looped between routers until its hop count ran out')
}

// ── shortest layer-2 path, excluding the two endpoints ──────────────────────

function pathBetween(aId, bId, topo) {
  const prev = new Map([[aId, null]])
  const queue = [aId]

  while (queue.length) {
    const id = queue.shift()
    if (id === bId) break
    const here = topo.nodes.find((n) => n.id === id)
    if (id !== aId && spec(here?.kind)?.forwards === 'route') continue

    for (const l of topo.links) {
      const other = l.a === id ? l.b : l.b === id ? l.a : null
      if (!other || prev.has(other)) continue
      prev.set(other, id)
      queue.push(other)
    }
  }
  if (!prev.has(bId)) return []

  const chain = []
  for (let at = prev.get(bId); at && at !== aId; at = prev.get(at)) chain.unshift(at)
  return chain
}

// ── helpers ─────────────────────────────────────────────────────────────────

function stop(steps, node, reason) {
  steps.push({
    nodeId: node.id, kind: 'drop',
    title: `${node.name} drops it`,
    text: reason,
  })
  return { ok: false, reason }
}

const dead = (reason) => ({ ok: false, reason, steps: [], phase: 'none' })
