/**
 * facts.js — what actually happened, pulled out of the envelope.
 *
 * A step's payoff line is written before we know what the network will do.
 * These are the numbers that only exist afterwards: how long it took, how many
 * bytes moved, who answered. They are rendered as chips under the payoff so
 * the lesson is never talking about a hypothetical packet — it is talking
 * about the one that just left the machine.
 *
 * Deliberately generic. It reads `{events, packets}` and nothing protocol
 * specific, so `dig`, `tls`, `curl`, `tracert` and `journey` all light it up
 * without a line of per-command code.
 */

const sum = (list, pick) => list.reduce((n, e) => n + (pick(e) || 0), 0)

/**
 * @param {{events: Array, packets: Array}} envelope
 * @returns {Array<{label: string, value: string}>} chips, already formatted
 */
export function measured({ events = [], packets = [] } = {}) {
  if (!events.length) return []

  const out = events.filter((e) => e.dir === 'out')
  const back = events.filter((e) => e.dir === 'in')

  const elapsed = Math.max(...events.map((e) => e.t || 0))
  const bytesOut = sum(out, (e) => e.bytes)
  const bytesIn = sum(back, (e) => e.bytes)

  // The protocols the exchange actually touched, in the order they appeared.
  const protos = []
  for (const e of events) if (e.proto && !protos.includes(e.proto)) protos.push(e.proto)

  const chips = []
  if (elapsed > 0) chips.push({ label: 'took', value: `${round(elapsed)} ms` })
  if (bytesOut) chips.push({ label: 'sent', value: bytes(bytesOut) })
  if (bytesIn) chips.push({ label: 'back', value: bytes(bytesIn) })
  if (back.length > 1) chips.push({ label: 'replies', value: String(back.length) })
  if (protos.length) chips.push({ label: 'over', value: protos.join(' + ') })
  if (packets.length) chips.push({ label: 'packets', value: String(packets.length) })

  const peer = out[0]?.to
  if (peer) chips.push({ label: 'to', value: String(peer) })

  return chips
}

/** The last thing the timeline said — the outcome, in plain language. */
export function outcome({ events = [] } = {}) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].narration) return events[i].narration
  }
  return ''
}

const round = (n) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10)

const bytes = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`)
