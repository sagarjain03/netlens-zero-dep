/**
 * bytes.js — byte and bit primitives. Layer 0: no I/O, no imports beyond Buffer.
 *
 * Everything in netlens ultimately comes down to "read N bits at offset X and
 * remember where they were". The Reader/Writer pair below is what the DNS, TLS
 * and X.509 parsers are built from, and the `span` it records is what lets the
 * field tree, the hex view and the bit ruler stay in sync.
 */

// ── hex ─────────────────────────────────────────────────────────────────────

export function hexToBytes(hex) {
  const clean = String(hex).replace(/[\s:]/g, '')
  if (clean.length % 2 !== 0) throw new Error(`hex string has odd length (${clean.length})`)
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('hex string contains non-hex characters')
  return Buffer.from(clean, 'hex')
}

export const bytesToHex = (buf) => Buffer.from(buf).toString('hex')

/** "1a 2b 01 00" — for terminal output and error messages. */
export const hexSpaced = (buf) => (bytesToHex(buf).match(/../g) ?? []).join(' ')

// ── spans ───────────────────────────────────────────────────────────────────

/**
 * A span is [byteOffset, byteLength]. Optional bits are [bitOffset, bitLength]
 * *within the first byte of the span*, so a single flag highlights one byte in
 * the hex view and a few bits in the bit ruler.
 */
export const span = (offset, length) => [offset, length]

/** Extract `len` bits starting at `at` (MSB-first) from a single byte. */
export function bitsOf(byte, at, len) {
  return (byte >> (8 - at - len)) & ((1 << len) - 1)
}

/** "0100 0001" — how the bit ruler renders a byte. */
export const toBits = (byte) =>
  byte.toString(2).padStart(8, '0').replace(/(.{4})(.{4})/, '$1 $2')

// ── Reader ──────────────────────────────────────────────────────────────────

/**
 * Cursor-based reader. Every read advances `offset`, and `mark()`/`since()`
 * turn a read sequence into a span without any manual arithmetic.
 */
export class Reader {
  constructor(buf, offset = 0) {
    this.buf = Buffer.from(buf)
    this.offset = offset
    this._mark = offset
  }

  get length() { return this.buf.length }
  get remaining() { return this.buf.length - this.offset }

  mark() { this._mark = this.offset; return this }
  /** Span covering everything read since the last mark(). */
  since() { return [this._mark, this.offset - this._mark] }

  _need(n) {
    if (this.offset + n > this.buf.length) {
      throw new RangeError(
        `truncated: need ${n} byte(s) at offset ${this.offset}, only ${this.remaining} left`,
      )
    }
  }

  u8() { this._need(1); return this.buf[this.offset++] }

  u16() { this._need(2); const v = this.buf.readUInt16BE(this.offset); this.offset += 2; return v }

  u32() { this._need(4); const v = this.buf.readUInt32BE(this.offset); this.offset += 4; return v }

  bytes(n) { this._need(n); const b = this.buf.subarray(this.offset, this.offset + n); this.offset += n; return b }

  peek(n = 1) { return this.buf.subarray(this.offset, this.offset + n) }

  skip(n) { this._need(n); this.offset += n; return this }

  at(offset) { return new Reader(this.buf, offset) }
}

// ── Writer ──────────────────────────────────────────────────────────────────

/** Growable byte builder. `mark()`/`since()` mirror Reader so encoders can record spans too. */
export class Writer {
  constructor(capacity = 512) {
    this.buf = Buffer.alloc(capacity)
    this.offset = 0
    this._mark = 0
  }

  mark() { this._mark = this.offset; return this }
  since() { return [this._mark, this.offset - this._mark] }

  _grow(n) {
    if (this.offset + n <= this.buf.length) return
    let size = this.buf.length * 2
    while (size < this.offset + n) size *= 2
    const next = Buffer.alloc(size)
    this.buf.copy(next, 0, 0, this.offset)
    this.buf = next
  }

  u8(v) { this._grow(1); this.buf.writeUInt8(v & 0xff, this.offset); this.offset += 1; return this }

  u16(v) { this._grow(2); this.buf.writeUInt16BE(v & 0xffff, this.offset); this.offset += 2; return this }

  u32(v) { this._grow(4); this.buf.writeUInt32BE(v >>> 0, this.offset); this.offset += 4; return this }

  bytes(b) {
    const src = Buffer.from(b)
    this._grow(src.length)
    src.copy(this.buf, this.offset)
    this.offset += src.length
    return this
  }

  ascii(s) { return this.bytes(Buffer.from(s, 'ascii')) }

  /** The finished message. */
  done() { return this.buf.subarray(0, this.offset) }
}

// ── misc ────────────────────────────────────────────────────────────────────

/** Printable-ASCII gutter for the hex view; non-printables become '.'. */
export const asciiGutter = (buf) =>
  Array.from(buf, (b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')).join('')

export const u16hex = (v) => `0x${v.toString(16).padStart(4, '0')}`
export const u8hex = (v) => `0x${v.toString(16).padStart(2, '0')}`
