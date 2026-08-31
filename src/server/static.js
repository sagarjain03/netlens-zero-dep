/**
 * static.js — serves web/ with no framework. Replaces `serve-static` / `express.static`.
 *
 * Two modes, one code path:
 *   dev     → read from disk on every request (edit + refresh, no rebuild)
 *   bundled → read from an in-memory asset map that build.js inlines
 *
 * The bundled mode is what makes the single-file bonus possible: dist/netlens.js
 * carries the whole web/ directory as string constants.
 */
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize, sep } from 'node:path'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

/**
 * @param {object} opts
 * @param {string} [opts.root]    directory to serve from (dev mode)
 * @param {Map<string,string>} [opts.assets]  path -> content (bundled mode)
 */
export function createStaticHandler({ root, assets = null }) {
  return async function serve(req, res, urlPath) {
    // "/" -> index.html
    let rel = urlPath === '/' ? '/index.html' : urlPath

    // Reject traversal before it ever touches the filesystem.
    const clean = normalize(rel).split(sep).join('/')
    if (clean.includes('..')) {
      res.writeHead(403).end('Forbidden')
      return true
    }

    const type = MIME[extname(clean)] ?? 'application/octet-stream'

    // ── bundled mode ────────────────────────────────────────────────────────
    if (assets) {
      const body = assets.get(clean) ?? assets.get(clean.replace(/^\//, ''))
      if (body === undefined) return false
      const buf = Buffer.from(body, 'utf8')
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': buf.length,
        'Cache-Control': 'no-store',
      })
      res.end(buf)
      return true
    }

    // ── dev mode ────────────────────────────────────────────────────────────
    const full = join(root, clean)
    try {
      const info = await stat(full)
      if (!info.isFile()) return false
      const buf = await readFile(full)
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': buf.length,
        // No caching in dev: a hackathon is 72 hours of hard refreshes otherwise.
        'Cache-Control': 'no-store',
      })
      res.end(buf)
      return true
    } catch {
      return false
    }
  }
}
