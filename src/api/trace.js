/**
 * api/trace.js — traceroute, streamed hop by hop.
 *
 * Chapter 3's whole point is that nobody knows the whole route: each router
 * only knows the next step. Watching hops appear one at a time, with gaps where
 * routers decline to answer, shows that far better than a finished list does.
 */
import { streamSys } from '../sys/exec.js'
import { validateHost } from '../sys/exec.js'
import { parseTraceLine, parseTraceHeader, isTraceComplete, summarise } from '../sys/trace.js'
import { openStream } from '../server/sse.js'
import { event } from '../server/respond.js'

const KEEPALIVE_MS = 10_000

export function handleTraceStream({ req, res, query }) {
  let host
  try {
    host = validateHost(query.get('host'))
  } catch (err) {
    // The stream has not opened yet, so a normal error response is still possible.
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: err.message }))
    return
  }

  const maxHops = Math.min(30, Math.max(1, Number(query.get('maxHops')) || 20))
  const stream = openStream(res, { retryMs: 0 })
  const hops = []
  let target = null

  const keepalive = setInterval(() => stream.ping(), KEEPALIVE_MS)

  const child = streamSys('trace', { host, maxHops }, {
    onLine(line) {
      if (stream.closed) { child.cancel(); return }

      if (!target) {
        const header = parseTraceHeader(line)
        if (header) {
          target = header
          stream.send({ type: 'target', ...header, maxHops })
          return
        }
      }
      if (isTraceComplete(line)) return

      const hop = parseTraceLine(line)
      if (!hop) return

      hops.push(hop)
      stream.send({ type: 'hop', hop, event: hopEvent(hop, target) })
    },

    onDone() {
      clearInterval(keepalive)
      const stats = summarise(hops)
      stream.close({
        type: 'complete',
        target,
        hops,
        ...stats,
        narration: completionNarration(hops, stats, target),
      })
    },

    onError(err) {
      clearInterval(keepalive)
      stream.close({ type: 'error', error: err.message })
    },
  })

  // If the learner navigates away, stop the process rather than orphaning it.
  req.on('close', () => {
    clearInterval(keepalive)
    child.cancel()
  })
}

/** One hop becomes one timeline event, so the canvas renders it like any other. */
function hopEvent(hop, target) {
  if (hop.silent) {
    return event({
      t: 0,
      dir: 'in',
      from: `hop-${hop.hop}`,
      to: 'you',
      proto: 'ICMP',
      bytes: 0,
      label: `hop ${hop.hop} · no reply`,
      note: 'silent',
      narration: `Hop ${hop.hop} did not answer. That router is configured to stay quiet — it still forwards your packets, it just refuses to introduce itself.`,
    })
  }

  return event({
    t: hop.avg ?? 0,
    dir: 'in',
    from: hop.host,
    to: 'you',
    proto: 'ICMP',
    bytes: 0,
    label: `hop ${hop.hop}`,
    narration: `Hop ${hop.hop}: ${hop.host} answered in ${hop.avg} ms.`,
  })
}

function completionNarration(hops, stats, target) {
  if (!stats.answered) {
    return 'No router answered. Some networks drop the expired-TTL replies traceroute depends on, so the path is invisible from here.'
  }

  const where = target?.host ?? 'the destination'
  const parts = [
    `${stats.answered} of ${hops.length} routers answered on the way to ${where}, and the whole path took about ${stats.totalMs} ms.`,
  ]

  if (stats.silent) {
    parts.push(`${stats.silent} stayed silent — they still forwarded the packet, they just chose not to reply.`)
  }

  if (stats.biggestJump && stats.biggestJump.delta >= 8) {
    parts.push(
      `The largest jump is between hop ${stats.biggestJump.from.hop} and hop ${stats.biggestJump.to.hop}: ${stats.biggestJump.delta} ms in one step. A jump that size is usually physical distance — a long-haul link, often an undersea cable.`,
    )
  }

  return parts.join(' ')
}
