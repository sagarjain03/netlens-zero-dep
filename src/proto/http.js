/**
 * http.js — an HTTP/1.1 codec, written by hand.
 * Replaces: axios (55M weekly), node-fetch (60M), got, http-parser-js, request.
 *
 * LAYER 0: pure. Bytes in, structure out. No sockets, and deliberately no
 * decompression either — that needs node:zlib and belongs one layer up, so this
 * file stays testable against captured bytes alone.
 *
 * ── The thing worth noticing ────────────────────────────────────────────────
 *
 * After DNS, after routing, after a TLS handshake with elliptic-curve key
 * exchange — the actual request is a few lines of ASCII you could type by hand:
 *
 *     GET / HTTP/1.1\r\n
 *     Host: example.com\r\n
 *     \r\n
 *
 * That blank line is the whole framing rule. Everything before it is headers,
 * everything after is body, and the protocol that carries most of the internet
 * fits in that sentence.
 */
import { Reader } from '../shared/bytes.js'

const CRLF = '\r\n'
const MAX_HEADERS = 100
const MAX_HEADER_BYTES = 64 * 1024

export const STATUS_TEXT = {
  200: 'OK', 201: 'Created', 204: 'No Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 308: 'Permanent Redirect',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  405: 'Method Not Allowed', 429: 'Too Many Requests',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
}

/** What a status code means for a learner, in one line. */
export const STATUS_MEANING = {
  2: 'Success — the server did what you asked.',
  3: 'Redirect — what you wanted lives somewhere else, and the Location header says where.',
  4: 'Your fault — the request was wrong, or you are not allowed.',
  5: 'The server\'s fault — it broke while trying.',
}

export const statusClass = (code) => Math.floor(code / 100)

// ── request ─────────────────────────────────────────────────────────────────

/**
 * Build a request. The result is ASCII you can read.
 *
 * @param {object} opts
 * @param {string} opts.host
 * @param {string} [opts.path='/']
 * @param {string} [opts.method='GET']
 * @param {Record<string,string>} [opts.headers]
 * @param {boolean} [opts.keepAlive=false]
 * @returns {Buffer}
 */
export function buildRequest({
  host,
  path = '/',
  method = 'GET',
  headers = {},
  keepAlive = false,
  version = 'HTTP/1.1',
} = {}) {
  if (!host) throw new Error('host is required')

  const lines = [`${method.toUpperCase()} ${path} ${version}`]

  // Host is mandatory in 1.1 and is what lets one server hold many sites — the
  // same job SNI does one layer down.
  const merged = {
    Host: host,
    'User-Agent': 'netlens/1.0',
    Accept: '*/*',
    'Accept-Encoding': 'identity',   // no compression: the body stays readable
    Connection: keepAlive ? 'keep-alive' : 'close',
    ...headers,
  }

  for (const [name, value] of Object.entries(merged)) {
    if (value == null) continue
    assertHeaderSafe(name, value)
    lines.push(`${name}: ${value}`)
  }

  // The blank line is the framing. Everything after it is body.
  return Buffer.from(`${lines.join(CRLF)}${CRLF}${CRLF}`, 'ascii')
}

/**
 * A newline in a header value would let a caller inject extra headers or a body.
 * Refusing outright is the only correct answer.
 */
function assertHeaderSafe(name, value) {
  if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) {
    throw new Error(`"${name}" is not a valid header name`)
  }
  if (/[\r\n\0]/.test(String(value))) {
    throw new Error(`header "${name}" contains a line break`)
  }
}

/** Parse a request we built, so the inspector can show it as a tree. */
export function parseRequest(input) {
  const text = Buffer.from(input).toString('ascii')
  const headEnd = text.indexOf(CRLF + CRLF)
  const head = headEnd === -1 ? text : text.slice(0, headEnd)
  const lines = head.split(CRLF)

  const [method, path, version] = (lines[0] ?? '').split(/\s+/)
  const headers = []
  let offset = Buffer.byteLength(lines[0] ?? '', 'ascii') + 2

  const tree = [{
    name: 'Request Line',
    span: [0, Buffer.byteLength(lines[0] ?? '', 'ascii')],
    children: [
      leaf('Method', method ?? '', [0, (method ?? '').length],
        'What you want done. GET asks for something; nothing else about the request changes.'),
      leaf('Path', path ?? '', [(method ?? '').length + 1, (path ?? '').length],
        'Which resource, on this server.'),
      leaf('Version', version ?? '', [(method ?? '').length + (path ?? '').length + 2, (version ?? '').length],
        'HTTP/1.1 — one request at a time down one connection.'),
    ],
  }]

  const headerChildren = []
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const name = line.slice(0, idx).trim()
      const value = line.slice(idx + 1).trim()
      headers.push([name, value])
      headerChildren.push(leaf(name, value, [offset, Buffer.byteLength(line, 'ascii')],
        REQUEST_HEADER_NOTES[name.toLowerCase()]))
    }
    offset += Buffer.byteLength(line, 'ascii') + 2
  }

  if (headerChildren.length) {
    tree.push({ name: 'Headers', span: [tree[0].span[1] + 2, offset - tree[0].span[1] - 2], children: headerChildren })
  }

  tree.push({
    name: 'Blank Line',
    span: [offset, 2],
    children: [leaf('CRLF CRLF', '\\r\\n\\r\\n', [offset, 2],
      'The empty line that ends the headers. This one blank line is the entire framing rule of HTTP/1.1.')],
  })

  return { method, path, version, headers, tree }
}

const REQUEST_HEADER_NOTES = {
  host: 'Which site you want. One server can hold thousands, and this is how it tells them apart — the same job SNI does one layer down in the TLS handshake.',
  connection: '"close" means hang up after the reply. "keep-alive" holds the socket open, so the next request skips DNS, TCP and TLS entirely.',
  'accept-encoding': 'Which compressions you can handle. We ask for "identity" — none — so the body arrives readable.',
  'user-agent': 'Who is asking. Servers routinely change their answer based on this.',
}

// ── response ────────────────────────────────────────────────────────────────

/**
 * Parse a response.
 *
 * @returns {{status, reason, version, headers, headerMap, body, bodyOffset,
 *            chunked, chunks, contentLength, encoding, tree, truncatedParse?}}
 */
export function parseResponse(input) {
  const buf = Buffer.from(input)
  const headEnd = indexOfHeadEnd(buf)

  if (headEnd === -1) {
    return { status: null, headers: [], headerMap: {}, body: Buffer.alloc(0), tree: [],
      truncatedParse: 'no blank line found — the headers never ended' }
  }
  if (headEnd > MAX_HEADER_BYTES) {
    return { status: null, headers: [], headerMap: {}, body: Buffer.alloc(0), tree: [],
      truncatedParse: `header block of ${headEnd} bytes is unreasonable` }
  }

  const head = buf.subarray(0, headEnd).toString('ascii')
  const lines = unfold(head.split(CRLF))

  const statusLine = lines[0] ?? ''
  const m = /^(HTTP\/[\d.]+)\s+(\d{3})\s*(.*)$/.exec(statusLine)
  const version = m?.[1] ?? null
  const status = m ? Number(m[2]) : null
  const reason = m?.[3]?.trim() || (status ? STATUS_TEXT[status] ?? '' : '')

  const headers = []
  const headerMap = {}
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const name = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    headers.push([name, value])
    headerMap[name.toLowerCase()] = value
  }

  const bodyOffset = headEnd + 4
  const raw = buf.subarray(bodyOffset)
  const chunked = /chunked/i.test(headerMap['transfer-encoding'] ?? '')
  const contentLength = headerMap['content-length'] != null ? Number(headerMap['content-length']) : null

  let body = raw
  let chunks = null
  let truncatedParse

  if (chunked) {
    try {
      const decoded = decodeChunked(raw)
      body = decoded.body
      chunks = decoded.chunks
      if (!decoded.complete) truncatedParse = 'the chunked body ended before its terminating 0-length chunk'
    } catch (err) {
      truncatedParse = err.message
    }
  } else if (contentLength != null && raw.length > contentLength) {
    body = raw.subarray(0, contentLength)
  }

  return {
    version, status, reason, statusLine,
    headers, headerMap,
    body, bodyOffset,
    chunked, chunks, contentLength,
    encoding: headerMap['content-encoding'] ?? null,
    contentType: headerMap['content-type'] ?? null,
    tree: buildResponseTree({ buf, lines, headEnd, bodyOffset, headers, status, reason, version, chunked, chunks, body }),
    ...(truncatedParse ? { truncatedParse } : {}),
  }
}

/** The end of the head is the first CRLF CRLF. */
function indexOfHeadEnd(buf) {
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i
  }
  return -1
}

/**
 * A header line starting with whitespace continues the previous one. It is
 * obsolete and discouraged, and servers still emit it.
 */
function unfold(lines) {
  const out = []
  for (const line of lines) {
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += ' ' + line.trim()
    else out.push(line)
  }
  return out.slice(0, MAX_HEADERS)
}

/**
 * Chunked transfer encoding.
 *
 *   1a7\r\n  <423 bytes>  \r\n
 *   0\r\n\r\n
 *
 * The server used this because it did not know the total size when it started
 * replying — it is streaming, and each chunk announces its own length.
 */
export function decodeChunked(raw) {
  const parts = []
  const chunks = []
  let o = 0
  let complete = false

  while (o < raw.length) {
    const lineEnd = findCRLF(raw, o)
    if (lineEnd === -1) throw new Error(`chunk header at offset ${o} has no line ending`)

    const header = raw.subarray(o, lineEnd).toString('ascii')
    // A chunk header may carry extensions after a semicolon; the size is first.
    const size = Number.parseInt(header.split(';')[0].trim(), 16)
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`"${header.trim()}" is not a chunk length`)
    }

    const start = lineEnd + 2
    chunks.push({ size, headerOffset: o, dataOffset: start })

    if (size === 0) { complete = true; break }
    if (start + size > raw.length) throw new Error(`chunk of ${size} bytes runs past the end of the body`)

    parts.push(raw.subarray(start, start + size))
    o = start + size + 2      // skip the CRLF that follows the data
  }

  return { body: Buffer.concat(parts), chunks, complete }
}

function findCRLF(buf, from) {
  for (let i = from; i + 1 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10) return i
  }
  return -1
}

// ── tree ────────────────────────────────────────────────────────────────────

function buildResponseTree({ buf, lines, headEnd, bodyOffset, headers, status, reason, version, chunked, chunks, body }) {
  const tree = []
  const statusBytes = Buffer.byteLength(lines[0] ?? '', 'ascii')

  const cls = status ? statusClass(status) : null
  tree.push({
    name: 'Status Line',
    span: [0, statusBytes],
    children: [
      leaf('Version', version ?? '', [0, (version ?? '').length], null),
      leaf('Status', String(status ?? '?'), [(version ?? '').length + 1, 3],
        cls ? STATUS_MEANING[cls] : null),
      leaf('Reason', reason ?? '', [(version ?? '').length + 5, (reason ?? '').length],
        'Human-readable, and entirely advisory. Only the number matters.'),
    ],
  })

  let offset = statusBytes + 2
  const headerChildren = []
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const name = line.slice(0, idx).trim()
      headerChildren.push(leaf(name, line.slice(idx + 1).trim(),
        [offset, Buffer.byteLength(line, 'ascii')], RESPONSE_HEADER_NOTES[name.toLowerCase()]))
    }
    offset += Buffer.byteLength(line, 'ascii') + 2
  }
  if (headerChildren.length) {
    tree.push({ name: 'Headers', span: [statusBytes + 2, headEnd - statusBytes - 2], children: headerChildren })
  }

  tree.push({
    name: 'Blank Line',
    span: [headEnd, 4],
    children: [leaf('CRLF CRLF', '\\r\\n\\r\\n', [headEnd, 4],
      'The headers end here. Everything after this is body.')],
  })

  if (buf.length > bodyOffset) {
    const bodyChildren = []
    if (chunked && chunks) {
      for (const [i, c] of chunks.entries()) {
        bodyChildren.push(leaf(
          c.size === 0 ? 'Final chunk' : `Chunk ${i + 1}`,
          c.size === 0 ? '0 — end of body' : `${c.size} bytes`,
          [bodyOffset + c.headerOffset, Math.min(8, buf.length - bodyOffset - c.headerOffset)],
          c.size === 0
            ? 'A zero-length chunk means the body is finished.'
            : 'Each chunk states its own length in hex. The server used this because it did not know the total size when it began replying.',
        ))
      }
    }
    tree.push({
      name: chunked ? `Body · chunked · ${body.length} bytes decoded` : `Body · ${buf.length - bodyOffset} bytes`,
      span: [bodyOffset, buf.length - bodyOffset],
      children: bodyChildren.length ? bodyChildren : [
        leaf('Content', `${buf.length - bodyOffset} bytes`, [bodyOffset, buf.length - bodyOffset], null),
      ],
    })
  }

  return tree
}

const RESPONSE_HEADER_NOTES = {
  'content-length': 'Exactly how many bytes of body follow. With this, the client knows when the reply is finished.',
  'transfer-encoding': 'chunked — the server did not know the total size in advance, so it is sending the body in pieces, each announcing its own length.',
  'content-type': 'What the bytes are, and in which character set. The browser decides how to treat the body from this alone.',
  'content-encoding': 'How the body is compressed. We asked for identity, so ideally this is absent.',
  location: 'Where the thing you asked for actually lives. Only meaningful on a 3xx.',
  'set-cookie': 'The server asking your client to remember something and send it back next time.',
  'cache-control': 'How long this answer may be reused without asking again.',
  connection: '"close" means the server is hanging up. "keep-alive" means the socket stays open for the next request.',
  server: 'What software answered. Often a lie, and deliberately so.',
  etag: 'A version tag for this exact content. Send it back in If-None-Match and a server that still has the same version answers 304 with no body at all.',
}

function leaf(name, value, span, explain) {
  return { name, value, span, ...(explain ? { explain } : {}) }
}

// ── presentation ────────────────────────────────────────────────────────────

/** The head of a response as text, for the terminal. */
export function formatHead(res) {
  const lines = [res.statusLine]
  for (const [name, value] of res.headers) lines.push(`${name}: ${value}`)
  return lines.join('\n')
}

/** A body preview that never floods the terminal. */
export function previewBody(body, limit = 400) {
  const text = Buffer.from(body).toString('utf8')
  const clean = text.replace(/\r/g, '')
  return clean.length > limit ? `${clean.slice(0, limit)}\n… ${clean.length - limit} more characters` : clean
}
