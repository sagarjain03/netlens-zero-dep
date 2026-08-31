/**
 * sim-arq.test.js — the sliding-window claims, checked.
 *
 * The widget makes claims out loud: every protocol delivers the data in order,
 * a perfect link needs no retransmissions, and Go-Back-N repeats more than
 * Selective Repeat over the same losses. They are asserted here, so what is on
 * screen is a result rather than a slogan.
 *
 * The third claim turned out to need a qualifier, which is why writing these
 * was worth it: it holds when data frames are what get lost, and reverses when
 * ACKs do. Both directions are pinned below rather than quietly averaged away.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { simulate, compare, chanceAt, PROTOCOLS } from '../web/js/sim/arq.js'

const inOrder = (n) => Array.from({ length: n }, (_, i) => i)

describe('the channel', () => {
  test('the same transmission always meets the same fate', () => {
    assert.equal(chanceAt(42, 1, 3, 2), chanceAt(42, 1, 3, 2))
    assert.notEqual(chanceAt(42, 1, 3, 2), chanceAt(43, 1, 3, 2))
  })

  test('stays inside [0, 1)', () => {
    for (let seq = 0; seq < 30; seq++) {
      for (let a = 1; a <= 30; a++) {
        const v = chanceAt(9, 1, seq, a)
        assert.ok(v >= 0 && v < 1, `out of range: ${v}`)
      }
    }
  })

  test('consecutive attempts are independent — the avalanche bug', () => {
    // Without a final mixing step, attempt N and attempt N+1 came out almost
    // equal, so an unlucky frame stayed unlucky for sixty-four tries and the
    // simulation never terminated. Both properties are pinned here.
    let below = 0
    let total = 0
    let run = 0
    let longest = 0

    for (let seq = 0; seq < 20; seq++) {
      run = 0
      for (let a = 1; a <= 300; a++) {
        total++
        if (chanceAt(7, 1, seq, a) < 0.25) { below++; run++; longest = Math.max(longest, run) }
        else run = 0
      }
    }

    const rate = below / total
    assert.ok(Math.abs(rate - 0.25) < 0.02, `loss rate drifted to ${rate.toFixed(4)}`)
    assert.ok(longest <= 15, `a frame lost ${longest} times in a row — the mixing has regressed`)
  })
})

describe('every protocol', () => {
  for (const protocol of PROTOCOLS) {
    test(`${protocol}: a perfect link costs exactly one transmission per frame`, () => {
      const { stats, delivered } = simulate({ protocol, frames: 8, loss: 0, window: 4 })
      assert.equal(stats.finished, true)
      assert.equal(stats.transmissions, 8)
      assert.equal(stats.retransmissions, 0)
      assert.equal(stats.efficiency, 1)
      assert.deepEqual(delivered, inOrder(8))
    })

    test(`${protocol}: data is delivered in order even when frames are lost`, () => {
      for (const seed of [1, 5, 12, 77, 404]) {
        const { delivered, stats } = simulate({ protocol, frames: 8, loss: 0.3, window: 4, seed })
        assert.equal(stats.finished, true, `${protocol} stalled on seed ${seed}`)
        assert.deepEqual(delivered, inOrder(8), `${protocol} delivered out of order on seed ${seed}`)
      }
    })

    test(`${protocol}: identical settings replay identically`, () => {
      const a = simulate({ protocol, frames: 6, loss: 0.25, seed: 3 })
      const b = simulate({ protocol, frames: 6, loss: 0.25, seed: 3 })
      assert.deepEqual(a.events, b.events)
      assert.deepEqual(a.stats, b.stats)
    })
  }
})

describe('stop-and-wait', () => {
  test('never has two frames on the wire at once', () => {
    const { events } = simulate({ protocol: 'stop-and-wait', frames: 6, loss: 0.3, seed: 11 })
    const data = events.filter((e) => e.kind === 'data')
    for (const a of data) {
      const overlapping = data.filter((b) => b !== a && b.t0 < a.t1 && a.t0 < b.t1)
      assert.equal(overlapping.length, 0, `frame ${a.seq} overlapped another`)
    }
  })

  test('a window setting cannot widen it', () => {
    const { stats } = simulate({ protocol: 'stop-and-wait', window: 8, frames: 4, loss: 0 })
    assert.equal(stats.window, 1)
  })
})

describe('go-back-n vs selective repeat — the whole point', () => {
  test('when data is what gets lost, go-back-n always repeats more', () => {
    let strictlyWorseSomewhere = false

    // `lossAck: 0` is the textbook setting: the losses under comparison are
    // the data frames, which is what the claim is actually about.
    for (let seed = 1; seed <= 60; seed++) {
      const settings = { frames: 10, window: 4, loss: 0.25, lossAck: 0, seed }
      const gbn = simulate({ ...settings, protocol: 'go-back-n' }).stats
      const sr = simulate({ ...settings, protocol: 'selective-repeat' }).stats

      assert.ok(
        gbn.retransmissions >= sr.retransmissions,
        `seed ${seed}: go-back-n ${gbn.retransmissions} < selective-repeat ${sr.retransmissions}`,
      )
      if (gbn.retransmissions > sr.retransmissions) strictlyWorseSomewhere = true
    }

    assert.ok(strictlyWorseSomewhere, 'the difference has to actually show up somewhere')
  })

  test('but losing ACKs turns it around, because cumulative ACKs repeat themselves', () => {
    // Documented rather than hidden: Go-Back-N re-sends its cumulative ACK on
    // every out-of-order arrival, so ACK loss barely hurts it, while Selective
    // Repeat resends a frame that arrived perfectly. Measured at 44 seeds in
    // 200; asserting only that the reversal is real, not how often.
    let reversals = 0
    for (let seed = 1; seed <= 200; seed++) {
      const settings = { frames: 10, window: 4, loss: 0.25, seed }
      const gbn = simulate({ ...settings, protocol: 'go-back-n' }).stats
      const sr = simulate({ ...settings, protocol: 'selective-repeat' }).stats
      if (gbn.retransmissions < sr.retransmissions) reversals++
    }
    assert.ok(reversals > 0, 'the ACK-loss advantage should show up somewhere')
  })

  test('go-back-n throws away out-of-order frames; selective repeat keeps them', () => {
    const settings = { frames: 10, window: 4, loss: 0.3, seed: 23 }
    const gbn = simulate({ ...settings, protocol: 'go-back-n' })
    const sr = simulate({ ...settings, protocol: 'selective-repeat' })

    const discards = (r) => r.events.filter((e) => e.kind === 'discard').length
    assert.ok(discards(gbn) > 0, 'go-back-n should have discarded something')
    assert.ok(discards(sr) <= discards(gbn))
  })

  test('a wider window pipelines more, so the same data finishes sooner', () => {
    const narrow = simulate({ protocol: 'go-back-n', frames: 12, window: 1, loss: 0, prop: 6 }).stats
    const wide = simulate({ protocol: 'go-back-n', frames: 12, window: 6, loss: 0, prop: 6 }).stats
    assert.ok(wide.ticks < narrow.ticks, `${wide.ticks} should beat ${narrow.ticks}`)
  })
})

describe('compare()', () => {
  test('runs all three on one set of losses', () => {
    const rows = compare({ frames: 8, window: 4, loss: 0.25, seed: 5 })
    assert.equal(rows.length, 3)
    assert.deepEqual(rows.map((r) => r.protocol), PROTOCOLS)
    for (const r of rows) assert.equal(r.finished, true)
  })

  test('a lossless link makes all three cost the same', () => {
    const rows = compare({ frames: 8, window: 4, loss: 0, seed: 5 })
    assert.deepEqual(rows.map((r) => r.transmissions), [8, 8, 8])
  })
})
