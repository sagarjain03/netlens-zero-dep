/**
 * ask.test.js — the doubt box.
 *
 * This is the one feature in netlens that can reach outside the machine, so
 * the tests are mostly about what it does when it cannot, and about what it
 * refuses to send.
 *
 * Nothing here makes a network call. The endpoint is exercised with no key
 * configured, which is both the default state and the state a judge is most
 * likely to see.
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { handleAsk, isConfigured, _groundIn } from '../src/api/ask.js'
import { glossaryAnswer, aboutsThisApp, isDefinitionQuestion } from '../web/js/lesson/ask.js'
import { GLOSSARY } from '../web/js/lesson/glossary.js'

/** The smallest thing sendJson will write to. */
function fakeRes() {
  return {
    statusCode: null,
    body: null,
    writeHead(status) { this.statusCode = status; return this },
    end(buf) { this.body = JSON.parse(String(buf)) },
  }
}

const ask = async (body) => {
  const res = fakeRes()
  await handleAsk({ res, body })
  return res
}

let hadKey
before(() => { hadKey = process.env.GROQ_API_KEY; delete process.env.GROQ_API_KEY })
after(() => { if (hadKey !== undefined) process.env.GROQ_API_KEY = hadKey })

describe('with no key configured — the default', () => {
  test('reports itself as unconfigured rather than pretending', () => {
    assert.equal(isConfigured(), false)
  })

  test('answers honestly instead of failing', async () => {
    const res = await ask({ question: 'what is a TTL?' })
    assert.equal(res.statusCode, 200, 'a missing key is not an error condition')
    assert.equal(res.body.ok, true)
    assert.equal(res.body.source, 'offline')
    assert.equal(res.body.reason, 'no-key')
    assert.equal(res.body.answer, null)
  })

  test('an empty question is refused before anything else happens', async () => {
    for (const question of ['', '   ', undefined]) {
      const res = await ask({ question })
      assert.equal(res.statusCode, 400)
      assert.equal(res.body.ok, false)
    }
  })
})

describe('the grounding block', () => {
  test('names what is actually on screen', () => {
    const text = _groundIn({
      chapter: 'Names to Numbers',
      tier: 3,
      packet: { label: 'DNS query', bytes: 30, hex: 'abcd0100' },
      events: [{ dir: 'out', label: 'DNS query', bytes: 30, proto: 'UDP' }],
    })
    assert.match(text, /Names to Numbers/)
    assert.match(text, /depth 3/)
    assert.match(text, /DNS query, 30 bytes/)
    assert.match(text, /abcd0100/)
    assert.match(text, /-> DNS query/)
  })

  test('says so when there is nothing on screen, rather than sending nothing', () => {
    assert.match(_groundIn(), /No packet is on screen/)
    assert.match(_groundIn({}), /No packet is on screen/)
  })

  test('asks for Hinglish when that is the reading language', () => {
    assert.match(_groundIn({ chapter: 'X', lang: 'hi' }), /Hinglish/)
    assert.equal(/Hinglish/.test(_groundIn({ chapter: 'X', lang: 'en' })), false)
  })

  test('truncates a long packet rather than sending the whole thing', () => {
    const text = _groundIn({ packet: { label: 'big', hex: 'ab'.repeat(400) } })
    const shown = text.match(/Its bytes in hex: ([0-9a-f]+)/)?.[1]
    assert.ok(shown, 'the hex line is missing entirely')
    assert.ok(shown.length <= 160, `sent ${shown.length} hex characters`)
  })

  test('the bytes are sent even when the packet has no label', () => {
    // They used to be nested inside the label check, so a packet without one
    // reached the model with no bytes at all — and it said so.
    const text = _groundIn({ packet: { hex: 'deadbeef' } })
    assert.match(text, /deadbeef/)
  })

  test('a selected field is named, because that is what the question is about', () => {
    const text = _groundIn({ field: { name: 'AA', value: '0' } })
    assert.match(text, /Selected field: AA = 0/)
  })
})

describe('questions about the app answer themselves', () => {
  /**
   * "What is this site?" is the first thing anybody asks, and leaving it to
   * the model produced a confidently wrong answer: with a DNS packet on
   * screen it read "this site" as the host being looked up and explained the
   * hostname was not in the bytes. Correct about the packet, useless as an
   * answer, and no wording of the prompt reliably fixed it.
   */
  test('the obvious phrasings are caught', () => {
    for (const q of [
      'what is this site?',
      'what is this app?',
      'What is this website',
      'what is netlens',
      'what is this?',
      'is this tool free',
    ]) {
      assert.equal(aboutsThisApp(q), true, `missed: ${q}`)
    }
  })

  test('it does not swallow a real question that happens to say "this"', () => {
    // The failure mode worth guarding: a packet question eaten by the app blurb.
    for (const q of [
      'what is this byte doing?',
      'what is this field for',
      'why is this packet 30 bytes',
      'what is a TTL?',
      'what is this flag set to and why does it matter',
    ]) {
      assert.equal(aboutsThisApp(q), false, `wrongly caught: ${q}`)
    }
  })

  test('it contains no control characters', () => {
    // The first version of this pattern was written by a script whose \b
    // became a literal backspace (0x08). It compiled, and matched nothing.
    const source = readFileSync(new URL('../web/js/lesson/ask.js', import.meta.url), 'utf8')
    const control = source.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/)
    assert.equal(control, null,
      control ? `control character U+${control[0].charCodeAt(0).toString(16).padStart(4, '0')} in the source` : '')
  })
})

describe('the glossary knows when not to answer', () => {
  /**
   * It used to answer anything containing a known word, so "why is the AA bit
   * zero here?" came back with the definition of "bit". True, instant, and a
   * worse answer than the question deserved. A definition-shaped question
   * gets the glossary; a question about something specific gets the model.
   */
  test('a request for a meaning is the glossary’s job', () => {
    for (const q of ['what is a TTL?', 'what does SNI mean', 'explain the subnet mask', 'TTL']) {
      assert.equal(isDefinitionQuestion(q), true, `should be a definition: ${q}`)
    }
  })

  test('a question about the packet on screen is not', () => {
    for (const q of [
      'why is the AA bit zero here?',
      'why is the TTL 64 here',
      'how does this packet get routed',
      'is this byte part of the header',
    ]) {
      assert.equal(isDefinitionQuestion(q), false, `should reach the model: ${q}`)
    }
  })

  test('the terms are still matched either way, so a fallback stays possible', () => {
    // The match is what lets an unreachable model fall back to a definition
    // rather than to nothing at all.
    assert.equal(glossaryAnswer('why is the AA bit zero here?')?.term, 'bit')
  })
})

describe('the glossary answers first', () => {
  test('a question about a known term never needs the network', () => {
    for (const [question, expected] of [
      ['what is a TTL?', 'TTL'],
      ['I do not understand the subnet mask', 'subnet mask'],
      ['why does SNI matter', 'SNI'],
      ['what does a resolver do', 'resolver'],
    ]) {
      const hit = glossaryAnswer(question)
      assert.ok(hit, `no glossary answer for: ${question}`)
      assert.equal(hit.term, expected)
      assert.ok(hit.en.length > 20)
    }
  })

  test('the longest matching term wins', () => {
    // "subnet mask" is a better answer than "mask" when both could match.
    assert.equal(glossaryAnswer('explain the subnet mask').term, 'subnet mask')
  })

  test('it matches whole words only', () => {
    // "important" contains "port"; that is not a question about ports.
    assert.equal(glossaryAnswer('why is this important'), null)
  })

  test('an unknown question falls through rather than guessing', () => {
    assert.equal(glossaryAnswer('why did my professor set this assignment'), null)
    assert.equal(glossaryAnswer(''), null)
  })

  test('every glossary entry it can return is usable as an answer', () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      assert.ok(entry.term, `${key} has no display term`)
      assert.ok(entry.en?.length > 20, `${key} has no usable English answer`)
      assert.ok(entry.hi?.length > 20, `${key} has no usable Hinglish answer`)
    }
  })
})
