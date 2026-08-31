/**
 * build.test.js — the single-file build.
 *
 * Two claims are being made by dist/netlens.js, and both are testable without
 * writing anything to disk:
 *
 *   it is reproducible   two builds of the same tree are byte-identical, so
 *                        the printed hash means something
 *   it is self-contained no import in it reaches outside the Node standard
 *                        library, and the whole web client is inside it
 *
 * The bundler is small and hand-written, so this also pins the assumptions it
 * relies on: named exports only, relative or `node:` imports only. If somebody
 * adds an `export default` to src/, the build breaks loudly and so does this.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Run the builder in-process rather than shelling out for every assertion. */
const build = () => execFileSync(process.execPath, ['build.js'], { cwd: ROOT, encoding: 'utf8' })

const hashOf = (output) => output.match(/sha256\s+([0-9a-f]{64})/)?.[1] ?? null

describe('the build runs', () => {
  test('writes a file and reports a hash', () => {
    const out = build()
    assert.match(out, /wrote dist\/netlens\.js/)
    assert.ok(hashOf(out), 'no sha256 in the output')
  })

  test('the same tree builds to the same bytes', () => {
    // The whole value of the printed hash rests on this. An unsorted readdir
    // or a timestamp anywhere in the output would break it.
    assert.equal(hashOf(build()), hashOf(build()))
  })

  test('--check agrees with what is on disk', () => {
    build()
    const out = execFileSync(process.execPath, ['build.js', '--check'], { cwd: ROOT, encoding: 'utf8' })
    assert.match(out, /reproducible\s+yes/)
    assert.match(out, /matches dist\s+yes/)
  })
})

describe('what the built file contains', () => {
  const source = () => readFileSync(join(ROOT, 'dist', 'netlens.js'), 'utf8')

  /**
   * Only the bundled server code — everything from `const ASSETS` on is the
   * client, inlined as string literals. Those strings contain `import` lines
   * on purpose: the browser resolves them over HTTP from the asset map. An
   * assertion about "no relative imports" that swept them in would fail on
   * code that is doing exactly the right thing.
   */
  const serverPart = () => {
    const text = source()
    const at = text.indexOf('const ASSETS = new Map([')
    assert.ok(at > 0, 'no asset map in the build')
    return text.slice(0, at)
  }

  test('imports nothing outside the standard library', () => {
    const bad = [...serverPart().matchAll(/^import\s+[\s\S]*?from\s+['"]([^'"]+)['"]/gm)]
      .map((m) => m[1])
      .filter((spec) => !spec.startsWith('node:'))
    assert.deepEqual(bad, [], `built file reaches outside node: ${bad.join(', ')}`)
  })

  test('has no leftover relative imports — every module was inlined', () => {
    assert.equal(/from\s+['"]\.\.?\//.test(serverPart()), false,
      'a relative import survived bundling')
  })

  test('carries every web asset', () => {
    const webRoot = join(ROOT, 'web')
    const files = []
    const walk = (dir) => {
      for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else files.push('/' + relative(webRoot, full).split('\\').join('/'))
      }
    }
    walk(webRoot)

    const built = source()
    assert.ok(files.length > 40, 'expected the whole client')
    for (const route of files) {
      assert.ok(built.includes(JSON.stringify(route)), `missing asset: ${route}`)
    }
  })

  test('includes the topic modules the rail loads lazily', () => {
    // These arrive through a dynamic import() in the browser, so they are
    // easy to leave out of a bundle by accident.
    const built = source()
    for (const id of ['data-link', 'network', 'application', 'transport', 'session', 'basics', 'physical']) {
      assert.ok(built.includes(`/js/lesson/topics/${id}.js`), `missing topic module: ${id}`)
    }
  })

  test('is a runnable program, not just a library', () => {
    const built = source()
    assert.match(built, /^#!\/usr\/bin\/env node/, 'no shebang')
    assert.match(built, /createApp\(\{ assets: ASSETS/, 'not wired to the inlined assets')
    assert.match(built, /parseArgs/, 'no argument handling')
  })
})

describe('the assumptions the bundler relies on', () => {
  const srcFiles = () => {
    const out = []
    const walk = (dir) => {
      for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (name.endsWith('.js')) out.push(full)
      }
    }
    walk(join(ROOT, 'src'))
    return out
  }

  test('src uses named exports only', () => {
    for (const file of srcFiles()) {
      const text = readFileSync(file, 'utf8')
      assert.equal(/^export\s+default\b/m.test(text), false,
        `${relative(ROOT, file)} uses export default, which the bundler cannot inline`)
    }
  })

  test('src imports only node: builtins and relative paths', () => {
    for (const file of srcFiles()) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/^import\s+[\s\S]*?from\s+['"]([^'"]+)['"]/gm)) {
        const spec = m[1]
        assert.ok(spec.startsWith('node:') || spec.startsWith('.'),
          `${relative(ROOT, file)} imports ${spec}`)
      }
    }
  })
})
