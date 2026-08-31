/**
 * sim-algo.test.js — the Data Link labs are arithmetic, so they are testable.
 *
 * The whole claim of the bit labs is that detection is real: flip a bit and
 * CRC genuinely fails, flip two in the wrong place and it genuinely does not.
 * If these were animations that claim would be a lie, so they are pure
 * functions and this file holds them to it.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  toBits, toStr, flip,
  crcDivide, crcEncode, crcCheck,
  hammingParityCount, hammingEncode, hammingCheck,
  bitStuff, bitUnstuff, frameWith, FLAG,
  parityBit, parity2d, parity2dCheck,
} from '../web/js/sim/algo.js'

describe('CRC', () => {
  // The worked example every textbook uses, so the lab agrees with the book.
  const data = toBits('11010011101100')
  const poly = toBits('1011')

  test('encodes to a codeword that divides cleanly', () => {
    const { codeword, remainder } = crcEncode(data, poly)
    assert.equal(remainder.length, poly.length - 1)
    assert.equal(toStr(codeword.slice(0, data.length)), toStr(data))
    assert.ok(crcCheck(codeword, poly).ok, 'a fresh codeword must pass')
  })

  test('catches every single-bit error', () => {
    const { codeword } = crcEncode(data, poly)
    for (let i = 0; i < codeword.length; i++) {
      assert.equal(crcCheck(flip(codeword, i), poly).ok, false, `bit ${i} slipped through`)
    }
  })

  test('records one division row per shift, for stepping through', () => {
    const { steps, padded } = crcEncode(data, poly)
    assert.equal(steps.length, padded.length - poly.length + 1)
    assert.ok(steps.some((s) => s.xored), 'some rows XOR')
    assert.ok(steps.some((s) => !s.xored), 'some rows skip on a leading zero')
  })

  test('a zero remainder is not luck — damage usually survives as non-zero', () => {
    const { codeword } = crcEncode(data, poly)
    const broken = flip(flip(codeword, 2), 5)
    const { remainder, ok } = crcCheck(broken, poly)
    assert.equal(ok, remainder.every((b) => b === 0))
  })
})

describe('Hamming', () => {
  test('sizes the parity bits by the 2^r >= m + r + 1 rule', () => {
    assert.equal(hammingParityCount(4), 3)
    assert.equal(hammingParityCount(8), 4)
    assert.equal(hammingParityCount(11), 4)
    assert.equal(hammingParityCount(12), 5)
  })

  test('parity bits land on the powers of two', () => {
    const { parityAt } = hammingEncode(toBits('1011'))
    assert.deepEqual(parityAt, [1, 2, 4])
  })

  test('a clean codeword has syndrome zero', () => {
    const { code } = hammingEncode(toBits('1011'))
    assert.equal(hammingCheck(code).syndrome, 0)
    assert.equal(hammingCheck(code).errorAt, null)
  })

  test('the syndrome names the broken position, and correction restores it', () => {
    const { code } = hammingEncode(toBits('1011'))
    for (let pos = 1; pos <= code.length; pos++) {
      const damaged = flip(code, pos - 1)
      const { errorAt, corrected } = hammingCheck(damaged)
      assert.equal(errorAt, pos, `position ${pos} was mislocated`)
      assert.deepEqual(corrected, code, `position ${pos} was not repaired`)
    }
  })

  test('honest limit: two errors are detected but mis-corrected', () => {
    const { code } = hammingEncode(toBits('1011'))
    const damaged = flip(flip(code, 0), 3)
    const { errorAt, corrected } = hammingCheck(damaged)
    assert.notEqual(errorAt, null, 'it still says something is wrong')
    assert.notDeepEqual(corrected, code, 'but the repair is wrong — this is the lesson')
  })
})

describe('bit stuffing', () => {
  test('breaks every run of five ones', () => {
    const { stuffed } = bitStuff(toBits('01111110'))
    assert.equal(toStr(stuffed), '011111010')
  })

  test('leaves data with no long run untouched', () => {
    const bits = toBits('0101101101')
    assert.equal(toStr(bitStuff(bits).stuffed), toStr(bits))
  })

  test('unstuffing is an exact inverse', () => {
    for (const s of ['01111110', '111110111110', '1111111111', '0', '11111']) {
      const bits = toBits(s)
      const { stuffed } = bitStuff(bits)
      assert.equal(toStr(bitUnstuff(stuffed).unstuffed), toStr(bits), s)
    }
  })

  test('the stuffed payload can never contain the flag', () => {
    const flag = toStr(FLAG)
    for (const s of ['01111110', '0111111011111100', '1111110111111']) {
      const { stuffed } = bitStuff(toBits(s))
      assert.equal(toStr(stuffed).includes(flag), false, `flag survived in ${s}`)
    }
  })

  test('the frame carries a flag at each end', () => {
    const framed = frameWith(bitStuff(toBits('1111110')).stuffed)
    assert.equal(toStr(framed.slice(0, 8)), toStr(FLAG))
    assert.equal(toStr(framed.slice(-8)), toStr(FLAG))
  })
})

describe('parity', () => {
  test('even parity makes the count of ones even', () => {
    assert.equal(parityBit(toBits('1011'), 'even'), 1)
    assert.equal(parityBit(toBits('1010'), 'even'), 0)
    assert.equal(parityBit(toBits('1010'), 'odd'), 1)
  })

  test('2-D parity pins a single error to one row and one column', () => {
    const rows = [toBits('1011'), toBits('0110'), toBits('1110')]
    const { rowParity, colParity } = parity2d(rows)

    const damaged = rows.map((r) => r.slice())
    damaged[1][2] ^= 1

    const found = parity2dCheck(damaged, rowParity, colParity)
    assert.equal(found.locatable, true)
    assert.deepEqual(found.at, [1, 2])
  })

  test('honest limit: four errors in a rectangle are invisible', () => {
    const rows = [toBits('1011'), toBits('0110'), toBits('1110')]
    const { rowParity, colParity } = parity2d(rows)

    const damaged = rows.map((r) => r.slice())
    for (const [r, c] of [[0, 0], [0, 2], [1, 0], [1, 2]]) damaged[r][c] ^= 1

    const found = parity2dCheck(damaged, rowParity, colParity)
    assert.deepEqual(found.badRows, [])
    assert.deepEqual(found.badCols, [])
  })
})
