/**
 * ping.js — parses ICMP echo output. Replaces the `ping` npm package.
 *
 * Three platforms print three different things, and every one of them differs
 * again when the host is unreachable. Pure, so all six shapes are tested from
 * captured fixtures rather than discovered on a judge's machine.
 *
 *   Windows  Reply from 1.1.1.1: bytes=32 time=17ms TTL=59
 *   Linux    64 bytes from 1.1.1.1: icmp_seq=1 ttl=59 time=17.2 ms
 *   macOS    64 bytes from 1.1.1.1: icmp_seq=0 ttl=59 time=17.184 ms
 */

const REPLY_PATTERNS = [
  // Windows
  /Reply from (?<ip>\d{1,3}(?:\.\d{1,3}){3}):\s*bytes=(?<bytes>\d+)\s+time[=<](?<time>\d+)ms\s+TTL=(?<ttl>\d+)/i,
  // Linux / macOS
  /(?<bytes>\d+) bytes from (?<ip>[^\s:(]+)(?:\s*\([^)]*\))?:\s*icmp_seq=(?<seq>\d+)\s+ttl=(?<ttl>\d+)\s+time=(?<time>[\d.]+)\s*ms/i,
]

const LOSS_PATTERNS = [
  // Windows: Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
  /Sent\s*=\s*(?<sent>\d+),\s*Received\s*=\s*(?<received>\d+),\s*Lost\s*=\s*(?<lost>\d+)\s*\((?<loss>\d+)%/i,
  // Linux/macOS: 4 packets transmitted, 4 received, 0% packet loss
  /(?<sent>\d+) packets transmitted,\s*(?<received>\d+)\s*(?:packets\s*)?received,.*?(?<loss>[\d.]+)%\s*packet loss/i,
]

const STATS_PATTERNS = [
  // Windows: Minimum = 6ms, Maximum = 17ms, Average = 11ms
  /Minimum\s*=\s*(?<min>\d+)ms,\s*Maximum\s*=\s*(?<max>\d+)ms,\s*Average\s*=\s*(?<avg>\d+)ms/i,
  // Linux/macOS: rtt min/avg/max/mdev = 6.1/11.5/17.2/4.5 ms
  /=\s*(?<min>[\d.]+)\/(?<avg>[\d.]+)\/(?<max>[\d.]+)\/[\d.]+\s*ms/i,
]

const UNREACHABLE_RE =
  /(Destination host unreachable|Request timed out|100% packet loss|could not find host|Name or service not known|cannot resolve|Unknown host|unknown host)/i

/**
 * @param {string} text  raw ping output
 * @returns {{host, replies, sent, received, lost, lossPercent, min, avg, max, ttl, hopsAway, reachable, reason}}
 */
export function parsePing(text) {
  const raw = String(text)
  const replies = []

  for (const line of raw.split(/\r?\n/)) {
    for (const re of REPLY_PATTERNS) {
      const m = re.exec(line)
      if (!m) continue
      const g = m.groups
      replies.push({
        ip: g.ip,
        bytes: Number(g.bytes),
        ttl: Number(g.ttl),
        timeMs: Number(g.time),
        seq: g.seq !== undefined ? Number(g.seq) : replies.length + 1,
      })
      break
    }
  }

  const loss = firstMatch(raw, LOSS_PATTERNS)
  const stats = firstMatch(raw, STATS_PATTERNS)

  const sent = loss ? Number(loss.sent) : replies.length
  const received = loss ? Number(loss.received) : replies.length
  const lossPercent = loss ? Number(loss.loss) : (sent ? Math.round(((sent - received) / sent) * 100) : 100)

  const times = replies.map((r) => r.timeMs)
  const ttl = replies.length ? replies[replies.length - 1].ttl : null

  const reachable = received > 0
  const unreachable = UNREACHABLE_RE.exec(raw)

  return {
    host: /^\s*(?:PING|Pinging)\s+(\S+)/im.exec(raw)?.[1]?.replace(/[:]$/, '') ?? null,
    ip: replies[0]?.ip ?? /\[(\d{1,3}(?:\.\d{1,3}){3})\]/.exec(raw)?.[1] ?? null,
    replies,
    sent,
    received,
    lost: sent - received,
    lossPercent,
    min: stats ? Number(stats.min) : (times.length ? Math.min(...times) : null),
    avg: stats ? Number(stats.avg) : (times.length ? round1(times.reduce((a, b) => a + b, 0) / times.length) : null),
    max: stats ? Number(stats.max) : (times.length ? Math.max(...times) : null),
    ttl,
    hopsAway: hopsFromTtl(ttl),
    reachable,
    reason: reachable ? null : (unreachable?.[1] ?? 'no reply'),
  }
}

const round1 = (n) => Math.round(n * 10) / 10

function firstMatch(text, patterns) {
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) return m.groups
  }
  return null
}

/**
 * How far away that host is, without running traceroute.
 *
 * Senders start TTL at a round number — 64, 128 or 255 depending on the OS —
 * and every router decrements it by one. Whatever arrives, the distance is the
 * gap up to the next of those starting points. This is a genuinely useful thing
 * to know and almost nobody is taught it.
 */
export function hopsFromTtl(ttl) {
  if (!Number.isFinite(ttl) || ttl <= 0) return null
  const origins = [64, 128, 255]
  const origin = origins.find((o) => ttl <= o)
  if (!origin) return null
  return origin - ttl
}

/** Where an OS starts its TTL, inferred the same way. */
export function ttlOrigin(ttl) {
  if (!Number.isFinite(ttl) || ttl <= 0) return null
  return [64, 128, 255].find((o) => ttl <= o) ?? null
}
