/**
 * sim-stack.test.js — encapsulation arithmetic, and the comparison data.
 *
 * The overhead lesson only lands if the numbers are right: the same envelopes
 * cost the same bytes whatever is inside them, so a tiny message is mostly
 * envelope and a large one is mostly message. That is asserted here rather
 * than asserted at the learner.
 *
 * The comparison tables get a shape check too. A row with the wrong number of
 * values silently misaligns a column, and a `see` command that does not exist
 * gives the learner a button that fails — both are worth catching here.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { STACK, encapsulate, peel, overheadFor, MODELS, SWAPS } from '../web/js/sim/stack.js'
import { COMPARISONS, IDS, commandsUsed } from '../web/js/sim/cmp.js'
import { COMMANDS } from '../web/js/term/commands.js'

describe('encapsulation', () => {
  test('every layer adds exactly its own header and trailer', () => {
    const { layers } = encapsulate(142)
    for (const l of layers) {
      assert.equal(l.after - l.before, l.header + l.trailer, `${l.name} added the wrong amount`)
    }
  })

  test('each layer starts where the one above it finished', () => {
    const { layers, payload } = encapsulate(142)
    assert.equal(layers[0].before, payload, 'the innermost layer wraps the payload itself')
    for (let i = 1; i < layers.length; i++) {
      assert.equal(layers[i].before, layers[i - 1].after, `a gap before ${layers[i].name}`)
    }
  })

  test('the total is the payload plus every header', () => {
    const r = encapsulate(142)
    const headers = STACK.reduce((n, l) => n + l.header + l.trailer, 0)
    assert.equal(r.total, 142 + headers)
    assert.equal(r.overhead, headers)
  })

  test('turning TLS off removes exactly the record header', () => {
    const withTls = encapsulate(142, { tls: true })
    const without = encapsulate(142, { tls: false })
    assert.equal(withTls.total - without.total, 5)
    assert.equal(without.layers.some((l) => l.id === 'tls'), false)
  })

  test('overhead is a fixed toll, not a percentage — the whole lesson', () => {
    // The same envelopes cost the same bytes whatever is inside them.
    assert.equal(overheadFor(1), overheadFor(1400))

    const tiny = encapsulate(1)
    const large = encapsulate(1400)
    assert.ok(tiny.overheadPct > 95, `a one-byte message is nearly all envelope, got ${tiny.overheadPct}`)
    assert.ok(large.overheadPct < 5, `a large one is nearly all message, got ${large.overheadPct}`)
  })

  test('an empty payload is all overhead and does not divide by zero', () => {
    const r = encapsulate(0)
    assert.equal(r.payload, 0)
    assert.equal(r.overheadPct, 100)
    assert.ok(Number.isFinite(r.total))
  })

  test('peeling is wrapping read backwards', () => {
    const down = encapsulate(142).layers.map((l) => l.id)
    const up = peel(142).map((l) => l.id)
    assert.deepEqual(up, down.slice().reverse())
  })

  test('every layer points back at the chapter it was met in', () => {
    for (const l of STACK) {
      assert.ok(l.chapter >= 1 && l.chapter <= 8, `${l.name} has no chapter`)
      assert.ok(l.role.length > 20 && l.roleHi.length > 20, `${l.name} is missing a role`)
    }
  })
})

describe('the two models', () => {
  test('OSI has seven layers and TCP/IP folds them into four', () => {
    assert.equal(MODELS.length, 7)
    assert.equal(new Set(MODELS.map((m) => m.tcpip)).size, 4)
  })

  test('session and presentation are the two nobody implements separately', () => {
    const unreal = MODELS.filter((m) => !m.real).map((m) => m.osiName)
    assert.deepEqual(unreal.sort(), ['Presentation', 'Session'])
  })

  test('every swap names a layer that exists', () => {
    for (const s of SWAPS) {
      assert.ok(s.layer >= 1 && s.layer <= 7, `${s.goal} names layer ${s.layer}`)
      assert.ok(s.why.length > 10, `${s.goal} has no reason`)
    }
  })
})

describe('the comparison tables', () => {
  test('every row has one value per column', () => {
    for (const id of IDS) {
      const c = COMPARISONS[id]
      for (const row of c.rows) {
        assert.equal(row.values.length, c.columns.length,
          `${id}: "${row.aspect.en}" has ${row.values.length} values for ${c.columns.length} columns`)
      }
    }
  })

  test('every comparison is bilingual all the way down', () => {
    for (const id of IDS) {
      const c = COMPARISONS[id]
      assert.ok(c.title.en && c.title.hi, `${id} title`)
      assert.ok(c.blurb.en && c.blurb.hi, `${id} blurb`)
      for (const row of c.rows) assert.ok(row.aspect.en && row.aspect.hi, `${id}: ${row.aspect.en}`)
    }
  })

  test('every comparison offers something to run and something to answer', () => {
    for (const id of IDS) {
      const c = COMPARISONS[id]
      assert.ok(c.see?.length, `${id} has nothing to run`)
      assert.ok(c.asks?.length, `${id} has nothing to answer`)
      for (const a of c.asks) assert.ok(a.why, `${id}: "${a.q.en}" has no reason`)
    }
  })

  test('every command a comparison offers actually exists', () => {
    // A button that runs an unknown command is worse than no button.
    for (const line of commandsUsed()) {
      const name = line.split(/\s+/)[0]
      assert.ok(COMMANDS[name], `"${line}" uses an unknown command: ${name}`)
    }
  })

  test('at least one comparison records where the two agree', () => {
    // Agreements are as informative as differences, and tables usually drop them.
    const agreements = IDS.flatMap((id) => COMPARISONS[id].rows.filter((r) => r.same))
    assert.ok(agreements.length >= 3, 'the tables only record differences')
  })
})
