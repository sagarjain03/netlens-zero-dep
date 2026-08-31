/**
 * routes.js — a route table. Replaces `express`.
 *
 * Handlers are registered as `METHOD /path` and receive
 * ({ req, res, body, query, params }). Chapters plug their endpoints in here;
 * server.js stays a dumb listener that knows nothing about protocols.
 */
import { sendError, readJsonBody } from './respond.js'

export function createRouter() {
  /** @type {Map<string, Function>} */
  const exact = new Map()

  return {
    /** @param {string} key  e.g. "POST /api/dns" */
    add(key, handler) {
      exact.set(key, handler)
      return this
    },

    /** @returns {boolean} true if a route handled the request */
    async handle(req, res, urlPath, query) {
      const handler = exact.get(`${req.method} ${urlPath}`)
      if (!handler) return false

      let body = {}
      if (req.method === 'POST' || req.method === 'PUT') {
        try {
          body = await readJsonBody(req)
        } catch (err) {
          sendError(res, err.message, 400)
          return true
        }
      }

      try {
        await handler({ req, res, body, query })
      } catch (err) {
        // Handlers talk to the real network — surface the real reason, not a 500 page.
        sendError(res, err.message || 'internal error', 500, { code: err.code ?? null })
      }
      return true
    },

    list() {
      return [...exact.keys()].sort()
    },
  }
}
