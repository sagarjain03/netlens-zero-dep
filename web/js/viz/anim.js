/**
 * anim.js — a tween engine. Replaces gsap, anime.js and framer-motion.
 *
 * One Animator is owned by the render loop and stepped once per frame, so the
 * whole app runs on a single requestAnimationFrame rather than one per tween.
 * Pure: it never touches the DOM, which is why it is unit-tested directly.
 */

// ── easing ──────────────────────────────────────────────────────────────────

export const easing = {
  linear: (t) => t,
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInCubic: (t) => t * t * t,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  easeOutBack: (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
  easeOutQuart: (t) => 1 - (1 - t) ** 4,
}

export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

// ── Animator ────────────────────────────────────────────────────────────────

/**
 * Holds active tweens and advances them from an externally supplied clock.
 * Taking `now` as an argument rather than reading performance.now() keeps the
 * whole thing deterministic and testable.
 */
export class Animator {
  constructor() {
    this._tweens = []
    this._seq = 0
    this._started = false
  }

  /**
   * @param {object} spec
   * @param {number} [spec.from=0]
   * @param {number} [spec.to=1]
   * @param {number} spec.ms         duration
   * @param {number} [spec.delay=0]
   * @param {Function} [spec.ease]
   * @param {(value:number, t:number)=>void} [spec.onUpdate]
   * @param {()=>void} [spec.onDone]
   * @returns {{id:number, cancel:()=>void}}
   */
  add({ from = 0, to = 1, ms, delay = 0, ease = easing.easeOutCubic, onUpdate, onDone }) {
    const id = ++this._seq
    this._tweens.push({
      id, from, to, ms: Math.max(1, ms), delay, ease, onUpdate, onDone,
      startedAt: null, done: false,
    })
    return { id, cancel: () => this.cancel(id) }
  }

  cancel(id) {
    this._tweens = this._tweens.filter((t) => t.id !== id)
  }

  clear() {
    this._tweens = []
    this._started = false
  }

  get busy() {
    return this._tweens.length > 0
  }

  get count() {
    return this._tweens.length
  }

  /**
   * Advance every tween to the wall clock `now`.
   * The first call establishes the origin, so a delay is measured from the
   * moment the animation actually begins rather than from when it was queued.
   */
  step(now) {
    if (!this._tweens.length) return

    if (!this._started) {
      this._started = true
      for (const t of this._tweens) if (t.startedAt === null) t.startedAt = now + t.delay
    }

    const finished = []
    for (const t of this._tweens) {
      if (t.startedAt === null) t.startedAt = now + t.delay
      if (now < t.startedAt) continue

      const raw = clamp((now - t.startedAt) / t.ms, 0, 1)
      const eased = t.ease(raw)
      t.onUpdate?.(lerp(t.from, t.to, eased), raw)

      if (raw >= 1) {
        t.done = true
        finished.push(t)
      }
    }

    if (finished.length) {
      this._tweens = this._tweens.filter((t) => !t.done)
      // Callbacks fire after the list is pruned so onDone can queue more work.
      for (const t of finished) t.onDone?.()
      if (!this._tweens.length) this._started = false
    }
  }
}

// ── timing ──────────────────────────────────────────────────────────────────

/**
 * Turn real network timings into watchable ones.
 *
 * A DNS round trip finishes in 13 ms. Played back literally nothing would be
 * visible, so flight time is mapped onto a range a person can follow. The
 * mapping is monotonic — a slow response still visibly takes longer than a fast
 * one — and the timeline always shows the true figure alongside.
 */
export const FLIGHT_MIN = 420
export const FLIGHT_MAX = 1500
export const GAP_MAX = 260

export function flightMs(realMs, slowestMs) {
  if (!Number.isFinite(realMs) || realMs <= 0) return FLIGHT_MIN
  const ceiling = Math.max(slowestMs || realMs, 1)
  // Square-root keeps small differences visible without letting one slow hop
  // stretch the whole animation.
  const ratio = Math.sqrt(clamp(realMs / ceiling, 0, 1))
  return Math.round(lerp(FLIGHT_MIN, FLIGHT_MAX, ratio))
}

/**
 * Build a playback schedule from timeline events: when each packet starts
 * flying and how long it takes.
 *
 * `speed` is a divisor a learner controls from the terminal: `replay 4` runs the
 * same exchange four times slower, which is how you actually read a handshake.
 *
 * @returns {Array<{index:number, startAt:number, ms:number}>}
 */
export function schedule(events, { speed = 1 } = {}) {
  if (!events.length) return []
  const slow = clamp(speed, 0.25, 10)
  const slowest = Math.max(...events.map((e) => e.t ?? 0), 1)

  const plan = []
  let cursor = 0
  let prevT = 0

  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    const realGap = Math.max(0, (e.t ?? 0) - prevT)
    const ms = Math.round(flightMs(realGap || e.t || 0, slowest) * slow)

    // Packets never overlap: each waits for the previous to land, plus a short
    // pause proportional to the real gap so the rhythm reflects the real one.
    const gap = i === 0 ? 0 : Math.round(clamp(realGap * 6, 60, GAP_MAX) * slow)
    plan.push({ index: i, startAt: cursor + gap, ms })
    cursor = cursor + gap + ms
    prevT = e.t ?? 0
  }
  return plan
}

export const totalDuration = (plan) =>
  plan.length ? Math.max(...plan.map((p) => p.startAt + p.ms)) : 0
