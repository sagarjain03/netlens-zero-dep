#!/usr/bin/env node
/**
 * verify-zero-dep.js — the guardrail.
 *
 * Written before any product code, and run on every `npm test`, so that a
 * third-party dependency can never quietly enter the tree. Scans:
 *
 *   .js   →  every  import / export-from / require() / await import()
 *   .html →  <script src>, <link href>, and any external URL
 *   .css  →  @import and url() pointing off-host
 *
 * Allowed specifiers: `node:*` builtins and relative paths. Nothing else.
 * Exits 1 on any violation so it can gate a build.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('.', import.meta.url))

// ── what we scan ────────────────────────────────────────────────────────────
const SCAN_DIRS = ['src', 'web', 'test', 'tools']
const SCAN_FILES = ['run.js', 'build.js', 'verify-zero-dep.js']
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'docs', '.claude'])
const CODE_EXT = new Set(['.js', '.mjs', '.cjs'])
const MARKUP_EXT = new Set(['.html', '.htm', '.css'])

// ── ANSI, hand-rolled (this is what `chalk` does) ───────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
}
const ok = (s) => `${C.green}${s}${C.reset}`
const bad = (s) => `${C.red}${s}${C.reset}`
const dim = (s) => `${C.dim}${s}${C.reset}`

// ── file walker ─────────────────────────────────────────────────────────────
function* walk(dir) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) yield* walk(full)
    else yield full
  }
}

function collectFiles() {
  const files = []
  for (const d of SCAN_DIRS) files.push(...walk(join(ROOT, d)))
  for (const f of SCAN_FILES) {
    const full = join(ROOT, f)
    if (existsSync(full)) files.push(full)
  }
  return files
}

// ── specifier extraction ────────────────────────────────────────────────────
// Deliberately regex-based rather than a real parser: a parser would be a
// dependency, and this only has to be strict, not clever. False positives are
// fine (they fail loudly); false negatives are not, so the patterns are broad.
// `import` / `export` are only anchored at a statement position (line start, or
// after ; or }). Matching them after any whitespace would also match the word
// inside a string such as 'dynamic import' — again, this file proves it.
const PATTERNS = [
  // import x from 'y' / export … from 'y'
  { re: /(?:^|[;}])\s*(?:import|export)\s[^;'"()]*?from\s*['"]([^'"]+)['"]/gm, kind: 'import' },
  // bare  import 'y'
  { re: /(?:^|[;}])\s*import\s*['"]([^'"]+)['"]/gm, kind: 'import' },
  // dynamic import('y')  — literal specifier only
  { re: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, kind: 'dynamic import' },
  // require('y')
  { re: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, kind: 'require' },
]
// non-literal require/import: always a violation, we cannot verify it
const DYNAMIC_RE = /\b(?:require|import)\s*\(\s*(?!['"])[A-Za-z_$]/g

// A regex literal can contain text that looks exactly like an import statement —
// this file is itself the proof. Strip comments and regex literals before scanning
// so the verifier does not flag its own patterns.
const REGEX_LITERAL = /(^|[=(,:[!&|?{};\s])\/(?![*/])((?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\\\n])+)\/[gimsuyd]*/g

function stripNoise(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')          // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')      // line comments (not URLs)
    .replace(REGEX_LITERAL, '$1/RE/')          // regex literals
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length
}

// ── markup / css external references ────────────────────────────────────────
const EXTERNAL_URL = /(?:src|href)\s*=\s*['"]((?:https?:)?\/\/[^'"]+)['"]/gi
const CSS_EXTERNAL = /(?:@import\s+(?:url\()?|url\()\s*['"]?((?:https?:)?\/\/[^'")]+)/gi

// ── run ─────────────────────────────────────────────────────────────────────
const violations = []
const builtins = new Set()
let relCount = 0, builtinCount = 0, fileCount = 0

for (const file of collectFiles()) {
  const ext = extname(file)
  const rel = relative(ROOT, file).split(sep).join('/')
  const raw = readFileSync(file, 'utf8')
  fileCount++

  if (CODE_EXT.has(ext)) {
    const src = stripNoise(raw)

    for (const { re, kind } of PATTERNS) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(src))) {
        const spec = m[1]
        if (spec.startsWith('node:')) {
          builtins.add(spec.slice(5).split('/')[0])
          builtinCount++
        } else if (spec.startsWith('./') || spec.startsWith('../')) {
          relCount++
        } else if (/^(https?:)?\/\//.test(spec)) {
          violations.push({ rel, line: lineOf(src, m.index), msg: `remote ${kind} "${spec}"` })
        } else {
          violations.push({ rel, line: lineOf(src, m.index), msg: `third-party ${kind} "${spec}"` })
        }
      }
    }

    DYNAMIC_RE.lastIndex = 0
    let d
    while ((d = DYNAMIC_RE.exec(src))) {
      violations.push({ rel, line: lineOf(src, d.index), msg: 'non-literal require()/import() — cannot be verified' })
    }
  }

  if (MARKUP_EXT.has(ext)) {
    const re = ext === '.css' ? CSS_EXTERNAL : EXTERNAL_URL
    re.lastIndex = 0
    let m
    while ((m = re.exec(raw))) {
      violations.push({ rel, line: lineOf(raw, m.index), msg: `external asset "${m[1]}" — CDN/font = runtime dependency` })
    }
  }
}

// ── manifest checks ─────────────────────────────────────────────────────────
const checks = []
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const depCount = Object.keys(pkg.dependencies ?? {}).length
const devCount = Object.keys(pkg.devDependencies ?? {}).length
checks.push(['package.json  dependencies', depCount === 0, depCount === 0 ? '{}' : `${depCount} found`])
checks.push(['package.json  devDependencies', devCount === 0, devCount === 0 ? '{}' : `${devCount} found`])

const lockPath = join(ROOT, 'package-lock.json')
if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  const pkgs = Object.keys(lock.packages ?? {}).filter((k) => k !== '')
  checks.push(['package-lock.json  packages', pkgs.length === 0, pkgs.length === 0 ? 'root only' : `${pkgs.length} found`])
} else {
  checks.push(['package-lock.json', true, 'absent'])
}

const nmPresent = existsSync(join(ROOT, 'node_modules'))
checks.push(['node_modules/', !nmPresent, nmPresent ? 'PRESENT' : 'absent'])

const failedChecks = checks.filter(([, pass]) => !pass)

// ── report ──────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n, '.')
const n3 = (n) => String(n).padStart(3, '0')

console.log('')
console.log(`  ${C.bold}┌─ ZERO DEPENDENCY VERIFICATION ─────────────────────────┐${C.reset}`)
console.log('')
console.log(`    ${pad('files scanned', 22)} ${String(fileCount).padStart(4)}`)
console.log(`    ${pad('imports found', 22)} ${String(relCount + builtinCount + violations.length).padStart(4)}`)
console.log(`      ${pad('├─ relative', 20)} ${String(relCount).padStart(4)}  ${ok('OK')}`)
console.log(`      ${pad('├─ node: builtins', 20)} ${String(builtinCount).padStart(4)}  ${ok('OK')}`)
console.log(`      ${pad('└─ third-party', 20)} ${' ' + n3(violations.length)}  ${violations.length ? bad('FAIL') : ok('OK')}`)
console.log('')

if (builtins.size) {
  const list = [...builtins].sort()
  console.log(`    ${dim('node: modules used')}`)
  for (let i = 0; i < list.length; i += 6) {
    console.log(`      ${C.cyan}${list.slice(i, i + 6).map((s) => s.padEnd(14)).join('')}${C.reset}`)
  }
  console.log('')
}

for (const [label, pass, detail] of checks) {
  console.log(`    ${pad(label, 34)} ${detail.padEnd(10)} ${pass ? ok('OK') : bad('FAIL')}`)
}
console.log('')
console.log(`  ${C.bold}└────────────────────────────────────────────────────────┘${C.reset}`)
console.log('')

if (violations.length || failedChecks.length) {
  for (const v of violations) console.log(`  ${bad('✗')} ${v.rel}:${v.line}  ${v.msg}`)
  for (const [label, , detail] of failedChecks) console.log(`  ${bad('✗')} ${label} — ${detail}`)
  console.log('')
  console.log(`  ${bad(C.bold + '✗ ZERO DEPENDENCY VIOLATED' + C.reset)}`)
  console.log('')
  process.exit(1)
}

console.log(`  ${C.green}${C.bold}🏆 ZERO DEPENDENCY VERIFIED${C.reset}`)
console.log('')
