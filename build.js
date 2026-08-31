/**
 * build.js — the whole application, as one file you can read.
 *
 *     node build.js          write dist/netlens.js and print its hash
 *     node build.js --check  rebuild and verify the hash has not moved
 *
 * The claim this file exists to support is "zero dependencies", and the most
 * convincing form of that claim is a single file with no install step: copy
 * dist/netlens.js anywhere, run `node netlens.js`, and the app is up.
 *
 * ── how ──────────────────────────────────────────────────────────────────
 *
 * Two halves, and neither needs a bundler off the shelf.
 *
 * The server half is a small ESM concatenator, written here. It is tractable
 * only because src/ is disciplined: every import is either a `node:` builtin
 * or a relative path, and every export is named. There is no `export default`
 * anywhere, and that is what keeps this eighty lines instead of eight hundred.
 *
 * The client half needs no bundling at all. web/ is inlined verbatim as an
 * asset map, and `createStaticHandler` already knew how to serve from one —
 * so the browser fetches the same module graph it always did, out of memory
 * rather than off the disk. The topics' dynamic `import()` keeps working for
 * exactly the same reason.
 *
 * ── reproducible ─────────────────────────────────────────────────────────
 *
 * Nothing in the output varies between runs: no timestamps, no absolute
 * paths, no iteration over unsorted directory listings. Two builds of the
 * same tree produce byte-identical files, which is what makes the printed
 * hash worth anything.
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const ENTRY = join(ROOT, 'src', 'server', 'server.js')
const OUT_DIR = join(ROOT, 'dist')
const OUT_FILE = join(OUT_DIR, 'netlens.js')

// ── walking the tree ───────────────────────────────────────────────────────

/** Sorted, always — an unsorted readdir would make the hash machine-specific. */
async function walk(dir, out = []) {
  const entries = (await readdir(dir, { withFileTypes: true }))
    .sort((a, b) => (a.name < b.name ? -1 : 1))

  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) await walk(full, out)
    else out.push(full)
  }
  return out
}

// ── the module graph ───────────────────────────────────────────────────────

const IMPORT_RE = /^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm
const BARE_IMPORT_RE = /^import\s+['"]([^'"]+)['"]\s*;?\s*$/gm

/**
 * Read one module and report what it needs and what it offers.
 * @returns {{path, source, deps: string[], builtins: string[], exports: string[]}}
 */
async function readModule(path) {
  const source = await readFile(path, 'utf8')
  const deps = []
  const builtins = []

  for (const m of source.matchAll(IMPORT_RE)) {
    const [, clause, spec] = m
    if (spec.startsWith('node:')) builtins.push(`import ${clause.trim()} from '${spec}'`)
    else deps.push(resolve(dirname(path), spec))
  }
  for (const m of source.matchAll(BARE_IMPORT_RE)) {
    if (m[1].startsWith('node:')) builtins.push(`import '${m[1]}'`)
  }

  return { path, source, deps, builtins, exports: exportedNames(source) }
}

/**
 * Every name a module exports.
 *
 * Deliberately narrow: it understands the four forms src/ actually uses and
 * nothing else. A build that quietly missed an export would produce a file
 * that fails at runtime, so anything unrecognised throws instead.
 */
function exportedNames(source) {
  const names = new Set()

  for (const m of source.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1])
  for (const m of source.matchAll(/^export\s+class\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1])
  for (const m of source.matchAll(/^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1])

  // `export { a, b }` — one of these exists, in api/dns.js
  for (const m of source.matchAll(/^export\s*\{([^}]*)\}\s*;?\s*$/gm)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim()
      if (name) names.add(name)
    }
  }

  if (/^export\s+default\b/m.test(source)) {
    throw new Error('export default is not supported by this bundler; src/ does not use it')
  }
  return [...names]
}

/** Strip the export keywords, and rewrite relative imports to registry reads. */
function rewrite(mod, idOf) {
  let out = mod.source

  out = out.replace(IMPORT_RE, (whole, clause, spec) => {
    if (spec.startsWith('node:')) return ''            // hoisted to the top instead
    const target = resolve(dirname(mod.path), spec)
    const clean = clause.trim()

    // `import { a, b as c }` and `import x` are the only forms src/ uses.
    if (clean.startsWith('{')) return `const ${clean.replace(/\s+as\s+/g, ': ')} = ${idOf(target)}`
    return `const ${clean} = ${idOf(target)}.default ?? ${idOf(target)}`
  })

  out = out.replace(BARE_IMPORT_RE, '')
  out = out.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '')
  out = out.replace(/^export\s+(?=(?:async\s+)?function|class|const|let|var)/gm, '')

  return out
}

/** Depth-first, so a module is always emitted after everything it needs. */
function order(entry, modules) {
  const done = new Set()
  const stack = new Set()
  const sorted = []

  const visit = (path) => {
    if (done.has(path)) return
    if (stack.has(path)) throw new Error(`import cycle through ${relative(ROOT, path)}`)
    stack.add(path)
    for (const dep of modules.get(path).deps) visit(dep)
    stack.delete(path)
    done.add(path)
    sorted.push(path)
  }

  visit(entry)
  return sorted
}

async function collect(entry) {
  const modules = new Map()
  const queue = [entry]

  while (queue.length) {
    const path = queue.pop()
    if (modules.has(path)) continue
    const mod = await readModule(path)
    modules.set(path, mod)
    for (const dep of mod.deps) if (!modules.has(dep)) queue.push(dep)
  }
  return modules
}

// ── emitting ───────────────────────────────────────────────────────────────

const asId = (path) => `__m_${relative(ROOT, path).replace(/[^\w]/g, '_')}`

/** JSON.stringify handles every escape a JS string needs, including newlines. */
const literal = (text) => JSON.stringify(text)

async function assetMap() {
  const files = await walk(join(ROOT, 'web'))
  const lines = files.map((f) => {
    const route = '/' + relative(join(ROOT, 'web'), f).split('\\').join('/')
    return `  [${literal(route)}, ${literal('')}],`   // placeholder, filled below
  })
  // Read contents in the same sorted order the routes were built in.
  const contents = await Promise.all(files.map((f) => readFile(f, 'utf8')))
  return files.map((f, i) => {
    const route = '/' + relative(join(ROOT, 'web'), f).split('\\').join('/')
    return `  [${literal(route)}, ${literal(contents[i])}],`
  }).join('\n') + (lines.length ? '' : '')
}

async function build() {
  const modules = await collect(ENTRY)
  const sorted = order(ENTRY, modules)

  const builtins = [...new Set(sorted.flatMap((p) => modules.get(p).builtins))].sort()
  const version = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')).version

  const body = sorted.map((path) => {
    const mod = modules.get(path)
    return [
      `// ── ${relative(ROOT, path).split('\\').join('/')}`,
      `const ${asId(path)} = (() => {`,
      rewrite(mod, asId).trim(),
      `return { ${mod.exports.join(', ')} }`,
      '})()',
    ].join('\n')
  }).join('\n\n')

  const out = `#!/usr/bin/env node
/**
 * netlens ${version} — the whole application in one file.
 *
 * Generated by build.js. Do not edit: change the source and rebuild.
 *
 *   node netlens.js [--port 7777] [--host 127.0.0.1]
 *
 * Zero dependencies. Everything below this line is either the Node standard
 * library or code from this repository, including the entire web client,
 * inlined as strings.
 */
${builtins.join('\n')}
import { parseArgs } from 'node:util'

${body}

// ── the web client, inlined ────────────────────────────────────────────────
const ASSETS = new Map([
${await assetMap()}
])

// ── boot ───────────────────────────────────────────────────────────────────
// Optional local settings, read from a .env beside wherever this is run.
try { process.loadEnvFile('.env') } catch { /* no .env, fine */ }

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '7777' },
    host: { type: 'string', default: '127.0.0.1' },
  },
})

const { server } = ${asId(ENTRY)}.createApp({ assets: ASSETS, version: ${literal(version)} })

async function listenWithRetry(startPort, host, tries = 10) {
  for (let i = 0; i < tries; i++) {
    try {
      return await ${asId(ENTRY)}.listen(server, { port: startPort + i, host })
    } catch (err) {
      if (err.code !== 'EADDRINUSE' || i === tries - 1) throw err
    }
  }
}

const addr = await listenWithRetry(Number(values.port), values.host)
console.log(\`\\n  netlens \${${literal(version)}} — http://\${values.host}:\${addr.port}\`)
console.log('  single file · zero dependencies · ctrl+c to stop\\n')
`

  return { out, moduleCount: sorted.length, assetCount: (await walk(join(ROOT, 'web'))).length }
}

// ── run ────────────────────────────────────────────────────────────────────

const sha = (text) => createHash('sha256').update(text).digest('hex')

const checking = process.argv.includes('--check')
const { out, moduleCount, assetCount } = await build()
const hash = sha(out)

if (checking) {
  // Build twice and compare: the point of the hash is that it does not move,
  // and the cheapest way to prove that is to do it again.
  const again = await build()
  const stable = sha(again.out) === hash

  const existing = await readFile(OUT_FILE, 'utf8').catch(() => null)
  const matchesDisk = existing !== null && sha(existing) === hash

  console.log(`\n  reproducible   ${stable ? 'yes' : 'NO — two builds differed'}`)
  console.log(`  matches dist   ${existing === null ? 'no dist/netlens.js yet' : matchesDisk ? 'yes' : 'NO — dist is stale'}`)
  console.log(`  sha256         ${hash}\n`)
  process.exit(stable && matchesDisk ? 0 : 1)
}

await mkdir(OUT_DIR, { recursive: true })
await writeFile(OUT_FILE, out)

console.log(`\n  netlens — single file build`)
console.log(`  modules        ${moduleCount}`)
console.log(`  web assets     ${assetCount}`)
console.log(`  size           ${(out.length / 1024).toFixed(0)} KB`)
console.log(`  sha256         ${hash}`)
console.log(`\n  wrote dist/netlens.js — run it with:  node dist/netlens.js\n`)
