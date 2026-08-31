/**
 * canvas.js — the render loop and playback.
 *
 * One requestAnimationFrame drives everything: the Animator is stepped, the
 * scene is drawn. The loop parks itself when nothing is moving and wakes on the
 * next command, so an idle tab costs nothing.
 *
 * Playback replays the envelope's events as packets travelling between nodes.
 * It reads only `from`, `to`, `dir`, `bytes` and `label`, so a traceroute or a
 * TLS handshake animates through this same code with no changes.
 */
import { Animator, schedule, totalDuration } from './anim.js'
import { layoutFromEvents, idleScene, packetPosition } from './scene.js'
import { drawLink, drawNode, drawPacket, drawCaption, drawHint, readPalette } from './draw.js'
import { subKeys, get } from '../state.js'

export function createViz({ canvas, container }) {
  const ctx = canvas.getContext('2d')
  const animator = new Animator()

  let size = { width: 0, height: 0 }
  let scene = { nodes: [], links: [], order: [] }
  let packets = []          // in flight right now
  let caption = ''
  let hint = ''
  let activeNodes = new Set()
  let running = false
  let dirty = true
  let lastEvents = []

  // ── sizing ────────────────────────────────────────────────────────────────

  function resize() {
    const rect = container.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)   // cap: 3x costs a lot for no gain
    size = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) }

    canvas.width = Math.round(size.width * dpr)
    canvas.height = Math.round(size.height * dpr)
    canvas.style.width = `${size.width}px`
    canvas.style.height = `${size.height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    relayout()
  }

  function relayout() {
    const events = get().events
    scene = events.length ? layoutFromEvents(events, size) : idleScene(size)
    dirty = true
    wake()
  }

  // ── render ────────────────────────────────────────────────────────────────

  function render() {
    ctx.clearRect(0, 0, size.width, size.height)
    if (!scene.nodes.length) return

    const byId = new Map(scene.nodes.map((n) => [n.id, n]))
    const liveLinks = new Set(packets.map((p) => [p.from, p.to].sort().join('|')))

    for (const link of scene.links) {
      const a = byId.get(link.from)
      const b = byId.get(link.to)
      if (a && b) {
        drawLink(ctx, a, b, {
          state: link.state,
          active: liveLinks.has([link.from, link.to].sort().join('|')),
        })
      }
    }

    for (const node of scene.nodes) {
      drawNode(ctx, node, { highlight: activeNodes.has(node.id) })
    }

    for (const p of packets) drawPacket(ctx, p)

    drawCaption(ctx, caption, size)
    drawHint(ctx, hint, size)
  }

  // ── loop ──────────────────────────────────────────────────────────────────

  function frame(now) {
    animator.step(now)
    if (dirty || animator.busy) {
      render()
      dirty = false
    }
    if (animator.busy) requestAnimationFrame(frame)
    else running = false
  }

  function wake() {
    if (running) return
    running = true
    requestAnimationFrame(frame)
  }

  // ── playback ──────────────────────────────────────────────────────────────

  /**
   * Replay a set of events as packets in flight.
   * Each event becomes one tween along its link; `onDone` on the last one
   * leaves the final caption on screen.
   */
  function play(events) {
    // Traceroute appends a hop every few seconds. Replaying the whole path each
    // time would restart the animation from the beginning, so when the incoming
    // list merely extends the last one, only the new tail is animated and the
    // hops already on screen stay put.
    const appended = isExtensionOf(lastEvents, events)
    const from = appended ? lastEvents.length : 0
    lastEvents = events

    if (!appended) {
      animator.clear()
      packets = []
      activeNodes = new Set()
    }

    if (!events.length) {
      scene = idleScene(size)
      caption = ''
      hint = ''
      dirty = true
      wake()
      return
    }

    // The layout always covers every node, so an appended hop widens the chain.
    scene = layoutFromEvents(events, size)

    const tail = events.slice(from)
    const plan = schedule(tail, { speed: get().playbackSpeed })

    for (const step of plan) {
      const e = tail[step.index]
      const rejected = /reject/i.test(e.label ?? '') || Boolean(e.note)

      const packet = {
        id: `p${from + step.index}`,
        from: e.from,
        to: e.to,
        dir: e.dir,
        bytes: e.bytes,
        rejected,
        x: 0, y: 0, dx: 0, dy: 0,
      }

      animator.add({
        ms: step.ms,
        delay: step.startAt,
        onUpdate(progress) {
          if (!packets.includes(packet)) {
            packets.push(packet)
            caption = e.label
            hint = `${e.dir === 'out' ? '→' : '←'} ${e.dir === 'out' ? e.to : e.from}   ${e.bytes} bytes   ${e.t.toFixed(1)} ms real`
            activeNodes = new Set([e.from, e.to])
          }
          const prev = { x: packet.x, y: packet.y }
          const pos = packetPosition(scene, e, progress)
          if (pos) {
            packet.x = pos.x
            packet.y = pos.y
            packet.dx = packet.x - prev.x
            packet.dy = packet.y - prev.y
          }
        },
        onDone() {
          packets = packets.filter((p) => p !== packet)
          activeNodes = new Set([e.to])
          dirty = true
        },
      })
    }

    // Once everything has landed, leave the last line on screen as the summary.
    const last = events[events.length - 1]
    animator.add({
      ms: 1,
      delay: totalDuration(plan) + 60,
      onDone() {
        // Three shapes end up here and each needs its own summary. Chapter 1 is a
        // topology, a traceroute is a path, everything else is a transfer —
        // "6 packets, 4.7 ms round trip" would be wrong for the first two.
        const proto = last.proto
        if (proto === 'LAN') {
          caption = 'your network'
          hint = `${events.length} device${events.length === 1 ? '' : 's'} your machine has met`
        } else if (proto === 'ICMP' && events.length > 2) {
          const silent = events.filter((e) => e.note === 'silent').length
          caption = 'the path'
          hint = silent
            ? `${events.length} hops · ${silent} stayed silent · ${last.t.toFixed(1)} ms to the far end`
            : `${events.length} hops · ${last.t.toFixed(1)} ms to the far end`
        } else {
          caption = last.label
          hint = `${events.length} packets · ${last.t.toFixed(1)} ms round trip`
        }
        activeNodes = new Set()
        dirty = true
      },
    })

    dirty = true
    wake()
  }

  /** True when `next` is `prev` with more events on the end. */
  function isExtensionOf(prev, next) {
    if (!prev.length || next.length <= prev.length) return false
    for (let i = 0; i < prev.length; i++) {
      if (keyOf(prev[i]) !== keyOf(next[i])) return false
    }
    return true
  }

  const keyOf = (e) => `${e.label}|${e.from}|${e.to}|${e.t}|${e.bytes}`

  // ── wiring ────────────────────────────────────────────────────────────────

  const observer = new ResizeObserver(resize)
  observer.observe(container)

  subKeys(['events', 'playbackSpeed'], (s) => play(s.events))
  subKeys(['theme'], () => { readPalette(); dirty = true; wake() })

  resize()

  return {
    resize,
    replay: () => play(get().events),
    destroy: () => observer.disconnect(),
  }
}
