/**
 * http.test.js — the HTTP/1.1 codec.
 *
 * The interesting cases are the ones a naive parser gets wrong: chunked bodies,
 * folded header lines, a 304 with no body at all, and a header value carrying a
 * newline that would let a caller smuggle in a request of their own.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildRequest, parseRequest, parseResponse, decodeChunked,
  statusClass, previewBody, formatHead, STATUS_MEANING,
} from '../src/proto/http.js'
import { parseUrl, decompress } from '../src/proto/http-client.js'
import { buildEnvelope } from '../src/api/http.js'

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url))
const fx = (n) => readFileSync(join(FIX, n))

// ── request ─────────────────────────────────────────────────────────────────

describe('http · the request we write', () => {
  test('is readable ASCII, ending in a blank line', () => {
    const req = buildRequest({ host: 'example.com' }).toString('ascii')
    assert.ok(req.startsWith('GET / HTTP/1.1\r\n'))
    assert.ok(req.includes('Host: example.com\r\n'))
    assert.ok(req.endsWith('\r\n\r\n'), 'the blank line is the entire framing rule')
    assert.ok(!/[^\x20-\x7e\r\n]/.test(req), 'nothing but printable ASCII')
  })

  test('asks for no compression, so the body stays readable', () => {
    assert.match(buildRequest({ host: 'a.com' }).toString(), /Accept-Encoding: identity/)
  })

  test('keep-alive is the one thing that changes Connection', () => {
    assert.match(buildRequest({ host: 'a.com' }).toString(), /Connection: close/)
    assert.match(buildRequest({ host: 'a.com', keepAlive: true }).toString(), /Connection: keep-alive/)
  })

  test('a header value containing a line break is refused', () => {
    // Otherwise a caller could append headers, or a whole second request.
    assert.throws(() => buildRequest({ host: 'a.com', headers: { 'X-Evil': 'a\r\nX-Injected: 1' } }),
      /line break/)
    assert.throws(() => buildRequest({ host: 'a.com', headers: { 'X-Evil': 'a\nb' } }), /line break/)
    assert.throws(() => buildRequest({ host: 'a.com', headers: { 'Bad Name': 'x' } }), /valid header name/)
  })

  test('a request parses back into the tree the inspector renders', () => {
    const parsed = parseRequest(buildRequest({ host: 'example.com', path: '/users?a=1' }))
    assert.equal(parsed.method, 'GET')
    assert.equal(parsed.path, '/users?a=1')
    assert.equal(parsed.version, 'HTTP/1.1')
    assert.deepEqual(parsed.tree.map((n) => n.name), ['Request Line', 'Headers', 'Blank Line'])

    const host = parsed.tree[1].children.find((c) => c.name === 'Host')
    assert.equal(host.value, 'example.com')
    assert.match(host.explain, /thousands/, 'Host carries the vhost lesson')
  })

  test('every span in the request tree lands inside the bytes', () => {
    const bytes = buildRequest({ host: 'example.com' })
    for (const section of parseRequest(bytes).tree) {
      for (const node of [section, ...(section.children ?? [])]) {
        const [off, len] = node.span
        assert.ok(off >= 0 && off + len <= bytes.length, `${node.name} span [${off},${len}]`)
      }
    }
  })
})

// ── response ────────────────────────────────────────────────────────────────

describe('http · the response we read', () => {
  test('a Content-Length body is taken exactly, no more', () => {
    const r = parseResponse(fx('http-length.txt'))
    assert.equal(r.status, 200)
    assert.equal(r.reason, 'OK')
    assert.equal(r.contentLength, 23)
    assert.equal(r.body.toString(), '{"ok":true,"answer":42}')
    assert.equal(r.chunked, false)
    assert.equal(r.headerMap['content-type'], 'application/json')
  })

  test('a chunked body is reassembled from its pieces', () => {
    const r = parseResponse(fx('http-chunked.txt'))
    assert.equal(r.chunked, true)
    assert.equal(r.body.toString(), '<html><body>Hello there and goodbye.</body></html>')
    assert.equal(r.chunks.length, 4, 'three chunks plus the terminating zero')
    assert.equal(r.chunks[r.chunks.length - 1].size, 0)
    assert.equal(r.truncatedParse, undefined)
  })

  test('a folded header line continues the one before it', () => {
    // Obsolete, discouraged, and still emitted in the wild.
    const r = parseResponse(fx('http-folded.txt'))
    assert.equal(r.headerMap['x-long'], 'first part second part folded on third part')
    assert.equal(r.body.toString(), 'hi')
  })

  test('a 304 carries no body at all, and that is correct', () => {
    const r = parseResponse(fx('http-304.txt'))
    assert.equal(r.status, 304)
    assert.equal(r.body.length, 0)
    assert.equal(r.headerMap.etag, '"abc123"')
  })

  test('a redirect names where the thing actually lives', () => {
    const r = parseResponse(fx('http-redirect.txt'))
    assert.equal(r.status, 301)
    assert.equal(r.headerMap.location, 'https://www.example.com/')
    assert.equal(statusClass(r.status), 3)
    assert.match(STATUS_MEANING[3], /Redirect/)
  })

  test('a 4xx is parsed like any other response', () => {
    const r = parseResponse(fx('http-404.txt'))
    assert.equal(r.status, 404)
    assert.equal(r.body.toString(), 'not here!')
    assert.match(STATUS_MEANING[statusClass(404)], /Your fault/)
  })

  test('the response tree covers head, blank line and body', () => {
    const bytes = fx('http-chunked.txt')
    const r = parseResponse(bytes)
    const names = r.tree.map((n) => n.name)
    assert.ok(names.includes('Status Line'))
    assert.ok(names.includes('Headers'))
    assert.ok(names.includes('Blank Line'))
    assert.ok(names.some((n) => n.startsWith('Body')))

    for (const section of r.tree) {
      for (const node of [section, ...(section.children ?? [])]) {
        const [off, len] = node.span
        assert.ok(off >= 0 && off + len <= bytes.length,
          `${node.name} span [${off},${len}] outside ${bytes.length} bytes`)
      }
    }
  })

  test('headers a learner will hover carry an explanation', () => {
    const r = parseResponse(fx('http-chunked.txt'))
    const te = r.tree.find((n) => n.name === 'Headers')
      .children.find((c) => c.name === 'Transfer-Encoding')
    assert.match(te.explain, /did not know the total size/)
  })
})

// ── chunked, in detail ──────────────────────────────────────────────────────

describe('http · chunked transfer encoding', () => {
  const chunk = (parts) => Buffer.from(
    parts.map((p) => `${p.length.toString(16)}\r\n${p}\r\n`).join('') + '0\r\n\r\n', 'ascii')

  test('reassembles in order', () => {
    const { body, complete } = decodeChunked(chunk(['abc', 'de', 'fghij']))
    assert.equal(body.toString(), 'abcdefghij')
    assert.equal(complete, true)
  })

  test('a chunk extension after a semicolon is ignored', () => {
    const raw = Buffer.from('5;name=value\r\nhello\r\n0\r\n\r\n', 'ascii')
    assert.equal(decodeChunked(raw).body.toString(), 'hello')
  })

  test('an empty body is a single zero chunk', () => {
    const { body, chunks, complete } = decodeChunked(Buffer.from('0\r\n\r\n', 'ascii'))
    assert.equal(body.length, 0)
    assert.equal(chunks.length, 1)
    assert.equal(complete, true)
  })

  test('a body cut off mid-stream is reported, not silently accepted', () => {
    const truncated = Buffer.from('10\r\nonly-five\r\n', 'ascii')   // claims 16, has 9
    assert.throws(() => decodeChunked(truncated), /runs past the end/)
  })

  test('a chunk length that is not hex is refused', () => {
    assert.throws(() => decodeChunked(Buffer.from('zz\r\nabc\r\n', 'ascii')), /is not a chunk length/)
  })

  test('a response whose chunked body never terminates says so', () => {
    const head = 'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n'
    const r = parseResponse(Buffer.from(`${head}3\r\nabc\r\n`, 'ascii'))
    assert.equal(r.body.toString(), 'abc', 'what did arrive is still usable')
    assert.match(r.truncatedParse, /terminating 0-length chunk/)
  })
})

// ── malformed input ─────────────────────────────────────────────────────────

describe('http · broken input degrades rather than throwing', () => {
  test('no blank line means the headers never ended', () => {
    const r = parseResponse(Buffer.from('HTTP/1.1 200 OK\r\nHost: a\r\n', 'ascii'))
    assert.match(r.truncatedParse, /headers never ended/)
  })

  test('a reply that is not HTTP yields a null status, not an exception', () => {
    const r = parseResponse(Buffer.from('hello there\r\n\r\nbody', 'ascii'))
    assert.equal(r.status, null)
    assert.equal(r.body.toString(), 'body')
  })

  test('empty input does not throw', () => {
    assert.doesNotThrow(() => parseResponse(Buffer.alloc(0)))
  })
})

// ── url parsing ─────────────────────────────────────────────────────────────

describe('http · url handling', () => {
  test('a bare hostname defaults to https', () => {
    assert.deepEqual(parseUrl('example.com'),
      { secure: true, host: 'example.com', port: 443, path: '/' })
  })

  test('scheme, port, path and query all survive', () => {
    assert.deepEqual(parseUrl('http://example.com:8080/a/b?c=1'),
      { secure: false, host: 'example.com', port: 8080, path: '/a/b?c=1' })
    assert.equal(parseUrl('https://example.com/x').port, 443)
  })

  test('a scheme we cannot speak is refused, and so is a non-URL', () => {
    assert.throws(() => parseUrl('ftp://example.com'), /not supported/)
    assert.throws(() => parseUrl('http://not a host/'), /valid host|not a URL/)
  })
})

describe('http · decompression', () => {
  test('an uncompressed body passes through untouched', () => {
    const body = Buffer.from('plain')
    assert.equal(decompress(body, null).body, body)
    assert.equal(decompress(body, null).decompressed, false)
  })

  test('a body that claims gzip but is not does not throw', () => {
    const r = decompress(Buffer.from('not gzip at all'), 'gzip')
    assert.equal(r.decompressed, false)
    assert.ok(r.error, 'it says what went wrong instead')
  })

  test('a real gzip body round-trips', async () => {
    const { gzipSync } = await import('node:zlib')
    const r = decompress(gzipSync(Buffer.from('hello world')), 'gzip')
    assert.equal(r.decompressed, true)
    assert.equal(r.body.toString(), 'hello world')
  })
})

// ── envelope ────────────────────────────────────────────────────────────────

describe('http · the envelope', () => {
  const wireFrom = (file, url = 'https://example.com') => {
    const request = buildRequest({ host: 'example.com' })
    const response = fx(file)
    const parsed = parseResponse(response)
    return {
      request, response, secure: true, peer: '93.184.216.34:443', localPort: 51234, cert: null,
      timings: { connectMs: 31.2, tlsMs: 42.8, ttfbMs: 18.4, transferMs: 2.1, totalMs: 94.5 },
      requestMessage: parseRequest(request),
      responseMessage: parsed,
      url,
    }
  }

  test('keeps the shape every other endpoint returns', () => {
    const env = buildEnvelope(wireFrom('http-chunked.txt'), { url: 'https://example.com' })
    assert.deepEqual(Object.keys(env), ['ok', 'durationMs', 'events', 'packets', 'meta', 'text'])
    assert.equal(env.packets.length, 2)
    assert.equal(env.packets[0].editable, true, 'our request is ours to edit')
    assert.equal(env.packets[1].editable, false)
  })

  test('the narration explains chunked rather than naming it', () => {
    const env = buildEnvelope(wireFrom('http-chunked.txt'), { url: 'https://example.com' })
    assert.match(env.events[1].narration, /did not know the total size/)
    assert.equal(env.meta.chunked, true)
    assert.equal(env.meta.chunkCount, 4)
  })

  test('a redirect narration points at the Location', () => {
    const env = buildEnvelope(wireFrom('http-redirect.txt'), { url: 'https://example.com' })
    assert.match(env.events[1].narration, /Redirect/)
    assert.match(env.events[1].narration, /www\.example\.com/)
  })

  test('a large body is truncated for the hex view, and says so', () => {
    const wire = wireFrom('http-chunked.txt')
    wire.response = Buffer.concat([wire.response, Buffer.alloc(9000, 0x41)])
    const env = buildEnvelope(wire, { url: 'https://example.com' })
    assert.ok(env.packets[1].length <= 4096)
    assert.match(env.packets[1].note, /first 4096/)
  })
})

describe('http · presentation', () => {
  test('formatHead prints the status line and every header', () => {
    const head = formatHead(parseResponse(fx('http-length.txt')))
    assert.ok(head.startsWith('HTTP/1.1 200 OK'))
    assert.ok(head.includes('Content-Length: 23'))
  })

  test('a body preview never floods the terminal', () => {
    const preview = previewBody(Buffer.from('x'.repeat(5000)), 100)
    assert.ok(preview.length < 200)
    assert.match(preview, /more characters/)
  })
})

describe('http · the fixtures are still HTTP', () => {
  // .gitattributes normalises this repository to LF, which is right for the
  // reproducible build and wrong for these six files: HTTP framing IS \r\n.
  // Stored as LF they stop being HTTP, and the failure only appears on a fresh
  // clone — the tree that committed them keeps passing.
  const files = ['http-chunked.txt', 'http-length.txt', 'http-redirect.txt',
    'http-304.txt', 'http-folded.txt', 'http-404.txt']

  test('every fixture still uses CRLF line endings', () => {
    for (const f of files) {
      const bytes = fx(f)
      assert.ok(bytes.includes('\r\n'), `${f} lost its carriage returns — check .gitattributes`)
      const lf = [...bytes].filter((b, i) => b === 10 && bytes[i - 1] !== 13).length
      assert.equal(lf, 0, `${f} has ${lf} bare LF line endings`)
    }
  })

  test('every fixture still contains the blank line that ends the headers', () => {
    for (const f of files) {
      assert.ok(fx(f).includes('\r\n\r\n'), `${f} has no header terminator`)
    }
  })

  test('and every one of them still parses as a response', () => {
    for (const f of files) {
      const r = parseResponse(fx(f))
      assert.ok(r.status >= 100 && r.status < 600, `${f} did not yield a status`)
      assert.equal(r.truncatedParse, undefined, `${f}: ${r.truncatedParse}`)
    }
  })
})
