/**
 * api-dns.test.js — the envelope the browser actually receives.
 *
 * buildEnvelope() is separated from the socket precisely so this can run offline
 * against captured fixtures. Nothing here opens a UDP port.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEnvelope } from '../src/api/dns.js'
import { decode } from '../src/proto/dns.js'
import { hexToBytes } from '../src/shared/bytes.js'
import { resolveServer, resolverLabel, DEFAULT_RESOLVER } from '../src/proto/dns-client.js'

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url))
const fixture = (n) => hexToBytes(readFileSync(join(FIX, n), 'utf8').trim())

/** Rebuild the shape dns-client.js returns, without touching the network. */
function fakeWire(name, { durationMs = 12.4, expectId = null } = {}) {
  const request = fixture(`${name}.query.hex`)
  const response = fixture(`${name}.resp.hex`)
  const sentId = request.readUInt16BE(0)
  const gotId = response.readUInt16BE(0)
  const waitingFor = expectId ?? sentId
  return {
    request, response, durationMs,
    server: '1.1.1.1', port: 53, localPort: 54321,
    sentId, gotId, expectId: waitingFor, idMatch: waitingFor === gotId,
    requestMessage: decode(request),
    responseMessage: decode(response),
  }
}

const build = (name, opts) => buildEnvelope(fakeWire(name, opts), { server: '1.1.1.1', lang: 'en' })

describe('api/dns · envelope shape', () => {
  const env = build('dns-a-github')

  test('matches the contract every endpoint must return', () => {
    assert.deepEqual(Object.keys(env), ['ok', 'durationMs', 'events', 'packets', 'meta', 'text'])
    assert.equal(env.ok, true)
  })

  test('two events: one out, one in', () => {
    assert.equal(env.events.length, 2)
    assert.equal(env.events[0].dir, 'out')
    assert.equal(env.events[1].dir, 'in')
    assert.equal(env.events[0].t, 0)
    assert.equal(env.events[1].t, 12.4)
    assert.equal(env.events[0].proto, 'UDP')
  })

  test('two packets, and only the query is editable', () => {
    assert.equal(env.packets.length, 2)
    const [q, r] = env.packets
    assert.equal(q.id, 'q')
    assert.equal(q.editable, true, 'the outgoing packet is what the byte editor edits')
    assert.equal(r.id, 'r')
    assert.equal(r.editable, false, 'you cannot edit what the server sent you')
    assert.equal(q.length, 28)
    assert.ok(q.tree.length >= 2 && r.tree.length >= 3)
  })

  test('every event points at a packet that exists', () => {
    const ids = new Set(env.packets.map((p) => p.id))
    for (const e of env.events) assert.ok(ids.has(e.packetId), `event ${e.label} → packet ${e.packetId}`)
  })

  test('text is the dig-style answer the terminal prints', () => {
    assert.match(env.text, /^github\.com\.\t\d+\tIN\tA\t/)
  })
})

describe('api/dns · narration explains without hex', () => {
  test('a successful lookup tells the phonebook story with real values', () => {
    const env = build('dns-a-github')
    assert.match(env.events[0].narration, /does not know github\.com/)
    assert.match(env.events[0].narration, /Cloudflare \(1\.1\.1\.1\)/)
    assert.match(env.events[1].narration, /12\.4 ms/)
    assert.match(env.events[1].narration, /A \d+\.\d+\.\d+\.\d+/)
  })

  test('NXDOMAIN says the name does not exist, not "error"', () => {
    const env = build('dns-nxdomain')
    assert.match(env.events[1].narration, /no such name|does not exist/i)
    assert.equal(env.meta.rcode, 3)
    assert.equal(env.meta.answerCount, 0)
  })

  test('a name with no record of that type is distinguished from a missing name', () => {
    const env = build('dns-txt-google')
    assert.equal(env.meta.rcode, 0)
    assert.match(env.events[1].narration, /exists, but it has no/)
  })

  test('Hinglish narration is a real translation, not a fallback', () => {
    const hi = buildEnvelope(fakeWire('dns-a-github'), { server: '1.1.1.1', lang: 'hi' })
    assert.match(hi.events[0].narration, /phonebook|poocha/i)
    assert.notEqual(hi.events[0].narration, build('dns-a-github').events[0].narration)
  })
})

describe('api/dns · the transaction-id lesson', () => {
  test('a matching id is accepted', () => {
    const env = build('dns-a-github')
    assert.equal(env.meta.idMatch, true)
    assert.equal(env.events[1].label, 'DNS response')
    assert.equal(env.events[1].note, '')
  })

  test('editing the id makes the reply fail to match, exactly as a forged answer would', () => {
    // The learner edits the id field; we are still waiting for the original.
    const env = build('dns-a-github', { expectId: 0x9999 })
    assert.equal(env.meta.idMatch, false)
    assert.equal(env.meta.expectId, 0x9999)
    assert.equal(env.meta.gotId, 0x1a2b)
    assert.match(env.events[1].label, /REJECTED/)
    assert.equal(env.events[1].note, 'transaction id mismatch')
    assert.match(env.events[1].narration, /0x9999.*0x1a2b|thrown away/)
    assert.match(env.events[1].narration, /forged/i)
  })
})

describe('api/dns · resolver selection', () => {
  test('defaults to the fastest resolver measured on this machine', () => {
    assert.equal(resolveServer(), DEFAULT_RESOLVER)
    assert.equal(DEFAULT_RESOLVER, '1.1.1.1')
  })

  test('accepts names and raw IPv4', () => {
    assert.equal(resolveServer('google'), '8.8.8.8')
    assert.equal(resolveServer('quad9'), '9.9.9.9')
    assert.equal(resolveServer('192.168.1.1'), '192.168.1.1')
    assert.equal(resolverLabel('8.8.8.8'), 'Google')
  })

  test('rejects anything that is not an address', () => {
    assert.throws(() => resolveServer('not-a-resolver'), /not an IPv4 address/)
    assert.throws(() => resolveServer('999.1.1.1'), /not an IPv4 address/)
  })
})

describe('api/dns · a broken packet still renders', () => {
  test('a truncated response produces a note instead of a crash', () => {
    const wire = fakeWire('dns-a-github')
    wire.response = wire.response.subarray(0, 30)
    wire.responseMessage = decode(wire.response)
    const env = buildEnvelope(wire, { server: '1.1.1.1', lang: 'en' })
    assert.equal(env.ok, true)
    assert.ok(env.meta.truncatedParse, 'the UI is told why parsing stopped')
    assert.ok(env.packets[1].tree.length >= 1, 'the header still renders')
  })
})
