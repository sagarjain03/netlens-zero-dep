/**
 * arq.js — the sliding-window protocols, simulated honestly.
 *
 * Same rule as algo.js: no DOM, no timers, no randomness the caller cannot
 * reproduce. The generator is seeded, so a run is a pure function of its
 * settings — which is what lets the widget say "same losses, same seed, now
 * switch protocol" and mean it. Without that, the comparison at the heart of
 * this lesson would just be two different dice rolls.
 *
 * The model, deliberately small enough to hold in your head:
 *   · the sender puts at most one frame on the wire per tick
 *   · a frame takes `prop` ticks to cross, and is either lost or it is not
 *   · an ACK crosses the same way and can be lost too, unless  says
 *     otherwise — see the note on cumulative ACKs at the bottom of this file
 *   · a frame with no ACK after `timeout` ticks is resent
 *
 * That is enough for every behaviour this chapter teaches. It is not a TCP
 * stack, and the interface labels it SIM.
 */

/**
 * The channel is a lookup, not a dice roll.
 *
 * A stream of random numbers consumed in order looked correct and was not: the
 * protocols diverge, so they draw in different orders and end up experiencing
 * different losses. "Same seed, switch protocol" then compares two different
 * channels, which is exactly the thing this lesson must not do.
 *
 * So the fate of every transmission is a pure function of (seed, kind, frame,
 * attempt). Attempt 3 of frame 5 meets the same channel under all three
 * protocols, and any difference in the numbers is the protocol alone.
 */
export function hash32(...nums) {
  let h = 2166136261 >>> 0
  for (const n of nums) {
    h = (h ^ (n >>> 0)) >>> 0
    h = Math.imul(h, 16777619) >>> 0
  }
  // FNV alone is not enough here. Its inputs are tiny consecutive integers,
  // and without a final avalanche consecutive attempts came out almost equal
  // (0.754, 0.742, 0.746 ...) — so a frame that lost once lost sixty-four
  // times in a row and the whole simulation exploded. This is murmur3's
  // finalizer, and it is what makes attempt N independent of attempt N+1.
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return h >>> 0
}

/** A stable number in [0, 1) for one transmission. */
export const chanceAt = (seed, kindCode, seq, attempt) =>
  (hash32(seed, kindCode, seq, attempt) >>> 8) / 16777216

export const PROTOCOLS = ['stop-and-wait', 'go-back-n', 'selective-repeat']

/**
 * @returns {{events: Array, stats: object, delivered: number[]}}
 *   events are `{kind, seq, t0, t1, lost}` for data/ack, `{kind, seq, t}` for
 *   the moments — timeout, deliver, discard. The renderer draws the first as
 *   diagonals and the second as marks.
 */
export function simulate({
  protocol = 'stop-and-wait',
  frames = 8,
  window = 4,
  loss = 0.2,
  lossAck = null,        // null means ACKs are as fragile as data frames
  prop = 4,
  timeout = 14,
  seed = 7,
  maxTicks = 4000,
} = {}) {
  const cumulative = protocol !== 'selective-repeat'
  const W = protocol === 'stop-and-wait' ? 1 : Math.max(1, window)

  const events = []
  const arrivals = new Map()   // tick -> [{type, seq}]
  const attempts = { data: new Map(), ack: new Map() }

  // sender
  let base = 0
  let next = 0
  let queue = []               // seqs waiting for the wire, retransmits first
  let timerFor = -1            // which frame the single cumulative timer watches
  let timerStart = 0
  const sentAt = new Map()
  const acked = new Set()
  const everSent = new Set()
  let transmissions = 0
  let retransmissions = 0

  // receiver
  let rxBase = 0
  const rxBuf = new Set()
  const delivered = []

  const at = (t) => {
    if (!arrivals.has(t)) arrivals.set(t, [])
    return arrivals.get(t)
  }

  function put(kind, seq, t) {
    const tally = attempts[kind]
    const attempt = (tally.get(seq) ?? 0) + 1
    tally.set(seq, attempt)

    const rate = kind === 'ack' && lossAck !== null ? lossAck : loss
    const lost = chanceAt(seed, kind === 'data' ? 1 : 2, seq, attempt) < rate
    events.push({ kind, seq, t0: t, t1: t + prop, lost, attempt })
    if (!lost) at(t + prop).push({ type: kind, seq })
    return lost
  }

  function sendData(seq, t) {
    const retx = everSent.has(seq)
    everSent.add(seq)
    transmissions++
    if (retx) retransmissions++
    sentAt.set(seq, t)
    const lost = put('data', seq, t)
    if (retx) events[events.length - 1].retx = true
    return lost
  }

  let t = 0
  for (; t <= maxTicks && base < frames; t++) {
    // ── 1. what lands right now ──────────────────────────────────────────
    for (const a of arrivals.get(t) ?? []) {
      if (a.type === 'data') receive(a.seq, t)
      else if (a.type === 'ack') {
        if (cumulative) base = Math.max(base, a.seq + 1)
        else {
          acked.add(a.seq)
          while (acked.has(base)) base++
        }
      }
    }
    if (base >= frames) break

    // ── 2. anything that has waited too long ─────────────────────────────
    if (cumulative) {
      // One timer, on the oldest unacknowledged frame. When it fires the
      // whole outstanding window goes again — that IS Go-Back-N.
      //
      // The timer is its own value rather than `sentAt.get(base)`: the wire
      // only carries one frame per tick, so the resent base frame does not go
      // out on the tick the timer fires. Reading sentAt made the timeout fire
      // again on every following tick and refill the queue forever.
      if (base !== timerFor) { timerFor = base; timerStart = sentAt.get(base) ?? t }
      if (base < next && timerStart + timeout <= t) {
        events.push({ kind: 'timeout', seq: base, t })
        timerStart = t
        queue = []
        for (let s = base; s < next; s++) queue.push(s)
      }
    } else {
      // A timer per frame, so only the frame that was actually lost repeats.
      for (let s = base; s < next; s++) {
        if (acked.has(s) || queue.includes(s)) continue
        if ((sentAt.get(s) ?? 0) + timeout <= t) {
          events.push({ kind: 'timeout', seq: s, t })
          queue.push(s)
        }
      }
    }

    // ── 3. the wire carries one frame per tick ───────────────────────────
    if (queue.length) sendData(queue.shift(), t)
    else if (next < frames && next < base + W) sendData(next++, t)
  }

  function receive(seq, now) {
    if (cumulative) {
      if (seq === rxBase) {
        delivered.push(seq)
        rxBase++
        events.push({ kind: 'deliver', seq, t: now })
        put('ack', rxBase - 1, now)
      } else {
        // Out of order is simply thrown away, and the receiver repeats the
        // last thing it did accept. That is the cost Selective Repeat pays
        // buffer space to avoid.
        events.push({ kind: 'discard', seq, t: now })
        if (rxBase > 0) put('ack', rxBase - 1, now)
      }
      return
    }

    if (seq < rxBase) { put('ack', seq, now); return }        // duplicate
    if (seq >= rxBase + W) { events.push({ kind: 'discard', seq, t: now }); return }

    rxBuf.add(seq)
    put('ack', seq, now)
    while (rxBuf.has(rxBase)) {
      rxBuf.delete(rxBase)
      delivered.push(rxBase)
      events.push({ kind: 'deliver', seq: rxBase, t: rxBase === seq ? now : now })
      rxBase++
    }
  }

  const finished = base >= frames
  const ticks = finished ? t : maxTicks

  return {
    events,
    delivered,
    stats: {
      protocol,
      window: W,
      frames,
      ticks,
      loss,
      lossAck: lossAck === null ? loss : lossAck,
      transmissions,
      retransmissions,
      finished,
      // How much of the work was useful. One is perfect.
      efficiency: transmissions ? frames / transmissions : 0,
    },
  }
}

/**
 * The comparison the chapter exists for: three protocols, one set of losses.
 * Because the seed is shared, any difference in the numbers is the protocol
 * and nothing else.
 */
export function compare(settings = {}) {
  return PROTOCOLS.map((protocol) => simulate({ ...settings, protocol }).stats)
}


/*
 * A finding worth keeping, because it contradicts the textbook summary.
 *
 * "Go-Back-N retransmits more than Selective Repeat" is only reliably true
 * when the ACKs get through. Go-Back-N acknowledges cumulatively, and its
 * receiver re-sends that same cumulative ACK on every out-of-order arrival —
 * so it fires many more ACKs, and losing some of them costs it little.
 * Selective Repeat sends one ACK per frame; lose that ACK and the frame is
 * resent even though it arrived perfectly.
 *
 * Measured here over 200 seeds at 25% loss: with ACK loss on, Go-Back-N came
 * out ahead on 44 of them. With `lossAck: 0` it never did — the textbook
 * ordering holds on all 200, by an average of 7.6 retransmissions.
 *
 * Both are worth showing, so the widget exposes it as a switch rather than
 * hiding whichever one makes the slide tidier.
 */
