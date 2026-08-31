/**
 * algo.js — the pure bit-level algorithms the Data Link labs run on.
 *
 * These are the same shape as src/proto/*.js: no DOM, no timers, no state.
 * A widget renders what they return; a test in test/sim-algo.test.js runs them
 * offline. That split is what makes "flip a bit and watch CRC catch it" a
 * demonstration rather than an animation — the detection is real arithmetic,
 * not a scripted outcome.
 *
 * Bits are arrays of 0 and 1 throughout. Strings are only for the UI edges.
 */

// ── bit helpers ────────────────────────────────────────────────────────────

export const toBits = (s) => String(s).replace(/[^01]/g, '').split('').map(Number)
export const toStr = (bits) => bits.join('')

/** Flip one bit. Returns a copy — the caller keeps the original to compare. */
export function flip(bits, index) {
  const out = bits.slice()
  if (index >= 0 && index < out.length) out[index] ^= 1
  return out
}

// ── CRC ────────────────────────────────────────────────────────────────────
//
// Long division in GF(2): no carries, no borrows, subtraction is XOR. That is
// the whole trick, and it is why a shift register can do it in hardware.

/**
 * Divide `bits` by `poly`, recording every row so the UI can step through it.
 * @returns {{remainder: number[], steps: Array<{at:number, xored:boolean, row:number[]}>}}
 */
export function crcDivide(bits, poly) {
  const n = poly.length
  const acc = bits.slice()
  const steps = []

  for (let i = 0; i + n <= acc.length; i++) {
    // A leading zero means this position contributes nothing; skip it, but
    // record the skip so the learner sees why the division moved on.
    const xored = acc[i] === 1
    if (xored) for (let j = 0; j < n; j++) acc[i + j] ^= poly[j]
    steps.push({ at: i, xored, row: acc.slice() })
  }

  return { remainder: acc.slice(acc.length - (n - 1)), steps }
}

/** Append the check bits. The result is always exactly divisible by the poly. */
export function crcEncode(data, poly) {
  const padded = data.concat(new Array(poly.length - 1).fill(0))
  const { remainder, steps } = crcDivide(padded, poly)
  return { codeword: data.concat(remainder), remainder, steps, padded }
}

/** The receiver's side: divide again, and a non-zero remainder means damage. */
export function crcCheck(codeword, poly) {
  const { remainder, steps } = crcDivide(codeword, poly)
  return { remainder, steps, ok: remainder.every((b) => b === 0) }
}

// ── Hamming ────────────────────────────────────────────────────────────────
//
// Parity bits sit at the powers of two. Each covers exactly the positions
// whose index has that bit set, so the failing parities, read as a binary
// number, spell out the position that is wrong. Nothing is looked up.

const isPow2 = (n) => (n & (n - 1)) === 0

/** How many parity bits m data bits need: the smallest r with 2^r >= m+r+1. */
export function hammingParityCount(m) {
  let r = 0
  while (2 ** r < m + r + 1) r++
  return r
}

/**
 * @returns {{code: number[], parityAt: number[], covers: Object<number, number[]>}}
 *          `code` is 0-indexed for rendering; positions in `parityAt`/`covers`
 *          are the 1-based ones the algorithm actually reasons about.
 */
export function hammingEncode(data) {
  const m = data.length
  const r = hammingParityCount(m)
  const total = m + r

  const code = new Array(total).fill(0)
  const parityAt = []

  // Lay the data into every position that is not a power of two.
  let d = 0
  for (let pos = 1; pos <= total; pos++) {
    if (isPow2(pos)) parityAt.push(pos)
    else code[pos - 1] = data[d++]
  }

  const covers = {}
  for (const p of parityAt) {
    const members = []
    for (let pos = 1; pos <= total; pos++) if (pos !== p && (pos & p)) members.push(pos)
    covers[p] = members
    // Even parity: the parity bit is whatever makes its group sum to zero.
    code[p - 1] = members.reduce((acc, pos) => acc ^ code[pos - 1], 0)
  }

  return { code, parityAt, covers, r }
}

/**
 * The receiver recomputes each parity. The syndrome IS the broken position.
 * @returns {{syndrome:number, errorAt:number|null, corrected:number[], failed:number[]}}
 */
export function hammingCheck(code) {
  const total = code.length
  const failed = []
  let syndrome = 0

  for (let p = 1; p <= total; p <<= 1) {
    let sum = 0
    for (let pos = 1; pos <= total; pos++) if (pos & p) sum ^= code[pos - 1]
    if (sum !== 0) { syndrome += p; failed.push(p) }
  }

  const errorAt = syndrome > 0 && syndrome <= total ? syndrome : null
  const corrected = code.slice()
  if (errorAt) corrected[errorAt - 1] ^= 1

  return { syndrome, errorAt, corrected, failed }
}

// ── bit stuffing ───────────────────────────────────────────────────────────
//
// The frame delimiter is 01111110. If the payload contains six ones the
// receiver would end the frame early, so the sender breaks up every run of
// five by inserting a zero — and the receiver removes it without being told.

export const FLAG = toBits('01111110')

export function bitStuff(bits, run = 5) {
  const out = []
  const inserted = []
  let ones = 0

  for (const b of bits) {
    out.push(b)
    if (b === 1) {
      ones++
      if (ones === run) { inserted.push(out.length); out.push(0); ones = 0 }
    } else ones = 0
  }

  return { stuffed: out, inserted }
}

export function bitUnstuff(bits, run = 5) {
  const out = []
  const removed = []
  let ones = 0

  for (let i = 0; i < bits.length; i++) {
    const b = bits[i]
    if (ones === run && b === 0) { removed.push(i); ones = 0; continue }
    out.push(b)
    ones = b === 1 ? ones + 1 : 0
  }

  return { unstuffed: out, removed }
}

/** What actually goes on the wire, flags and all. */
export const frameWith = (bits) => FLAG.concat(bits, FLAG)

// ── parity ─────────────────────────────────────────────────────────────────

export const parityBit = (bits, kind = 'even') => {
  const ones = bits.reduce((n, b) => n + b, 0)
  return kind === 'even' ? ones % 2 : 1 - (ones % 2)
}

/**
 * Two-dimensional parity: a bit per row, a bit per column, and one corner.
 * Two errors in the same row are caught; two in a rectangle are not — which
 * is the point of showing it next to CRC.
 */
export function parity2d(rows, kind = 'even') {
  const width = rows[0]?.length ?? 0
  const rowParity = rows.map((r) => parityBit(r, kind))
  const colParity = []
  for (let c = 0; c < width; c++) {
    colParity.push(parityBit(rows.map((r) => r[c]), kind))
  }
  return { rowParity, colParity, corner: parityBit(colParity, kind) }
}

/** Where a 2-D block went wrong: one failing row and one failing column. */
export function parity2dCheck(rows, rowParity, colParity, kind = 'even') {
  const badRows = []
  const badCols = []
  rows.forEach((r, i) => { if (parityBit(r, kind) !== rowParity[i]) badRows.push(i) })
  const width = rows[0]?.length ?? 0
  for (let c = 0; c < width; c++) {
    if (parityBit(rows.map((r) => r[c]), kind) !== colParity[c]) badCols.push(c)
  }
  return {
    badRows,
    badCols,
    // One row and one column crossing means the exact bit is known.
    locatable: badRows.length === 1 && badCols.length === 1,
    at: badRows.length === 1 && badCols.length === 1 ? [badRows[0], badCols[0]] : null,
  }
}
