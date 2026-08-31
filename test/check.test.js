/**
 * check.test.js — challenge verification.
 *
 * The point of this file is the negative half. A verifier that ticks green
 * for the wrong reason is worse than no verifier, because a learner who has
 * not done the thing is told they have. So every check is tested against the
 * envelope that ought to fail it as well as the one that ought to pass.
 *
 * It also pins which challenges are checkable at all. Four of the eight ask
 * for an explanation, and if somebody ever bolts a verifier onto one of those
 * this test will say so.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { passes, isCheckable, kinds } from '../web/js/lesson/check.js'
import { CHAPTERS } from '../web/js/lesson/chapters/index.js'

const dns = (answerTypes) => ({ meta: { answerTypes }, events: [] })
const tls = (matchesConnectedHost) => ({ meta: { matchesConnectedHost }, events: [] })
const http = (status) => ({ meta: { status }, events: [] })
const trace = (n) => ({ meta: {}, events: Array.from({ length: n }, (_, i) => ({ t: i })) })

describe('a check only passes for the thing it names', () => {
  test('dnsType wants that record type and no other', () => {
    const v = { kind: 'dnsType', type: 'AAAA' }
    assert.equal(passes(dns(['AAAA']), v), true)
    assert.equal(passes(dns(['A', 'AAAA']), v), true, 'a mixed answer still contains one')
    assert.equal(passes(dns(['A']), v), false)
    assert.equal(passes(dns(['CNAME', 'A']), v), false)
    assert.equal(passes(dns([]), v), false, 'an empty answer is not a pass')
  })

  test('certForOtherName wants a mismatch, not merely an unknown', () => {
    const v = { kind: 'certForOtherName' }
    assert.equal(passes(tls(false), v), true)
    assert.equal(passes(tls(true), v), false)
    // null means the app could not tell. That is not a pass — the learner has
    // to actually produce the mismatch, not just fail to disprove one.
    assert.equal(passes(tls(null), v), false)
    assert.equal(passes(tls(undefined), v), false)
  })

  test('httpStatus wants that exact code', () => {
    const v = { kind: 'httpStatus', code: 304 }
    assert.equal(passes(http(304), v), true)
    assert.equal(passes(http(200), v), false)
    assert.equal(passes(http(301), v), false)
    assert.equal(passes(http('304'), v), false, 'a string status is not the number')
  })

  test('hops wants at least that many, and counts silent routers too', () => {
    const v = { kind: 'hops', min: 8 }
    assert.equal(passes(trace(8), v), true)
    assert.equal(passes(trace(12), v), true)
    assert.equal(passes(trace(7), v), false)
    assert.equal(passes(trace(0), v), false)
  })
})

describe('nothing passes by accident', () => {
  test('a missing or unknown declaration never passes', () => {
    assert.equal(passes(dns(['AAAA']), undefined), false)
    assert.equal(passes(dns(['AAAA']), null), false)
    assert.equal(passes(dns(['AAAA']), { kind: 'wishful-thinking' }), false)
  })

  test('a missing envelope never passes', () => {
    assert.equal(passes(null, { kind: 'dnsType', type: 'AAAA' }), false)
    assert.equal(passes(undefined, { kind: 'hops', min: 1 }), false)
  })

  test('a malformed envelope fails rather than throwing', () => {
    for (const kind of kinds()) {
      assert.doesNotThrow(() => passes({}, { kind, type: 'A', code: 200, min: 1 }))
      assert.equal(passes({}, { kind, type: 'A', code: 200, min: 1 }), false)
    }
  })

  test('one challenge cannot be solved by another chapter’s command', () => {
    // A TLS envelope must not satisfy the DNS challenge, and so on.
    const envelopes = [dns(['A']), tls(true), http(200), trace(2)]
    const wrong = [
      { kind: 'dnsType', type: 'AAAA' },
      { kind: 'certForOtherName' },
      { kind: 'httpStatus', code: 304 },
      { kind: 'hops', min: 8 },
    ]
    for (const env of envelopes) {
      for (const v of wrong) assert.equal(passes(env, v), false)
    }
  })
})

describe('which challenges are checkable', () => {
  test('exactly the four that a packet can settle', () => {
    const checkable = CHAPTERS.filter((c) => isCheckable(c.challenge?.verify)).map((c) => c.id)
    assert.deepEqual(checkable, [2, 3, 5, 6])
  })

  test('the other four carry no verifier at all', () => {
    // 1, 4, 7 and 8 ask for an explanation. If a verifier is ever added to
    // one of them, it has to be because the envelope genuinely settles it.
    for (const id of [1, 4, 7, 8]) {
      const ch = CHAPTERS.find((c) => c.id === id)
      assert.equal(ch.challenge.verify, undefined, `chapter ${id} grew a verifier`)
    }
  })

  test('every verifier names a check that exists', () => {
    for (const ch of CHAPTERS) {
      const v = ch.challenge?.verify
      if (!v) continue
      assert.ok(kinds().includes(v.kind), `chapter ${ch.id} names unknown check ${v.kind}`)
    }
  })
})
