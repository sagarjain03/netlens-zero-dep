/**
 * trace.js — parses traceroute output, hop by hop, as it arrives.
 * Replaces: `traceroute`, `nodejs-traceroute`, `netroute`.
 *
 * Windows and Unix print the same information in a different column order,
 * which is exactly the kind of difference that only shows up on someone else's
 * machine, so both are parsed here and both are covered by fixtures.
 *
 *   Windows    1     1 ms     1 ms     4 ms  192.168.1.1
 *              4     *        *        *     Request timed out.
 *
 *   Unix       1  192.168.1.1  2.123 ms  2.045 ms  1.987 ms
 *              2  * * *
 *
 * A hop that does not answer is not an error. Plenty of routers are configured
 * to stay quiet, and a learner needs to be told that rather than shown a
 * failure — so those come back as `silent`, with a place on the map.
 */

const WIN_TIME = /^(?:<\s*)?(\d+)\s*ms$/i
const UNIX_TIME = /^([\d.]+)\s*ms$/i
const IP_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/

/** The target line, printed once before the hops. */
export function parseTraceHeader(line) {
  // Windows: Tracing route to github.com [140.82.113.4] over a maximum of 30 hops
  const win = /^Tracing route to\s+(\S+)(?:\s+\[([^\]]+)\])?/i.exec(line)
  if (win) return { host: win[1], ip: win[2] ?? (IP_RE.test(win[1]) ? win[1] : null) }

  // Unix: traceroute to github.com (140.82.113.4), 30 hops max, 60 byte packets
  const unix = /^traceroute to\s+(\S+)\s*(?:\(([^)]+)\))?/i.exec(line)
  if (unix) return { host: unix[1], ip: unix[2] ?? (IP_RE.test(unix[1]) ? unix[1] : null) }

  return null
}

export const isTraceComplete = (line) => /^Trace complete/i.test(String(line).trim())

/**
 * Parse one hop line, in either platform's format.
 * @returns {{hop:number, host:string|null, times:number[], silent:boolean, avg:number|null}|null}
 */
export function parseTraceLine(line) {
  const text = String(line).replace(/\s+$/, '')
  const m = /^\s*(\d+)\s+(.*)$/.exec(text)
  if (!m) return null

  const hop = Number(m[1])
  const rest = m[2].trim()
  if (!rest) return null

  // Windows puts the times first and the host last; Unix does the opposite.
  const tokens = rest.split(/\s+/)
  const looksUnix = IP_RE.test(tokens[0]) || (tokens[0] === '*' && tokens.length <= 4 && !/ms/i.test(rest))

  return looksUnix ? parseUnixHop(hop, tokens, rest) : parseWinHop(hop, rest)
}

function parseWinHop(hop, rest) {
  const times = []
  // "1 ms", "<1 ms" and "*" all appear; consume them from the left.
  let remainder = rest
  for (;;) {
    const star = /^\*\s*/.exec(remainder)
    if (star) { times.push(null); remainder = remainder.slice(star[0].length); continue }
    const ms = /^(<\s*)?(\d+)\s*ms\s*/i.exec(remainder)
    if (ms) { times.push(Number(ms[2])); remainder = remainder.slice(ms[0].length); continue }
    break
  }

  const tail = remainder.trim()
  if (!tail || /^Request timed out\.?$/i.test(tail)) {
    return { hop, host: null, times, silent: true, avg: null }
  }
  if (/^Destination (net|host) unreachable/i.test(tail)) {
    return { hop, host: null, times, silent: true, unreachable: true, avg: null }
  }

  // "github.com [140.82.113.4]" — prefer the address, it is what we can draw.
  const bracket = /\[([^\]]+)\]/.exec(tail)
  const host = bracket ? bracket[1] : tail.split(/\s+/)[0]
  return { hop, host, times, silent: false, avg: average(times) }
}

function parseUnixHop(hop, tokens, rest) {
  if (tokens.every((t) => t === '*')) {
    return { hop, host: null, times: tokens.map(() => null), silent: true, avg: null }
  }

  const host = tokens[0]
  const times = []
  for (const m of rest.matchAll(/([\d.]+)\s*ms/gi)) times.push(Number(m[1]))
  const stars = (rest.match(/\*/g) ?? []).length
  for (let i = 0; i < stars; i++) times.push(null)

  if (!IP_RE.test(host) && !/^[a-z0-9.-]+$/i.test(host)) {
    return { hop, host: null, times, silent: true, avg: null }
  }
  return { hop, host, times, silent: false, avg: average(times) }
}

function average(times) {
  const real = times.filter((t) => typeof t === 'number')
  if (!real.length) return null
  return Math.round((real.reduce((a, b) => a + b, 0) / real.length) * 10) / 10
}

/** Parse a whole captured run — used by the tests and by any non-streaming caller. */
export function parseTrace(text) {
  const hops = []
  let target = null
  let complete = false

  for (const line of String(text).split(/\r?\n/)) {
    if (!target) {
      const header = parseTraceHeader(line)
      if (header) { target = header; continue }
    }
    if (isTraceComplete(line)) { complete = true; continue }
    const hop = parseTraceLine(line)
    if (hop) hops.push(hop)
  }

  return { target, hops, complete, ...summarise(hops) }
}

/**
 * Where the journey actually gets interesting.
 *
 * The biggest latency jump between two answering hops is almost always a long
 * physical link — a submarine cable, or a hop to another continent. Naming it
 * turns a list of addresses into a story about geography.
 */
export function summarise(hops) {
  const answered = hops.filter((h) => !h.silent && h.avg != null)
  let biggestJump = null

  for (let i = 1; i < answered.length; i++) {
    const delta = answered[i].avg - answered[i - 1].avg
    if (!biggestJump || delta > biggestJump.delta) {
      biggestJump = {
        delta: Math.round(delta * 10) / 10,
        from: answered[i - 1],
        to: answered[i],
      }
    }
  }

  return {
    answered: answered.length,
    silent: hops.filter((h) => h.silent).length,
    totalMs: answered.length ? answered[answered.length - 1].avg : null,
    biggestJump: biggestJump && biggestJump.delta > 0 ? biggestJump : null,
  }
}
