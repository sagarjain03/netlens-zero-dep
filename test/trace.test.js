/**
 * trace.test.js — the traceroute parser, on both column orders.
 *
 * Windows prints the timings first and the address last; Unix prints the
 * address first. That is precisely the kind of difference that surfaces on
 * someone else's laptop halfway through a demo, so both shapes are pinned here.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseTrace, parseTraceLine, parseTraceHeader, isTraceComplete, summarise,
} from '../src/sys/trace.js'

const DIR = fileURLToPath(new URL('./fixtures/sys/', import.meta.url))
const fx = (n) => readFileSync(join(DIR, n), 'utf8')

describe('trace · the target line', () => {
  test('windows, with and without a resolved name', () => {
    assert.deepEqual(parseTraceHeader('Tracing route to 1.1.1.1 over a maximum of 8 hops'),
      { host: '1.1.1.1', ip: '1.1.1.1' })
    assert.deepEqual(parseTraceHeader('Tracing route to github.com [140.82.113.4]'),
      { host: 'github.com', ip: '140.82.113.4' })
  })

  test('unix', () => {
    assert.deepEqual(parseTraceHeader('traceroute to github.com (140.82.113.4), 30 hops max, 60 byte packets'),
      { host: 'github.com', ip: '140.82.113.4' })
  })

  test('an ordinary hop line is not mistaken for the header', () => {
    assert.equal(parseTraceHeader('  1     1 ms     1 ms     4 ms  192.168.1.1'), null)
    assert.equal(parseTraceHeader(''), null)
  })

  test('completion is recognised', () => {
    assert.equal(isTraceComplete('Trace complete.'), true)
    assert.equal(isTraceComplete('  1  192.168.1.1  2 ms'), false)
  })
})

describe('trace · a single hop, either column order', () => {
  test('windows: timings first, address last', () => {
    const hop = parseTraceLine('  1     1 ms     1 ms     4 ms  192.168.1.1 ')
    assert.equal(hop.hop, 1)
    assert.equal(hop.host, '192.168.1.1')
    assert.deepEqual(hop.times, [1, 1, 4])
    assert.equal(hop.silent, false)
    assert.equal(hop.avg, 2)
  })

  test('unix: address first, timings after', () => {
    const hop = parseTraceLine(' 1  192.168.1.1  2.123 ms  2.045 ms  1.987 ms')
    assert.equal(hop.hop, 1)
    assert.equal(hop.host, '192.168.1.1')
    assert.equal(hop.times.length, 3)
    assert.equal(hop.silent, false)
    assert.ok(hop.avg > 1.9 && hop.avg < 2.2)
  })

  test('windows sub-millisecond timings', () => {
    const hop = parseTraceLine('  1    <1 ms    <1 ms    <1 ms  192.168.1.1')
    assert.deepEqual(hop.times, [1, 1, 1])
    assert.equal(hop.host, '192.168.1.1')
  })

  test('a partly silent hop keeps the timings that did arrive', () => {
    const hop = parseTraceLine('  3     4 ms     *        *     103.127.130.113 ')
    assert.equal(hop.host, '103.127.130.113')
    assert.equal(hop.silent, false, 'it answered at least once')
    assert.deepEqual(hop.times, [4, null, null])
    assert.equal(hop.avg, 4, 'the average ignores the misses')
  })

  test('a fully silent hop is not an error — it still holds a place on the path', () => {
    for (const line of ['  4     *        *        *     Request timed out.', ' 3  * * *']) {
      const hop = parseTraceLine(line)
      assert.equal(hop.silent, true)
      assert.equal(hop.host, null)
      assert.equal(hop.avg, null)
      assert.ok(hop.hop > 0, 'the hop number survives, so the gap is visible')
    }
  })

  test('a resolved windows name yields the address, which is what we can draw', () => {
    const hop = parseTraceLine('  6   145 ms   144 ms   145 ms  lb.github.com [140.82.113.4]')
    assert.equal(hop.host, '140.82.113.4')
  })

  test('a line that is not a hop returns nothing', () => {
    for (const line of ['', 'Trace complete.', 'over a maximum of 30 hops:', '   ']) {
      assert.equal(parseTraceLine(line), null)
    }
  })
})

describe('trace · a whole run', () => {
  const cases = [
    ['windows', parseTrace(fx('tracert-win-named.txt'))],
    ['linux', parseTrace(fx('traceroute-linux.txt'))],
  ]

  for (const [os, result] of cases) {
    test(`${os}: the same path is read from either format`, () => {
      assert.equal(result.target.ip, '140.82.113.4')
      assert.equal(result.hops.length, 6)
      assert.equal(result.answered, 5)
      assert.equal(result.silent, 1, 'hop 3 stayed quiet on both')
      assert.equal(result.hops[0].host, '192.168.1.1', `${os}: the first hop is your router`)
      assert.equal(result.hops[5].host, '140.82.113.4', `${os}: the last hop is the destination`)
    })

    test(`${os}: hop numbers are contiguous, gaps included`, () => {
      assert.deepEqual(result.hops.map((h) => h.hop), [1, 2, 3, 4, 5, 6])
    })
  }

  test('windows marks the run complete; unix simply stops', () => {
    assert.equal(parseTrace(fx('tracert-win.txt')).complete, true)
    assert.equal(parseTrace(fx('traceroute-linux.txt')).complete, false)
  })

  test('the interface header lines are never counted as hops', () => {
    const r = parseTrace(fx('tracert-win.txt'))
    assert.equal(r.hops.length, 6)
    assert.ok(r.hops.every((h) => h.hop >= 1 && h.hop <= 6))
  })
})

describe('trace · the biggest latency jump', () => {
  test('the long-haul link is identified on both platforms', () => {
    for (const f of ['tracert-win-named.txt', 'traceroute-linux.txt']) {
      const { biggestJump } = parseTrace(fx(f))
      assert.ok(biggestJump, `${f}: a jump was found`)
      assert.equal(biggestJump.from.hop, 4)
      assert.equal(biggestJump.to.hop, 5)
      assert.ok(biggestJump.delta > 100,
        `${f}: 18ms to 142ms is the undersea cable, got ${biggestJump.delta}`)
    }
  })

  test('silent hops are skipped when measuring the jump', () => {
    // Hop 3 answers nothing, so the comparison must run 2 -> 4, not 2 -> 3.
    const { biggestJump } = parseTrace(fx('traceroute-linux.txt'))
    assert.ok(!biggestJump.from.silent && !biggestJump.to.silent)
  })

  test('a path with no jump reports none rather than inventing one', () => {
    const flat = summarise([
      { hop: 1, avg: 5, silent: false },
      { hop: 2, avg: 5, silent: false },
    ])
    assert.equal(flat.biggestJump, null)
  })

  test('a completely silent path reports nothing rather than throwing', () => {
    const r = parseTrace(fx('traceroute-all-silent.txt'))
    assert.equal(r.answered, 0)
    assert.equal(r.silent, 5)
    assert.equal(r.totalMs, null)
    assert.equal(r.biggestJump, null)
    assert.equal(r.hops.length, 5, 'the silent hops are still on the map')
  })

  test('empty input does not throw', () => {
    const r = parseTrace('')
    assert.deepEqual(r.hops, [])
    assert.equal(r.target, null)
  })
})
