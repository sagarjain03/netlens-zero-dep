/**
 * smoke.test.js — Block 1 gate.
 * Uses node:test + node:assert only. No jest, no mocha, no supertest.
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp, listen } from '../src/server/server.js'
import { envelope, event, packet } from '../src/server/respond.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

describe('server', () => {
  let server, base

  before(async () => {
    const app = createApp({ webRoot: join(ROOT, 'web'), version: 'test' })
    server = app.server
    const addr = await listen(server, { port: 0 })   // port 0 = OS picks a free one
    base = `http://127.0.0.1:${addr.port}`
  })

  after(() => server.close())

  test('GET /api/health reports a healthy app', async () => {
    const res = await fetch(`${base}/api/health`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
    assert.equal(body.app, 'netlens')
    assert.equal(body.mode, 'dev')
    assert.ok(body.routes.includes('GET /api/health'))
  })

  test('GET / serves the app shell', async () => {
    const res = await fetch(`${base}/`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /text\/html/)
    const html = await res.text()
    assert.match(html, /<title>netlens/)
    assert.match(html, /id="canvas"/)
  })

  test('static assets are served with correct MIME types', async () => {
    for (const [path, type] of [
      ['/css/app.css', /text\/css/],
      ['/js/main.js', /javascript/],
      ['/js/state.js', /javascript/],
    ]) {
      const res = await fetch(`${base}${path}`)
      assert.equal(res.status, 200, `${path} should exist`)
      assert.match(res.headers.get('content-type'), type, `${path} MIME`)
    }
  })

  test('unknown /api/* returns a JSON 404, not the shell', async () => {
    const res = await fetch(`${base}/api/nope`)
    assert.equal(res.status, 404)
    const body = await res.json()
    assert.equal(body.ok, false)
  })

  test('unknown page falls back to the shell so deep links survive refresh', async () => {
    const res = await fetch(`${base}/ch/2/tier/3`)
    assert.equal(res.status, 200)
    assert.match(await res.text(), /<title>netlens/)
  })

  test('path traversal is rejected before touching the filesystem', async () => {
    const res = await fetch(`${base}/../package.json`, { redirect: 'manual' })
    const body = await res.text()
    assert.ok(!body.includes('"dependencies"'), 'must not leak package.json')
  })
})

describe('response envelope', () => {
  test('envelope has the fixed shape every endpoint returns', () => {
    const env = envelope({ durationMs: 12.44 })
    assert.deepEqual(Object.keys(env), ['ok', 'durationMs', 'events', 'packets', 'meta', 'text'])
    assert.equal(env.durationMs, 12.4, 'durations round to 0.1ms')
  })

  test('event carries what the canvas needs to draw one arrow', () => {
    const e = event({
      t: 0, dir: 'out', from: 'me', to: '1.1.1.1:53',
      proto: 'UDP', bytes: 28, label: 'DNS query', narration: 'asking the phonebook',
    })
    assert.equal(e.dir, 'out')
    assert.equal(e.bytes, 28)
    assert.equal(e.narration, 'asking the phonebook')
  })

  test('packet hex-encodes its bytes and keeps the length', () => {
    const p = packet({ id: 'p1', dir: 'out', proto: 'UDP', bytes: Buffer.from([0x1a, 0x2b, 0x01, 0x00]) })
    assert.equal(p.hex, '1a2b0100')
    assert.equal(p.length, 4)
    assert.equal(p.editable, false)
  })
})
