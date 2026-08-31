/**
 * topics.test.js — the syllabus registry and its content.
 *
 * TOPICS lists the whole syllabus, including what is not written yet, so the
 * rail tells the truth about how far along the project is. That honesty only
 * holds if `WRITTEN` and the actual files agree — a topic marked ready that
 * loads to nothing would be worse than one openly marked as pending.
 *
 * The route tests exist because a topic id is a URL. Renaming one silently
 * breaks a bookmark, so the fallback behaviour is pinned rather than assumed.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  MODULES, TOPICS, IDS, entry, moduleOf, neighbours,
  WRITTEN, hasContent, coverage, loadTopic,
} from '../web/js/lesson/topics/index.js'
import { parseHash, toHash } from '../web/js/router.js'
import { CHAPTERS } from '../web/js/lesson/chapters/index.js'

describe('the registry', () => {
  test('every id is unique — they are URLs', () => {
    assert.equal(new Set(IDS).size, IDS.length)
  })

  test('every id is URL-safe', () => {
    for (const id of IDS) assert.match(id, /^[a-z0-9-]+$/, `${id} is not safe in a hash`)
  })

  test('every topic belongs to exactly one module', () => {
    for (const t of TOPICS) {
      const owners = MODULES.filter((m) => m.topics.some((x) => x.id === t.id))
      assert.equal(owners.length, 1, `${t.id} belongs to ${owners.length} modules`)
      assert.equal(moduleOf(t.id).id, t.module)
    }
  })

  test('every cross-link points at a chapter that exists', () => {
    for (const t of TOPICS) {
      if (t.see === undefined) continue
      assert.ok(CHAPTERS.some((c) => c.id === t.see), `${t.id} links to chapter ${t.see}`)
    }
  })

  test('every named lab is one the lab command accepts', async () => {
    // A topic offering `lab foo` where foo does not exist gives the learner a
    // button that fails, which is worse than no button.
    const { COMMANDS } = await import('../web/js/term/commands.js')
    const usage = COMMANDS.lab.examples.join(' ')
    const known = ['crc', 'hamming', 'bitstuff', 'parity', 'arq', 'subnet', 'ipv4', 'topology', 'compare', 'layers']
    assert.ok(usage.length > 0)
    for (const t of TOPICS) {
      if (!t.lab) continue
      assert.ok(known.includes(t.lab), `${t.id} names an unknown lab: ${t.lab}`)
    }
  })

  test('neighbours walk the syllabus in order and stop at the ends', () => {
    assert.equal(neighbours(IDS[0]).prev, null)
    assert.equal(neighbours(IDS.at(-1)).next, null)
    assert.equal(neighbours(IDS[0]).next.id, IDS[1])
    assert.equal(neighbours(IDS[3]).prev.id, IDS[2])
  })

  test('an unknown id is refused rather than guessed at', () => {
    assert.equal(entry('no-such-topic'), null)
    assert.equal(moduleOf('no-such-topic'), null)
  })
})

describe('written content matches what the rail claims', () => {
  test('every id in WRITTEN is a real topic', () => {
    for (const id of WRITTEN) assert.ok(IDS.includes(id), `${id} is written but not listed`)
  })

  test('everything marked ready actually loads', async () => {
    for (const id of WRITTEN) {
      const topic = await loadTopic(id)
      assert.ok(topic, `${id} is marked ready and loaded nothing`)
      assert.ok(topic.title?.en, `${id} has no title`)
      assert.ok(topic.beats?.length, `${id} has no beats`)
      assert.ok(topic.challenge?.ask, `${id} has no challenge`)
    }
  })

  test('anything not marked ready loads nothing, rather than half a page', async () => {
    // Held whether or not the syllabus is complete: a topic outside WRITTEN
    // must resolve to null so the card can say so instead of opening blank.
    for (const id of IDS.filter((x) => !hasContent(x))) {
      assert.equal(await loadTopic(id), null, `${id} is unwritten but loaded something`)
    }
    assert.equal(await loadTopic('not-a-topic-at-all'), null)
  })

  test('the syllabus is complete', async () => {
    // Reached at block 21. If this ever fails, a topic was added to MODULES
    // without content — which is allowed, but the rail must then dim it.
    const pending = IDS.filter((id) => !hasContent(id))
    assert.deepEqual(pending, [], `still unwritten: ${pending.join(', ')}`)
  })

  test('written topics are bilingual all the way down', async () => {
    for (const id of WRITTEN) {
      const t = await loadTopic(id)
      assert.ok(t.title.hi, `${id} title`)
      assert.ok(t.question?.hi, `${id} question`)
      for (const b of t.beats) assert.ok(b.text.hi, `${id} beat`)
      for (const p of t.points ?? []) assert.ok(p.hi, `${id} point`)
      assert.ok(t.challenge.ask.hi, `${id} challenge`)
    }
  })

  test('a topic that opens a lab says why before it does', async () => {
    for (const id of WRITTEN) {
      const t = await loadTopic(id)
      if (!t.lab) continue
      assert.ok(t.labSay?.en, `${id} opens ${t.lab} without saying what to do in it`)
    }
  })

  test('coverage reports the truth', () => {
    const { written, total } = coverage()
    assert.equal(written, WRITTEN.size)
    assert.equal(total, IDS.length)
    assert.ok(written <= total, 'more topics are written than are listed')
  })
})

describe('the text itself', () => {
  test('no Cyrillic homoglyphs hiding in the Hinglish', async () => {
    // Two of these slipped in: "khola" with a Cyrillic a, "Socho" with a
    // Cyrillic o. They look identical, render fine, and quietly break search,
    // copy-paste and the glossary matcher. The eye cannot catch them; this can.
    const { readdirSync, readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')

    const roots = ['topics', 'chapters'].map((d) =>
      fileURLToPath(new URL(`../web/js/lesson/${d}/`, import.meta.url)))
    roots.push(fileURLToPath(new URL('../web/js/lesson/', import.meta.url)))

    const suspicious = /[Ѐ-ӿͰ-Ͽ]/

    for (const root of roots) {
      for (const name of readdirSync(root)) {
        if (!name.endsWith('.js')) continue
        const text = readFileSync(join(root, name), 'utf8')
        text.split('\n').forEach((line, i) => {
          assert.equal(suspicious.test(line), false,
            `${name}:${i + 1} contains a Cyrillic or Greek lookalike: ${line.trim().slice(0, 70)}`)
        })
      }
    }
  })
})

describe('routing', () => {
  test('a topic route round-trips', () => {
    const hash = toHash({ mode: 'topics', topic: 'framing' })
    assert.equal(hash, '#/topic/framing')
    assert.deepEqual(parseHash(hash), { mode: 'topics', chapter: 1, tier: 1, topic: 'framing' })
  })

  test('a chapter route still round-trips', () => {
    const hash = toHash({ mode: 'journey', chapter: 5, tier: 3 })
    assert.equal(hash, '#/ch/5/tier/3')
    assert.deepEqual(parseHash(hash), { mode: 'journey', chapter: 5, tier: 3, topic: null })
  })

  test('a stale topic bookmark lands somewhere rather than nowhere', () => {
    const route = parseHash('#/topic/renamed-last-week')
    assert.equal(route.mode, 'topics')
    assert.equal(route.topic, IDS[0])
  })

  test('nonsense falls back to the start of the journey', () => {
    assert.deepEqual(parseHash('#/nonsense'), { mode: 'journey', chapter: 1, tier: 1, topic: null })
    assert.deepEqual(parseHash(''), { mode: 'journey', chapter: 1, tier: 1, topic: null })
  })

  test('chapter and tier are clamped to what exists', () => {
    assert.equal(parseHash('#/ch/99/tier/9').chapter, 8)
    assert.equal(parseHash('#/ch/99/tier/9').tier, 3)
    assert.equal(parseHash('#/ch/0/tier/0').chapter, 1)
  })
})
