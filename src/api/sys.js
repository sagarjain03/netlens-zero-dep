/**
 * api/sys.js — turns OS tool output into the shared envelope.
 *
 * Chapter 1 runs entirely on this. Nothing here is simulated: the addresses,
 * the gateway, the neighbours and the routing table all belong to the machine
 * the learner is sitting at, which is the whole reason the chapter lands.
 */
import { platform } from 'node:os'
import { runSys, operationNames } from '../sys/exec.js'
import {
  parseIpconfig, parseIpAddr, parseIfconfig, primaryInterface,
  parseArpWin, parseIpNeigh, parseArpUnix, realDevices,
  parseRouteWin, parseIpRoute, defaultRoute,
  parseNetstat, maskToPrefix,
} from '../sys/netinfo.js'
import { parsePing } from '../sys/ping.js'
import { envelope, event, sendJson } from '../server/respond.js'

const PARSERS = {
  ifconfig: { win32: parseIpconfig, linux: parseIpAddr, darwin: parseIfconfig },
  arp: { win32: parseArpWin, linux: parseIpNeigh, darwin: parseArpUnix },
  route: { win32: parseRouteWin, linux: parseIpRoute, darwin: parseIpRoute },
  netstat: { win32: parseNetstat, linux: parseNetstat, darwin: parseNetstat },
  ping: { win32: parsePing, linux: parsePing, darwin: parsePing },
}

export async function handleSys({ res, body }) {
  const op = String(body.op ?? '').toLowerCase()
  if (!operationNames().includes(op)) {
    throw new Error(`unknown operation "${op}" — try one of: ${operationNames().join(', ')}`)
  }
  if (op === 'trace') throw new Error('use the streaming endpoint for traceroute')

  const os = platform()
  const result = await runSys(op, { host: body.host, count: body.count })
  const parse = PARSERS[op]?.[os] ?? PARSERS[op]?.linux
  const data = parse ? parse(result.stdout || result.stderr) : null

  sendJson(res, op === 'ping'
    ? pingEnvelope(data, result)
    : envelope({
      durationMs: result.durationMs,
      meta: { op, os, binary: result.binary, args: result.args, data: shape(op, data) },
      text: (result.stdout || result.stderr).trim(),
    }))
}

/** Per-operation shaping, so the client gets the answer rather than a dump. */
function shape(op, data) {
  switch (op) {
    case 'ifconfig': {
      const primary = primaryInterface(data ?? [])
      return {
        interfaces: data ?? [],
        primary,
        prefix: primary?.mask ? maskToPrefix(primary.mask) : null,
        // The address a learner means by "me".
        ip: primary?.addresses.find((a) => a.includes('.')) ?? null,
      }
    }
    case 'arp': {
      const devices = realDevices(data ?? [])
      return {
        devices,
        // Multicast rows are real ARP entries but they are not devices, and
        // showing them beside someone's phone teaches something false.
        hidden: (data ?? []).length - devices.length,
      }
    }
    case 'route': {
      const routes = data ?? []
      return { routes, default: defaultRoute(routes) }
    }
    case 'netstat': {
      const rows = data ?? []
      return {
        connections: rows,
        established: rows.filter((r) => r.state === 'ESTABLISHED' || r.state === 'ESTAB'),
      }
    }
    default:
      return data
  }
}

/**
 * A ping becomes a timeline: one event out, one per reply. That makes it
 * animate through the same canvas code every other chapter uses.
 */
function pingEnvelope(ping, result) {
  const target = ping.ip ?? ping.host ?? result.host
  const events = [
    event({
      t: 0,
      dir: 'out',
      from: 'you',
      to: target,
      proto: 'ICMP',
      bytes: ping.replies[0]?.bytes ?? 32,
      label: `echo request ×${ping.sent}`,
      narration: `Your machine sent ${ping.sent} tiny "are you there?" packets to ${target}.`,
    }),
  ]

  ping.replies.forEach((reply, i) => {
    const last = i === ping.replies.length - 1
    events.push(event({
      t: reply.timeMs,
      dir: 'in',
      from: target,
      to: 'you',
      proto: 'ICMP',
      bytes: reply.bytes,
      label: `echo reply ${i + 1}`,
      // The narration bar shows the LAST event by default, so the summary has
      // to live there rather than on the first reply.
      narration: last ? ttlNarration(ping, target) : `Reply ${i + 1} came back in ${reply.timeMs} ms.`,
    }))
  })

  if (!ping.reachable) {
    events.push(event({
      t: 0, dir: 'in', from: target, to: 'you', proto: 'ICMP', bytes: 0,
      label: 'no reply',
      note: ping.reason,
      narration: `Nothing came back. ${ping.reason}. Either the host is down, or something on the path drops ICMP — plenty of networks do.`,
    }))
  }

  return envelope({
    durationMs: ping.avg ?? result.durationMs,
    events,
    meta: { op: 'ping', os: platform(), binary: result.binary, args: result.args, data: ping },
    text: (result.stdout || result.stderr).trim(),
  })
}

function ttlNarration(ping, target) {
  const base = `${target} answered in ${ping.avg} ms.`
  if (ping.hopsAway == null) return base
  return `${base} The reply arrived with TTL ${ping.ttl}. Senders start at 64, 128 or 255 and every router subtracts one — so ${target} is about ${ping.hopsAway} hops away. You can count the distance without running traceroute.`
}
