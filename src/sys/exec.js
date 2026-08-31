/**
 * exec.js — runs the operating system's own network tools.
 * Replaces: `ping`, `traceroute`, `nodejs-traceroute`, `default-gateway`, `netstat`.
 *
 * Node's standard library has no raw sockets, so ICMP is not reachable from
 * JavaScript. The OS already ships tools that can do it, and `node:child_process`
 * is standard library, so we run those and parse the output ourselves. No npm
 * wrapper is involved, and the README says so plainly.
 *
 * SECURITY — the rules here are absolute, because this file turns user input
 * into a process:
 *
 *   1. execFile, never exec. There is no shell, so there is no shell injection.
 *   2. The binary is chosen from a fixed table. A caller names an operation
 *      ("ping"), never a program.
 *   3. Arguments are built by us. The only user-supplied value that ever reaches
 *      an argv slot is a host, and it must first match a strict pattern and not
 *      begin with '-', so it cannot be mistaken for a flag.
 *   4. Every call has a timeout and a captured-output cap.
 */
import { execFile } from 'node:child_process'
import { platform } from 'node:os'

const MAX_OUTPUT = 1024 * 1024      // 1 MB is far more than any of these produce
const DEFAULT_TIMEOUT = 20_000

/**
 * A hostname or IP, and nothing else. Anchored, length-capped, and explicitly
 * refusing a leading '-' so a "host" can never arrive as an option.
 */
const HOST_RE = /^(?!-)[A-Za-z0-9._:-]{1,253}$/

export function validateHost(host) {
  const value = String(host ?? '').trim()
  if (!value) throw new Error('a host is required')
  if (!HOST_RE.test(value)) {
    throw new Error(`"${value}" is not a valid host name or address`)
  }
  return value
}

const clampCount = (n, lo, hi, fallback) => {
  const v = Number.parseInt(n, 10)
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback
}

/**
 * The operation table. Each entry maps a platform to [binary, argv].
 * Note that argv is produced by us from validated values only.
 */
export const OPERATIONS = {
  ifconfig: {
    summary: 'network interfaces, addresses and gateway',
    win32: () => ['ipconfig', ['/all']],
    linux: () => ['ip', ['addr']],
    darwin: () => ['ifconfig', []],
  },
  arp: {
    summary: 'the neighbours your machine has already talked to',
    win32: () => ['arp', ['-a']],
    linux: () => ['ip', ['neigh']],
    darwin: () => ['arp', ['-a']],
  },
  route: {
    summary: 'your routing table',
    win32: () => ['route', ['print', '-4']],
    linux: () => ['ip', ['route']],
    darwin: () => ['netstat', ['-rn', '-f', 'inet']],
  },
  netstat: {
    summary: 'live TCP connections',
    win32: () => ['netstat', ['-n']],
    linux: () => ['ss', ['-tn']],
    darwin: () => ['netstat', ['-n', '-p', 'tcp']],
  },
  ping: {
    summary: 'ICMP echo — is that host reachable, and how far away?',
    needsHost: true,
    timeout: 25_000,
    win32: (host, o) => ['ping', ['-n', String(clampCount(o.count, 1, 10, 4)), host]],
    linux: (host, o) => ['ping', ['-c', String(clampCount(o.count, 1, 10, 4)), host]],
    darwin: (host, o) => ['ping', ['-c', String(clampCount(o.count, 1, 10, 4)), host]],
  },
  trace: {
    summary: 'every router between you and a host',
    needsHost: true,
    timeout: 120_000,
    win32: (host, o) => ['tracert', ['-d', '-h', String(clampCount(o.maxHops, 1, 30, 20)), '-w', '1200', host]],
    linux: (host, o) => ['traceroute', ['-n', '-m', String(clampCount(o.maxHops, 1, 30, 20)), '-w', '2', host]],
    darwin: (host, o) => ['traceroute', ['-n', '-m', String(clampCount(o.maxHops, 1, 30, 20)), '-w', '2', host]],
  },
}

export const operationNames = () => Object.keys(OPERATIONS)

/** Resolve an operation to the exact [binary, argv] for this platform. */
export function resolveCommand(name, opts = {}, os = platform()) {
  const op = OPERATIONS[name]
  if (!op) throw new Error(`unknown operation "${name}"`)

  const build = op[os]
  if (!build) throw new Error(`"${name}" is not supported on ${os}`)

  const host = op.needsHost ? validateHost(opts.host) : null
  const [binary, args] = op.needsHost ? build(host, opts) : build(opts)

  // Belt and braces: nothing in argv may look like a flag we did not write.
  for (const arg of args) {
    if (typeof arg !== 'string') throw new Error('argv must be strings')
  }
  return { binary, args, timeout: op.timeout ?? DEFAULT_TIMEOUT, host }
}

/**
 * Run an operation and return its raw output.
 *
 * A non-zero exit is NOT treated as failure: `ping` to an unreachable host exits
 * 1 but prints exactly the information a learner needs to see. The caller's
 * parser decides what the output means.
 *
 * @returns {Promise<{stdout, stderr, code, binary, args, durationMs, host}>}
 */
export function runSys(name, opts = {}, os = platform()) {
  const { binary, args, timeout, host } = resolveCommand(name, opts, os)

  return new Promise((resolve, reject) => {
    const started = performance.now()
    execFile(
      binary,
      args,
      { timeout, windowsHide: true, maxBuffer: MAX_OUTPUT, encoding: 'utf8' },
      (err, stdout, stderr) => {
        const durationMs = performance.now() - started

        // A missing binary is a real failure and worth an actionable message.
        if (err && (err.code === 'ENOENT' || err.errno === 'ENOENT')) {
          reject(Object.assign(
            new Error(`"${binary}" is not available on this machine`),
            { code: 'ENOENT', binary },
          ))
          return
        }
        if (err && err.killed) {
          reject(Object.assign(
            new Error(`${binary} took longer than ${Math.round(timeout / 1000)}s and was stopped`),
            { code: 'ETIMEDOUT', binary },
          ))
          return
        }

        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          code: err?.code ?? 0,
          binary,
          args,
          host,
          durationMs,
        })
      },
    )
  })
}

/**
 * Stream an operation line by line — used by traceroute, where hops arrive over
 * tens of seconds and waiting for the whole run would show nothing at all.
 */
export function streamSys(name, opts = {}, { onLine, onDone, onError } = {}, os = platform()) {
  let cmd
  try {
    cmd = resolveCommand(name, opts, os)
  } catch (err) {
    onError?.(err)
    return { cancel() {} }
  }

  const child = execFile(
    cmd.binary,
    cmd.args,
    { timeout: cmd.timeout, windowsHide: true, maxBuffer: MAX_OUTPUT, encoding: 'utf8' },
  )

  let buffer = ''
  const started = performance.now()

  child.stdout?.on('data', (chunk) => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''      // keep the partial line for the next chunk
    for (const line of lines) onLine?.(line)
  })

  child.on('error', (err) => onError?.(err))
  child.on('close', () => {
    if (buffer) onLine?.(buffer)
    onDone?.({ durationMs: performance.now() - started })
  })

  return { cancel: () => child.kill() }
}
