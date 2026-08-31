/**
 * viz.test.js — the tween engine and the scene layout.
 *
 * Both are pure by design: Animator takes its clock as an argument and
 * layoutFromEvents takes a size, so neither needs a browser. What is left in
 * canvas.js and draw.js is pixels, and that is checked live.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  Animator, easing, lerp, clamp,
  schedule, flightMs, totalDuration, FLIGHT_MIN, FLIGHT_MAX,
} from '../web/js/viz/anim.js'
import {
  layoutFromEvents, idleScene, packetPosition, displayName, portOf,
} from '../web/js/viz/scene.js'

const SIZE = { width: 1000, height: 500 }

const dnsEvents = [
  { t: 0, dir: 'out', from: 'you', to: '1.1.1.1:53', proto: 'UDP', bytes: 28, label: 'DNS query' },
  { t: 12.4, dir: 'in', from: '1.1.1.1:53', to: 'you', proto: 'UDP', bytes: 44, label: 'DNS response' },
]

// ── easing ──────────────────────────────────────────────────────────────────

describe('viz · easing', () => {
  test('every curve starts at 0 and ends at 1', () => {
    for (const [name, fn] of Object.entries(easing)) {
      assert.ok(Math.abs(fn(0)) < 1e-6, `${name}(0) should be 0`)
      assert.ok(Math.abs(fn(1) - 1) < 1e-6, `${name}(1) should be 1`)
    }
  })

  test('easeOutCubic decelerates — most of the distance is covered early', () => {
    assert.ok(easing.easeOutCubic(0.5) > 0.5)
  })

  test('lerp and clamp behave', () => {
    assert.equal(lerp(10, 20, 0.5), 15)
    assert.equal(clamp(5, 0, 3), 3)
    assert.equal(clamp(-5, 0, 3), 0)
  })
})

// ── Animator ────────────────────────────────────────────────────────────────

describe('viz · Animator', () => {
  test('runs a tween from start to finish and reports done once', () => {
    const a = new Animator()
    const seen = []
    let done = 0
    a.add({ from: 0, to: 100, ms: 100, ease: easing.linear, onUpdate: (v) => seen.push(v), onDone: () => done++ })

    a.step(1000)
    a.step(1050)
    a.step(1100)
    a.step(1200)

    assert.equal(seen[0], 0)
    assert.equal(seen[seen.length - 1], 100)
    assert.equal(done, 1, 'onDone fires exactly once')
    assert.equal(a.busy, false)
  })

  test('a delay is measured from the first frame, not from when it was queued', () => {
    const a = new Animator()
    let updates = 0
    a.add({ ms: 100, delay: 200, ease: easing.linear, onUpdate: () => updates++ })

    a.step(5000)          // origin
    assert.equal(updates, 0, 'still inside the delay')
    a.step(5150)
    assert.equal(updates, 0)
    a.step(5250)
    assert.ok(updates > 0, 'past the delay now')
  })

  test('tweens are independent and cancellable', () => {
    const a = new Animator()
    let a1 = 0, a2 = 0
    const h = a.add({ ms: 100, ease: easing.linear, onUpdate: () => a1++ })
    a.add({ ms: 100, ease: easing.linear, onUpdate: () => a2++ })
    assert.equal(a.count, 2)

    a.step(0)
    h.cancel()
    a.step(50)
    assert.equal(a.count, 1)
    assert.equal(a1, 1, 'the cancelled tween stopped updating')
    assert.ok(a2 > 1)
  })

  test('onDone can queue more work without corrupting the list', () => {
    const a = new Animator()
    let second = false
    a.add({
      ms: 10,
      onDone: () => a.add({ ms: 10, onDone: () => { second = true } }),
    })
    a.step(0); a.step(20)     // first finishes, queues the second
    a.step(30); a.step(60)    // second runs
    assert.equal(second, true)
    assert.equal(a.busy, false)
  })

  test('stepping with nothing queued is a no-op', () => {
    const a = new Animator()
    a.step(0)
    assert.equal(a.busy, false)
  })
})

// ── playback timing ─────────────────────────────────────────────────────────

describe('viz · playback timing', () => {
  test('a 13ms round trip is stretched to something a person can watch', () => {
    const plan = schedule(dnsEvents)
    assert.equal(plan.length, 2)
    assert.ok(totalDuration(plan) > 900, 'at least a second of animation')
    assert.ok(totalDuration(plan) < 6000, 'but not a slideshow')
  })

  test('packets never overlap — each starts after the previous lands', () => {
    const plan = schedule(dnsEvents)
    assert.ok(plan[1].startAt >= plan[0].startAt + plan[0].ms)
  })

  test('flight time is monotonic, so a slow reply visibly takes longer', () => {
    const fast = flightMs(5, 500)
    const slow = flightMs(400, 500)
    assert.ok(slow > fast)
    assert.ok(fast >= FLIGHT_MIN && slow <= FLIGHT_MAX)
  })

  test('zero and missing durations still get a visible flight', () => {
    assert.equal(flightMs(0, 100), FLIGHT_MIN)
    assert.equal(flightMs(undefined, 100), FLIGHT_MIN)
  })

  test('replay speed stretches the whole schedule proportionally', () => {
    const normal = totalDuration(schedule(dnsEvents))
    const slow = totalDuration(schedule(dnsEvents, { speed: 4 }))
    assert.ok(slow > normal * 3.5 && slow < normal * 4.5, 'roughly four times longer')
    assert.ok(schedule(dnsEvents, { speed: 4 })[1].startAt > schedule(dnsEvents)[1].startAt)
  })

  test('an absurd speed is clamped rather than freezing the animation', () => {
    const huge = totalDuration(schedule(dnsEvents, { speed: 1000 }))
    const ten = totalDuration(schedule(dnsEvents, { speed: 10 }))
    assert.equal(huge, ten, 'clamped at 10x')
    assert.ok(totalDuration(schedule(dnsEvents, { speed: 0.001 })) > 0, 'never zero-length')
  })

  test('an empty event list schedules nothing', () => {
    assert.deepEqual(schedule([]), [])
    assert.equal(totalDuration([]), 0)
  })

  test('a long traceroute stays bounded', () => {
    const hops = Array.from({ length: 12 }, (_, i) => ({
      t: (i + 1) * 20, dir: 'in', from: `10.0.0.${i}`, to: 'you', bytes: 60, label: `hop ${i + 1}`,
    }))
    assert.ok(totalDuration(schedule(hops)) < 25000, '12 hops must not take half a minute')
  })
})

// ── scene layout ────────────────────────────────────────────────────────────

describe('viz · scene layout', () => {
  test('a request/response pair lays out two nodes, you on the left', () => {
    const scene = layoutFromEvents(dnsEvents, SIZE)
    assert.equal(scene.nodes.length, 2)
    const [you, peer] = scene.nodes
    assert.equal(you.id, 'you')
    assert.equal(you.label, 'You')
    assert.ok(you.x < peer.x, 'the local device sits to the left')
    assert.equal(peer.label, '1.1.1.1')
    assert.equal(peer.port, '53')
    assert.equal(peer.kind, 'resolver', 'port 53 is drawn as a phonebook')
  })

  test('one link is built, not one per event', () => {
    const scene = layoutFromEvents(dnsEvents, SIZE)
    assert.equal(scene.links.length, 1, 'the query and the reply share a wire')
  })

  test('nodes stay inside the canvas', () => {
    const scene = layoutFromEvents(dnsEvents, SIZE)
    for (const n of scene.nodes) {
      assert.ok(n.x > 0 && n.x < SIZE.width, `${n.id} x is on screen`)
      assert.ok(n.y > 0 && n.y < SIZE.height, `${n.id} y is on screen`)
    }
  })

  test('many endpoints form a chain, which is what a traceroute looks like', () => {
    const hops = Array.from({ length: 6 }, (_, i) => ({
      t: i * 10, dir: 'in', from: `10.0.0.${i}`, to: 'you', bytes: 60, label: `hop ${i}`,
    }))
    const scene = layoutFromEvents(hops, SIZE)
    assert.equal(scene.nodes.length, 7, 'you plus six hops')
    assert.equal(scene.nodes[0].id, 'you', 'the local device is still first')

    const xs = scene.nodes.map((n) => n.x)
    assert.deepEqual(xs, [...xs].sort((a, b) => a - b), 'hops progress left to right')
    assert.ok(scene.links.length >= 6, 'hop-to-hop links are inferred')
    assert.ok(scene.nodes.some((n) => n.kind === 'router'), 'middle hops are routers')
  })

  test('no events means a single idle device', () => {
    assert.deepEqual(layoutFromEvents([], SIZE), { nodes: [], links: [], order: [] })
    const idle = idleScene(SIZE)
    assert.equal(idle.nodes.length, 1)
    assert.equal(idle.nodes[0].id, 'you')
  })

  test('the same events always lay out identically', () => {
    assert.deepEqual(layoutFromEvents(dnsEvents, SIZE), layoutFromEvents(dnsEvents, SIZE))
  })
})

describe('viz · packet position', () => {
  const scene = layoutFromEvents(dnsEvents, SIZE)

  test('travels from one node to the other', () => {
    const start = packetPosition(scene, dnsEvents[0], 0)
    const end = packetPosition(scene, dnsEvents[0], 1)
    const mid = packetPosition(scene, dnsEvents[0], 0.5)

    assert.deepEqual(start, { x: scene.nodes[0].x, y: scene.nodes[0].y })
    assert.deepEqual(end, { x: scene.nodes[1].x, y: scene.nodes[1].y })
    assert.ok(mid.x > start.x && mid.x < end.x)
  })

  test('the reply travels the other way', () => {
    const outEnd = packetPosition(scene, dnsEvents[0], 1)
    const inEnd = packetPosition(scene, dnsEvents[1], 1)
    assert.ok(inEnd.x < outEnd.x, 'the response lands back at You')
  })

  test('an unknown endpoint yields no position rather than NaN', () => {
    assert.equal(packetPosition(scene, { from: 'ghost', to: 'you' }, 0.5), null)
  })
})

describe('viz · endpoint naming', () => {
  test('ports are split off for display but kept as identity', () => {
    assert.equal(displayName('1.1.1.1:53'), '1.1.1.1')
    assert.equal(portOf('1.1.1.1:53'), '53')
    assert.equal(displayName('you'), 'You')
    assert.equal(portOf('you'), null)
  })
})
