/**
 * sim-topo.test.js — topologies, as graphs rather than adjectives.
 *
 * Textbooks describe topologies with words like "reliable" and "expensive",
 * none of which can be checked. The graph can: how many cables it costs, who
 * still hears you after a cut, and which single machine takes everyone down.
 * Those three questions are what the widget answers, so they are asserted here.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  KINDS, build, cableCount, reach, connected,
  survivesAnySingleBreak, singlePointsOfFailure, TRAITS,
} from '../web/js/sim/topo.js'

describe('what each topology costs in cable', () => {
  test('the counts match the graphs actually built', () => {
    for (const kind of KINDS) {
      for (let n = 2; n <= 10; n++) {
        assert.equal(build(kind, n).links.length, cableCount(kind, n), `${kind} with ${n} machines`)
      }
    }
  })

  test('mesh grows as the square, the others as a line', () => {
    assert.equal(cableCount('mesh', 4), 6)
    assert.equal(cableCount('mesh', 8), 28)
    assert.equal(cableCount('mesh', 12), 66)

    // Doubling the machines roughly quadruples a mesh and merely doubles a star.
    assert.ok(cableCount('mesh', 12) / cableCount('mesh', 6) > 3.5)
    assert.ok(cableCount('star', 12) / cableCount('star', 6) < 2.5)
  })

  test('a ring costs exactly one more cable than a bus, and that buys the loop', () => {
    for (let n = 3; n <= 10; n++) {
      assert.equal(cableCount('ring', n), cableCount('bus', n) + 1)
    }
  })
})

describe('every topology starts out connected', () => {
  test('with nothing broken, everyone can reach everyone', () => {
    for (const kind of KINDS) {
      const t = build(kind, 6)
      assert.equal(connected(t), true, kind)
      assert.equal(reach(t, 0).size, 6, kind)
    }
  })

  test('a star puts everyone two hops apart, through the hub', () => {
    const t = build('star', 6)
    const hops = reach(t, 1)
    assert.equal(hops.get(0), 1, 'the hub is one hop away')
    for (const id of [2, 3, 4, 5]) assert.equal(hops.get(id), 2, `node ${id} should be two hops`)
  })

  test('a mesh puts everyone one hop apart — that is what the cables buy', () => {
    const t = build('mesh', 6)
    const hops = reach(t, 0)
    for (const id of [1, 2, 3, 4, 5]) assert.equal(hops.get(id), 1)
  })

  test('a bus is a shared medium, so everyone hears it at once', () => {
    // Not a chain of hops: the signal is on one wire. This is why a bus needs
    // collision detection, and why nothing on it is private.
    const t = build('bus', 8)
    const hops = reach(t, 0)
    assert.equal(hops.size, 8)
    for (const id of [1, 2, 3, 4, 5, 6, 7]) assert.equal(hops.get(id), 1, `node ${id}`)
  })
})

describe('what happens when a cable is cut', () => {
  test('one cut splits a bus into two networks', () => {
    const t = build('bus', 6)
    const broken = new Set([t.links[2].id])          // between tap 2 and tap 3
    assert.equal(connected(t, broken), false)

    const heard = reach(t, 0, broken)
    assert.deepEqual([...heard.keys()].sort((a, b) => a - b), [0, 1, 2])
  })

  test('a ring survives one cut and splits on two', () => {
    const t = build('ring', 6)
    assert.equal(connected(t, new Set([t.links[0].id])), true, 'the long way round still works')
    assert.equal(connected(t, new Set([t.links[0].id, t.links[3].id])), false)
  })

  test('one cut in a star loses exactly one machine', () => {
    const t = build('star', 6)
    const broken = new Set([t.links[0].id])          // the spoke to node 1
    assert.equal(connected(t, broken), false)
    assert.equal(reach(t, 0, broken).size, 5, 'the other five are fine')
  })

  test('a mesh shrugs off any single cut; bus and star do not', () => {
    assert.equal(survivesAnySingleBreak(build('mesh', 6)), true)
    assert.equal(survivesAnySingleBreak(build('ring', 6)), true)
    assert.equal(survivesAnySingleBreak(build('bus', 6)), false)
    assert.equal(survivesAnySingleBreak(build('star', 6)), false)
  })
})

describe('single points of failure', () => {
  test('the hub is the star weakness, and it is the only one', () => {
    const spofs = singlePointsOfFailure(build('star', 6))
    assert.deepEqual(spofs, [0], 'only the hub should split a star')
  })

  test('a mesh and a ring have none', () => {
    assert.deepEqual(singlePointsOfFailure(build('mesh', 6)), [])
    assert.deepEqual(singlePointsOfFailure(build('ring', 6)), [])
  })

  test('every machine in the middle of a bus is one', () => {
    // Losing a tap takes its cable segments with it, so the ends fall apart.
    const spofs = singlePointsOfFailure(build('bus', 6))
    assert.deepEqual(spofs, [1, 2, 3, 4], 'the ends are not, the middle taps are')
  })
})

describe('the traits table', () => {
  test('every topology has one, and it says something', () => {
    for (const kind of KINDS) {
      const t = TRAITS[kind]
      assert.ok(t, `${kind} has no traits`)
      for (const key of ['cable', 'listen', 'fail', 'why']) {
        assert.ok(t[key] && t[key].length > 20, `${kind}.${key} is missing or empty`)
      }
    }
  })
})
