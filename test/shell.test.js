/**
 * shell.test.js — the HTML/JS contract.
 *
 * main.js reaches into index.html by id. A renamed or missing id fails silently
 * in the browser (querySelector returns null, the handler never fires, nothing
 * logs). This test makes that failure loud: every id main.js queries must exist
 * in index.html, and every stylesheet/script it links must be servable.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const html = readFileSync(join(ROOT, 'web/index.html'), 'utf8')

const jsSources = ['main.js', 'router.js', 'state.js', 'dom.js', 'api.js']
  .map((f) => readFileSync(join(ROOT, 'web/js', f), 'utf8'))
  .join('\n')

const idsInHtml = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))

describe('shell contract', () => {
  test('every #id queried by the client exists in index.html', () => {
    const queried = [...jsSources.matchAll(/\$\(\s*'#([\w-]+)'\s*\)/g)].map((m) => m[1])
    assert.ok(queried.length >= 8, `expected several id lookups, found ${queried.length}`)

    const missing = [...new Set(queried)].filter((id) => !idsInHtml.has(id))
    assert.deepEqual(missing, [], `client queries ids that index.html does not define: ${missing}`)
  })

  test('every local asset referenced by index.html exists on disk', () => {
    const refs = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((m) => m[1])
    const missing = refs.filter((r) => !existsSync(join(ROOT, 'web', r)))
    assert.deepEqual(missing, [], `index.html references files that do not exist: ${missing}`)
  })

  test('index.html loads nothing from a remote host', () => {
    const remote = [...html.matchAll(/(?:href|src)="((?:https?:)?\/\/[^"]+)"/g)].map((m) => m[1])
    assert.deepEqual(remote, [], 'a CDN/font link would be a runtime dependency')
  })

  test('every css variable used is declared somewhere', () => {
    // Design tokens live in theme.css; a purely structural one such as the
    // terminal height is declared on .app in app.css, which is still a
    // declaration. What must never happen is using a token nobody defines.
    const theme = readFileSync(join(ROOT, 'web/css/theme.css'), 'utf8')
    const app = readFileSync(join(ROOT, 'web/css/app.css'), 'utf8')
    const declared = new Set(
      [...theme.matchAll(/^\s*(--[\w-]+)\s*:/gm), ...app.matchAll(/^\s*(--[\w-]+)\s*:/gm)]
        .map((m) => m[1]),
    )
    const used = new Set([...app.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))
    const missing = [...used].filter((v) => !declared.has(v))
    assert.deepEqual(missing, [], `app.css uses undeclared tokens: ${missing}`)
  })

  test('tier is the single attribute that drives progressive disclosure', () => {
    // The layout must key off [data-tier] so tier 1 hides the inspector without JS.
    const app = readFileSync(join(ROOT, 'web/css/app.css'), 'utf8')
    assert.match(app, /\.app\[data-tier="3"\]/, 'tier 3 must widen the grid for the inspector')
    assert.match(jsSources, /dataset\.tier\s*=/, 'main.js must set data-tier')
  })
})

describe('dom · el()', () => {
  test('splits a class segment on whitespace instead of throwing', () => {
    // classList.add rejects a token containing a space. Before el() split on
    // whitespace, one such call threw mid-render and silently blanked the whole
    // edit bar - no error surfaced anywhere near the cause.
    const src = readFileSync(join(ROOT, 'web/js/dom.js'), 'utf8')
    assert.ok(src.includes('.trim().split('), 'el() must split a segment before adding classes')
    assert.ok(src.includes('for (const cls of extra) node.classList.add(cls)'),
      'the extra tokens must be added individually')
  })

  test('no caller passes a class list el() would reject', () => {
    // Belt and braces: scan every el() tag spec in the client for a form that
    // would have thrown before the fix.
    const files = ['main.js', 'inspect/tree.js', 'inspect/hex.js', 'inspect/bits.js',
      'inspect/editor.js', 'inspect/timeline.js', 'term/terminal.js']
    for (const f of files) {
      const src = readFileSync(join(ROOT, 'web/js', f), 'utf8')
      for (const m of src.matchAll(/\bel\(\s*'([^']+)'/g)) {
        const spec = m[1]
        assert.doesNotMatch(spec, /^[^.#]*\s/, `el('${spec}') in ${f}: tag name cannot contain a space`)
      }
    }
  })
})

describe('shell · the terminal is always usable', () => {
  const css = readFileSync(join(ROOT, 'web/css/app.css'), 'utf8')

  test('every layout gives the terminal the resizable height, never a fixed one', () => {
    // Tier 1 used to pin this row at 46px, so the very first screen a learner
    // saw told them to type a command and then gave them nowhere to read the
    // answer. Every row template — base and responsive alike — must defer to
    // the token the drag handle controls.
    // Only the shell grid: panes such as .inspector have their own row
    // templates and are none of this test's business. Matching innermost
    // `selector { … }` pairs also reaches inside the media query, where the
    // narrow-screen layout lives.
    const templates = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selector]) => /\.app\b/.test(selector))
      .flatMap(([, , body]) => [...body.matchAll(/grid-template-rows:\s*([^;]+);/g)])
      .map((m) => m[1].trim())

    assert.ok(templates.length >= 2, 'the base grid and the narrow-screen grid')
    for (const t of templates) {
      assert.match(t, /var\(--term-h\)\s*$/,
        `a shell row template must end with the terminal token, got "${t}"`)
    }
  })

  test('the terminal height is a custom property the drag handle can move', () => {
    assert.match(css, /--term-h:\s*(\d+)px/, 'a default height token')
    assert.match(css, /grid-template-rows:.*var\(--term-h\)/, 'the grid reads it')

    const fallback = Number(/--term-h:\s*(\d+)px/.exec(css)[1])
    assert.ok(fallback >= 200, `default ${fallback}px must fit several lines of output`)
  })

  test('the grip exists in the markup and is reachable by keyboard', () => {
    assert.match(html, /id="term-grip"/)
    assert.match(html, /term__grip[^>]*tabindex="0"/s, 'the divider must be focusable')
    assert.match(html, /role="separator"/)
  })

  test('resize.js keeps the terminal within sane bounds', () => {
    const src = readFileSync(join(ROOT, 'web/js/term/resize.js'), 'utf8')
    const min = Number(/const MIN = (\d+)/.exec(src)[1])
    const def = Number(/const DEFAULT = (\d+)/.exec(src)[1])
    assert.ok(min >= 120, `min ${min}px must still show the prompt and some output`)
    assert.ok(def > min, 'the default must be taller than the minimum')
    assert.match(src, /MAX_FRACTION/, 'and capped against the viewport')
  })

  test('a drag is tracked by its own flag, not by whether capture succeeded', () => {
    // Relying on hasPointerCapture made dragging silently do nothing wherever
    // the browser declined the capture.
    const src = readFileSync(join(ROOT, 'web/js/term/resize.js'), 'utf8')
    assert.doesNotMatch(src, /if \(!gripNode\.hasPointerCapture/, 'must not gate the drag on capture')
    assert.match(src, /let dragging = false/)
  })
})
