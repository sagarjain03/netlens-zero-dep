/**
 * dns.test.js — the DNS codec, tested against real captured packets.
 *
 * Every fixture in test/fixtures/ is a genuine query/response pair recorded from
 * 1.1.1.1. Nothing here touches the network, so the suite is deterministic and
 * passes with the Wi-Fi off — which is the point we make in the demo.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  encode, decode, decodeName, encodeName,
  typeName, typeNumber, rcodeName, formatAnswers, TYPES,
} from '../src/proto/dns.js'
import { Reader, Writer, hexToBytes, bitsOf } from '../src/shared/bytes.js'

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url))
const fixture = (name) => hexToBytes(readFileSync(join(FIX, name), 'utf8').trim())

// The exact bytes a query for github.com produces. If this string ever changes,
// the encoder changed — which is what we want a test to shout about.
const GITHUB_QUERY_HEX = '1a2b010000010000000000000667697468756203636f6d0000010001'

describe('dns · encode', () => {
  test('produces the exact bytes of a real query', () => {
    const buf = encode({ domain: 'github.com', type: 'A', id: 0x1a2b })
    assert.equal(buf.toString('hex'), GITHUB_QUERY_HEX)
    assert.equal(buf.length, 28)
  })

  test('a name is length-prefixed labels, not a dotted string', () => {
    const w = new Writer(32)
    encodeName(w, 'github.com')
    assert.equal(Buffer.from(w.done()).toString('hex'), '0667697468756203636f6d00')
    //                                                   ^^ 6  "github"  ^^ 3 "com" ^^ root
  })

  test('sets RD by default and clears it on request', () => {
    assert.equal(encode({ domain: 'a.com', id: 1 }).readUInt16BE(2), 0x0100)
    assert.equal(encode({ domain: 'a.com', id: 1, rd: false }).readUInt16BE(2), 0x0000)
  })

  test('QTYPE is the only difference between an A and an AAAA query', () => {
    const a = encode({ domain: 'github.com', type: 'A', id: 0x1a2b })
    const aaaa = encode({ domain: 'github.com', type: 'AAAA', id: 0x1a2b })
    assert.equal(a.length, aaaa.length)
    const diffs = [...a].map((b, i) => (b === aaaa[i] ? null : i)).filter((i) => i !== null)
    assert.deepEqual(diffs, [25], 'exactly one byte differs — this is the demo edit')
    assert.equal(a[25], 0x01)
    assert.equal(aaaa[25], 0x1c)
  })

  test('rejects malformed input rather than emitting a broken packet', () => {
    assert.throws(() => encode({}), /domain is required/)
    assert.throws(() => encode({ domain: 'a.com', type: 'NOPE' }), /unknown record type/)
    assert.throws(() => encode({ domain: 'a..com' }), /empty label/)
    assert.throws(() => encode({ domain: 'x'.repeat(64) + '.com' }), /exceeds 63/)
  })

  test('a random id is used when none is given', () => {
    const ids = new Set(Array.from({ length: 24 }, () => encode({ domain: 'a.com' }).readUInt16BE(0)))
    assert.ok(ids.size > 12, 'ids must be unpredictable — this is what blocks spoofing')
  })
})

describe('dns · decode a real A response', () => {
  const msg = decode(fixture('dns-a-github.resp.hex'))

  test('header flags are read bit by bit', () => {
    assert.equal(msg.header.id, 0x1a2b)
    assert.equal(msg.header.qr, 1, 'this is a response')
    assert.equal(msg.header.rd, 1)
    assert.equal(msg.header.ra, 1, 'the resolver did the recursion')
    assert.equal(msg.header.rcode, 0)
    assert.equal(msg.header.qdcount, 1)
    assert.equal(msg.header.ancount, 1)
  })

  test('the question is echoed back', () => {
    assert.equal(msg.question.name, 'github.com')
    assert.equal(msg.question.typeName, 'A')
  })

  test('the answer is a dotted IPv4 address', () => {
    assert.equal(msg.answers.length, 1)
    assert.equal(msg.answers[0].typeName, 'A')
    assert.match(msg.answers[0].value, /^\d+\.\d+\.\d+\.\d+$/)
    assert.equal(msg.answers[0].rdlength, 4)
  })

  test('every tree leaf carries a span that lands inside the packet', () => {
    const bytes = fixture('dns-a-github.resp.hex')
    const leaves = msg.tree.flatMap((n) => n.children ?? [])
    assert.ok(leaves.length > 15)
    for (const leaf of leaves) {
      const [off, len] = leaf.span
      assert.ok(off >= 0 && off + len <= bytes.length,
        `${leaf.name} span [${off},${len}] falls outside a ${bytes.length}-byte packet`)
    }
  })

  test('flag leaves point at one byte and a bit range inside it', () => {
    const header = msg.tree.find((n) => n.name === 'Header')
    const rd = header.children.find((c) => c.name === 'RD')
    assert.deepEqual(rd.span, [2, 1])
    assert.deepEqual(rd.bits, [7, 1], 'RD is the last bit of the first flags byte')

    const bytes = fixture('dns-a-github.resp.hex')
    assert.equal(bitsOf(bytes[rd.span[0]], rd.bits[0], rd.bits[1]), 1)
  })

  test('explanations reach the fields a beginner will hover', () => {
    const header = msg.tree.find((n) => n.name === 'Header')
    assert.match(header.children.find((c) => c.name === 'ID').explain, /forg|thrown away/i)
    const q = msg.tree.find((n) => n.name === 'Question')
    assert.ok(q.children.find((c) => c.name === 'QTYPE').editHint)
  })
})

describe('dns · name compression (0xC0 pointers)', () => {
  test('the answer name is a two-byte pointer, not a repeated name', () => {
    const bytes = fixture('dns-a-github.resp.hex')
    // The answer section starts right after the 28-byte question echo.
    assert.equal(bytes[28], 0xc0, 'top two bits set marks a pointer')
    assert.equal(bytes[29], 0x0c, 'pointing at offset 12 — the name in the question')

    const { name, consumed, compressed } = decodeName(new Reader(bytes, 28))
    assert.equal(name, 'github.com')
    assert.equal(consumed, 2, 'a pointer costs two bytes even though the name is ten')
    assert.equal(compressed, true)
  })

  test('every real response with records uses compression', () => {
    for (const f of ['dns-a-github', 'dns-aaaa-google', 'dns-cname-www', 'dns-mx-gmail', 'dns-ns-github']) {
      const msg = decode(fixture(`${f}.resp.hex`))
      assert.ok(msg.answers.length > 0, `${f} should have answers`)
      assert.equal(msg.truncatedParse, undefined, `${f} parsed cleanly`)
    }
  })

  test('a pointer loop is refused instead of hanging', () => {
    // 0xC0 0x0C at offset 12 points at itself.
    const evil = Buffer.concat([Buffer.alloc(12), Buffer.from([0xc0, 0x0c])])
    assert.throws(() => decodeName(new Reader(evil, 12)), /loop/)
  })

  test('a pointer past the end of the packet is refused', () => {
    const evil = Buffer.concat([Buffer.alloc(12), Buffer.from([0xc0, 0xff])])
    assert.throws(() => decodeName(new Reader(evil, 12)), /past end|truncated/)
  })
})

describe('dns · record types', () => {
  test('AAAA renders compressed IPv6', () => {
    const msg = decode(fixture('dns-aaaa-google.resp.hex'))
    const aaaa = msg.answers.find((a) => a.typeName === 'AAAA')
    assert.ok(aaaa, 'expected an AAAA record')
    assert.equal(aaaa.rdlength, 16)
    assert.match(aaaa.value, /^[0-9a-f:]+$/)
    assert.match(aaaa.value, /::/, 'zero groups collapse to ::')
  })

  test('CNAME resolves through the pointer to a real name', () => {
    const msg = decode(fixture('dns-cname-www.resp.hex'))
    const cname = msg.answers.find((a) => a.typeName === 'CNAME')
    assert.equal(cname.value, 'github.com')
  })

  test('MX keeps its preference number', () => {
    const msg = decode(fixture('dns-mx-gmail.resp.hex'))
    assert.ok(msg.answers.length >= 2)
    for (const a of msg.answers) {
      assert.equal(a.typeName, 'MX')
      assert.match(a.value, /^\d+ \S+/, 'MX is "<preference> <hostname>"')
    }
  })

  test('NS returns the nameservers that own the zone', () => {
    const msg = decode(fixture('dns-ns-github.resp.hex'))
    assert.ok(msg.answers.length >= 2)
    assert.ok(msg.answers.every((a) => a.typeName === 'NS'))
  })

  test('NXDOMAIN is rcode 3 with no answers and an SOA in authority', () => {
    const msg = decode(fixture('dns-nxdomain.resp.hex'))
    assert.equal(msg.header.rcode, 3)
    assert.equal(rcodeName(msg.header.rcode), 'NXDOMAIN')
    assert.equal(msg.answers.length, 0)
    assert.ok(msg.authority.length >= 1, 'the server points at who is authoritative')
  })

  test('a name that exists with no record of that type is rcode 0 with zero answers', () => {
    const msg = decode(fixture('dns-txt-google.resp.hex'))
    assert.equal(msg.header.rcode, 0, 'not an error — the name is fine')
    assert.equal(msg.answers.length, 0, 'there is just nothing of this type')
  })
})

describe('dns · round trip', () => {
  test('decode(encode(q)) recovers the question for every type', () => {
    for (const type of ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV']) {
      const buf = encode({ domain: 'example.com', type, id: 0x4242 })
      const msg = decode(buf)
      assert.equal(msg.header.id, 0x4242)
      assert.equal(msg.header.qr, 0)
      assert.equal(msg.question.name, 'example.com')
      assert.equal(msg.question.typeName, type)
      assert.equal(msg.header.ancount, 0)
    }
  })

  test('subdomains and single labels survive the round trip', () => {
    for (const domain of ['a.b.c.d.example.com', 'localhost', 'xn--80ak6aa92e.com']) {
      assert.equal(decode(encode({ domain, id: 1 })).question.name, domain)
    }
  })

  test('type tables agree in both directions', () => {
    for (const [name, num] of Object.entries(TYPES)) {
      if (name === 'ANY') continue
      assert.equal(typeNumber(name), num)
      assert.equal(typeName(num), name)
    }
  })
})

describe('dns · malformed packets are parsed as far as possible', () => {
  // The byte editor exists to create broken packets. Decode must degrade, not throw.
  test('a truncated packet reports where it stopped and still returns a header', () => {
    const full = fixture('dns-a-github.resp.hex')
    const msg = decode(full.subarray(0, 30))
    assert.equal(msg.header.id, 0x1a2b)
    assert.ok(msg.truncatedParse, 'it says why parsing stopped')
    assert.ok(msg.tree.length >= 1, 'the header tree still renders')
  })

  test('anything under 12 bytes is rejected outright', () => {
    assert.throws(() => decode(Buffer.alloc(11)), /at least 12 bytes/)
  })

  test('a bogus label length is reported, not silently accepted', () => {
    //          header (qdcount=1) ────────────┐ then 0x80: top bit set but not 0xC0,
    //                                          so it is neither a label length nor a pointer
    const msg = decode(hexToBytes('1a2b01000001000000000000' + '80' + '00'.repeat(8)))
    assert.ok(msg.truncatedParse, 'a 0x80 length byte is neither a label nor a pointer')
  })
})

describe('dns · presentation', () => {
  test('formatAnswers produces dig-style lines', () => {
    const lines = formatAnswers(decode(fixture('dns-a-github.resp.hex')))
    assert.equal(lines.length, 1)
    assert.match(lines[0], /^github\.com\.\t\d+\tIN\tA\t\d+\.\d+\.\d+\.\d+$/)
  })
})
