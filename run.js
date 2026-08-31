#!/usr/bin/env node
/**
 * run.js — THE one command:  node run.js
 *
 * Flags (via node:util parseArgs — replaces yargs / commander / dotenv):
 *   --port <n>      default 7777, auto-increments if busy
 *   --host <addr>   default 127.0.0.1
 *   --no-open       don't launch a browser
 *   --watch         reload-friendly dev mode message
 */
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { createApp, listen } from './src/server/server.js'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
// Optional local settings, for the one feature that takes a key. Node has
// carried this since 20.6, so it costs no code and no dependency. A missing
// file is the normal case and is not an error.
try { process.loadEnvFile(join(ROOT, '.env')) } catch { /* no .env, fine */ }

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '7777' },
    host: { type: 'string', default: '127.0.0.1' },
    open: { type: 'boolean', default: true },
    watch: { type: 'boolean', default: false },
  },
  strict: false,
})

// ── hand-rolled ANSI (this is all `chalk` really is) ────────────────────────
const c = {
  r: '\x1b[0m', b: '\x1b[1m', dim: '\x1b[2m',
  cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', mag: '\x1b[35m',
}

const banner = `
  ${c.cyan}${c.b}  ▄▄▄   netlens${c.r}  ${c.dim}v${pkg.version}${c.r}
  ${c.dim}  ▀▀▀   see every byte${c.r}
`

async function listenWithRetry(server, host, startPort, tries = 10) {
  for (let i = 0; i < tries; i++) {
    try {
      return await listen(server, { port: startPort + i, host })
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err
      if (i === 0) console.log(`  ${c.yellow}port ${startPort} busy, trying next…${c.r}`)
    }
  }
  throw new Error(`no free port in ${startPort}..${startPort + tries - 1}`)
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
      : ['xdg-open', [url]]
  execFile(cmd[0], cmd[1], { windowsHide: true }, () => {})
}

const { server } = createApp({ webRoot: join(ROOT, 'web'), version: pkg.version })
const addr = await listenWithRetry(server, values.host, Number(values.port))
const url = `http://${values.host}:${addr.port}`

console.log(banner)
console.log(`  ${c.green}●${c.r} running   ${c.b}${url}${c.r}`)
console.log(`  ${c.dim}mode      dev (serving web/ from disk)${c.r}`)
console.log(`  ${c.dim}node      ${process.version} · ${process.platform}${c.r}`)
console.log(`  ${c.dim}deps      ${c.r}${c.mag}0${c.r}${c.dim} — run \`node verify-zero-dep.js\` to prove it${c.r}`)
console.log('')
console.log(`  ${c.dim}ctrl+c to stop${c.r}`)
console.log('')

if (values.open) openBrowser(url)

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n  ${c.dim}stopped${c.r}\n`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 500).unref()
  })
}
