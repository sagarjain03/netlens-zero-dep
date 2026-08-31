/**
 * sse.js — Server-Sent Events in about forty lines.
 * Replaces: ws, socket.io, eventsource.
 *
 * Chosen over WebSockets for one reason: `EventSource` is already in every
 * browser, so the client side is native too and neither end needs a library.
 * The protocol is literally `data: <json>\n\n` down an open HTTP response.
 *
 * Only traceroute needs it. A DNS lookup finishes in 13 ms and can simply
 * return JSON; a traceroute takes half a minute, and showing nothing for that
 * long would be the difference between watching a path being discovered and
 * staring at a blank screen.
 */

export function openStream(res, { retryMs = 0 } = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Tells any proxy in the way not to buffer, which would defeat the point.
    'X-Accel-Buffering': 'no',
  })
  if (retryMs) res.write(`retry: ${retryMs}\n\n`)
  // An immediate comment flushes headers so the browser fires `open` at once.
  res.write(': stream open\n\n')

  let closed = false
  res.on('close', () => { closed = true })

  return {
    get closed() { return closed },

    /** One JSON message. */
    send(data) {
      if (closed) return false
      res.write(`data: ${JSON.stringify(data)}\n\n`)
      return true
    },

    /** A named event, for clients that listen by type. */
    sendNamed(name, data) {
      if (closed) return false
      res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
      return true
    },

    /** A comment — keeps an idle connection from being reaped by a proxy. */
    ping() {
      if (closed) return false
      res.write(': keep-alive\n\n')
      return true
    },

    close(data) {
      if (closed) return
      if (data) res.write(`data: ${JSON.stringify({ ...data, done: true })}\n\n`)
      closed = true
      res.end()
    },
  }
}
