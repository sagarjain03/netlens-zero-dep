/**
 * api/http.js — turns an HTTP exchange into the shared envelope.
 *
 * Chapter 6's point is deflationary, and deliberately so: after everything the
 * previous chapters built up to, the request itself is a few lines of ASCII.
 */
import { request as httpRequest, parseUrl } from '../proto/http-client.js'
import { statusClass, STATUS_MEANING, previewBody } from '../proto/http.js'
import { envelope, event, packet, sendJson } from '../server/respond.js'

export async function handleHttp({ res, body }) {
  const lang = body.lang === 'hi' ? 'hi' : 'en'
  if (!body.url) throw new Error('url is required')

  const wire = await httpRequest({
    url: body.url,
    method: (body.method ?? 'GET').toUpperCase(),
    headers: body.headers ?? {},
    keepAlive: Boolean(body.keepAlive),
    timeoutMs: Math.min(Number(body.timeoutMs) || 12000, 20000),
  })

  sendJson(res, buildEnvelope(wire, { lang, url: body.url }))
}

export function buildEnvelope(wire, { lang = 'en', url } = {}) {
  const req = wire.requestMessage
  const resp = wire.responseMessage
  const t = wire.timings
  const target = typeof url === 'string' ? parseUrl(url) : { host: wire.peer }

  const events = [
    event({
      t: 0,
      dir: 'out',
      from: 'you',
      to: wire.peer,
      proto: wire.secure ? 'HTTPS' : 'HTTP',
      bytes: wire.request.length,
      label: `${req.method} ${req.path}`,
      packetId: 'q',
      narration: `After all that setup, the request is ${wire.request.length} bytes of plain text: a method, a path, a few headers, and a blank line to say it is finished. You could type it by hand.`,
    }),
    event({
      t: t.ttfbMs ?? t.totalMs,
      dir: 'in',
      from: wire.peer,
      to: 'you',
      proto: wire.secure ? 'HTTPS' : 'HTTP',
      bytes: wire.response.length,
      label: `${resp.status ?? '???'} ${resp.reason ?? ''}`.trim(),
      packetId: 'r',
      note: resp.truncatedParse ? 'parse stopped' : '',
      narration: responseNarration(resp, wire),
    }),
  ]

  return envelope({
    durationMs: t.totalMs,
    events,
    packets: [
      packet({ id: 'q', dir: 'out', proto: 'HTTP', bytes: wire.request, tree: req.tree, editable: true }),
      packet({
        id: 'r',
        dir: 'in',
        proto: 'HTTP',
        // A megabyte of HTML in the hex grid helps nobody; the head plus a slice
        // of body is what there is to read.
        bytes: wire.response.subarray(0, 4096),
        tree: resp.tree,
        note: resp.truncatedParse ?? (wire.response.length > 4096 ? `showing the first 4096 of ${wire.response.length} bytes` : ''),
      }),
    ],
    meta: {
      url,
      host: target.host,
      peer: wire.peer,
      localPort: wire.localPort,
      secure: wire.secure,
      method: req.method,
      path: req.path,
      status: resp.status,
      reason: resp.reason,
      headers: resp.headers,
      chunked: resp.chunked,
      chunkCount: resp.chunks?.length ?? 0,
      contentLength: resp.contentLength,
      contentType: resp.contentType,
      decompressed: resp.decompressed ?? false,
      bodyBytes: resp.body.length,
      timings: t,
      cert: wire.cert,
      truncatedParse: resp.truncatedParse ?? null,
    },
    text: previewBody(resp.body, 600),
  })
}

function responseNarration(resp, wire) {
  if (resp.status == null) return 'The reply did not start with a status line we could read.'

  const cls = statusClass(resp.status)
  const meaning = STATUS_MEANING[cls] ?? ''
  const parts = [`${resp.status} ${resp.reason}. ${meaning}`]

  if (cls === 3 && resp.headerMap.location) {
    parts.push(`It points you at ${resp.headerMap.location} instead.`)
  }
  if (resp.chunked) {
    parts.push(`The body arrived in ${resp.chunks?.length ?? 0} chunks — the server did not know the total size when it started replying, so each piece announced its own length.`)
  } else if (resp.contentLength != null) {
    parts.push(`Content-Length said ${resp.contentLength} bytes, so the client knew exactly when the reply was finished.`)
  }
  if (wire.timings.ttfbMs != null) {
    parts.push(`The first byte came back ${wire.timings.ttfbMs} ms after the request went out.`)
  }

  return parts.join(' ')
}
