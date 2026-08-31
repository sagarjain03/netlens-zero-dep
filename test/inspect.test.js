/**
 * inspect.test.js — the inspector's pure logic.
 *
 * The span lookup is what keeps the field tree, the hex grid and the bit ruler
 * describing the same thing. If it drifts, all three lie in different ways, so
 * it is worth pinning down against a real packet rather than a fixture object.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decode } from '../src/proto/dns.js'
import { hexToBytes, bytesToHex } from '../src/shared/bytes.js'
import { findLeaf, leafAtOffset, flattenLeaves } from '../web/js/inspect/tree.js'
import { hexToArray, arrayToHex, printable } from '../web/js/inspect/hex.js'
import { countChanges } from '../web/js/inspect/editor.js'

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url))
const fixture = (n) => hexToBytes(readFileSync(join(FIX, n), 'utf8').trim())

const queryBytes = fixture('dns-a-github.query.hex')
const queryHex = bytesToHex(queryBytes)
const tree = decode(queryBytes).tree

describe('inspect · hex helpers', () => {
  test('hex round-trips through the array form the editor works in', () => {
    assert.equal(arrayToHex(hexToArray(queryHex)), queryHex)
    assert.equal(hexToArray(queryHex).length, queryBytes.length)
  })

  test('bytes decode to the values the codec saw', () => {
    const arr = hexToArray(queryHex)
    assert.equal(arr[0], 0x1a)
    assert.equal(arr[1], 0x2b)
    assert.equal(arr[25], 0x01, 'QTYPE low byte — the demo edit')
  })

  test('non-printable bytes become dots, exactly as a hex dump does', () => {
    assert.equal(printable(0x41), 'A')
    assert.equal(printable(0x00), '.')
    assert.equal(printable(0x7f), '.')
    assert.equal(printable(0x20), ' ')
  })
})

describe('inspect · span lookup', () => {
  test('every leaf in a real packet is reachable by its own span', () => {
    for (const leaf of flattenLeaves(tree)) {
      assert.ok(findLeaf(tree, leaf.span, leaf.bits ?? null), `${leaf.name} should be findable`)
    }
  })

  test('a byte offset resolves to the field that contains it', () => {
    assert.equal(leafAtOffset(tree, 0).name, 'ID')
    assert.equal(leafAtOffset(tree, 1).name, 'ID', 'both bytes of a 2-byte field')
    assert.equal(leafAtOffset(tree, 12).name, 'QNAME')
    assert.equal(leafAtOffset(tree, 25).name, 'QTYPE')
    assert.equal(leafAtOffset(tree, 27).name, 'QCLASS')
  })

  test('an offset past the end of the packet resolves to nothing', () => {
    assert.equal(leafAtOffset(tree, 999), null)
    assert.equal(leafAtOffset(null, 0), null)
  })

  test('the flags byte resolves to a bit field, not the whole byte', () => {
    const owner = leafAtOffset(tree, 2)
    assert.ok(owner.bits, 'byte 2 is split into bit fields')
    assert.ok(['QR', 'Opcode', 'AA', 'TC', 'RD'].includes(owner.name))
  })

  test('every bit field in the flags byte is present and in order', () => {
    const inByte = flattenLeaves(tree)
      .filter((l) => l.bits && l.span[0] === 2)
      .sort((a, b) => a.bits[0] - b.bits[0])

    assert.deepEqual(inByte.map((l) => l.name), ['QR', 'Opcode', 'AA', 'TC', 'RD'])
    // The five fields must tile the byte exactly: 1 + 4 + 1 + 1 + 1 = 8 bits.
    assert.equal(inByte.reduce((n, l) => n + l.bits[1], 0), 8)
    let cursor = 0
    for (const l of inByte) {
      assert.equal(l.bits[0], cursor, `${l.name} starts where the previous field ended`)
      cursor += l.bits[1]
    }
  })

  test('bits are distinguished, so QR and RD are not confused', () => {
    const qr = findLeaf(tree, [2, 1], [0, 1])
    const rd = findLeaf(tree, [2, 1], [7, 1])
    assert.equal(qr.name, 'QR')
    assert.equal(rd.name, 'RD')
  })
})

describe('inspect · editor draft', () => {
  test('changing QTYPE to AAAA touches exactly one byte', () => {
    const bytes = hexToArray(queryHex)
    bytes[25] = 0x1c
    const draft = arrayToHex(bytes)
    assert.equal(countChanges(queryHex, draft), 1)
  })

  test('the edited draft really does re-decode as an IPv6 question', () => {
    const bytes = hexToArray(queryHex)
    bytes[25] = 0x1c
    const msg = decode(hexToBytes(arrayToHex(bytes)))
    assert.equal(msg.question.typeName, 'AAAA', 'this is what the live preview shows')
    assert.equal(msg.question.name, 'github.com', 'and nothing else moved')
  })

  test('breaking the transaction id changes two bytes and the parsed id', () => {
    const bytes = hexToArray(queryHex)
    bytes[0] = 0x7f
    bytes[1] = 0x3e
    const draft = arrayToHex(bytes)
    assert.equal(countChanges(queryHex, draft), 2)
    assert.equal(decode(hexToBytes(draft)).header.id, 0x7f3e)
  })

  test('an untouched draft reports no changes', () => {
    assert.equal(countChanges(queryHex, queryHex), 0)
  })

  test('a corrupted length byte still yields a tree plus a reason', () => {
    // 0x80 is neither a label length nor a compression pointer.
    const bytes = hexToArray(queryHex)
    bytes[12] = 0x80
    const msg = decode(hexToBytes(arrayToHex(bytes)))
    assert.ok(msg.truncatedParse, 'the editor shows this as the parse error')
    assert.ok(msg.tree.length >= 1, 'the header still renders while the rest is broken')
  })
})

describe('inspect · the two views agree', () => {
  test('every span in the tree lands inside the packet the hex grid draws', () => {
    const byteCount = hexToArray(queryHex).length
    for (const leaf of flattenLeaves(tree)) {
      const [off, len] = leaf.span
      assert.ok(off >= 0 && off + len <= byteCount,
        `${leaf.name} [${off},${len}] must fit in ${byteCount} bytes`)
    }
  })

  test('a bit range never points outside its own byte', () => {
    for (const leaf of flattenLeaves(tree)) {
      if (!leaf.bits) continue
      assert.equal(leaf.span[1], 1, `${leaf.name} with bits must span exactly one byte`)
      assert.ok(leaf.bits[0] + leaf.bits[1] <= 8, `${leaf.name} bits must fit in a byte`)
    }
  })

  test('a response packet is inspectable the same way as a query', () => {
    const respTree = decode(fixture('dns-a-github.resp.hex')).tree
    assert.ok(flattenLeaves(respTree).length > flattenLeaves(tree).length,
      'a response has more fields — it carries answers too')
    assert.equal(leafAtOffset(respTree, 0).name, 'ID')
  })
})
