/**
 * router.js — hash routing. Replaces react-router / page.js.
 *
 * Two route shapes, because the app has two ways in:
 *
 *   #/ch/<chapter>/tier/<tier>   the journey — a story taken once, in order
 *   #/topic/<id>                 the syllabus — reference, entered anywhere
 *
 * Hash routing (not the History API) means the server needs no catch-all
 * rewrite and the single-file build works when opened from any path.
 */
import { set, get } from './state.js'
import { IDS } from './lesson/topics/index.js'

const DEFAULT = { mode: 'journey', chapter: 1, tier: 1, topic: null }

export function parseHash(hash = location.hash) {
  const topic = /^#\/topic\/([a-z0-9-]+)/i.exec(hash)
  if (topic) {
    const id = topic[1].toLowerCase()
    // An unknown id falls back rather than routing to a blank page — a stale
    // bookmark from before a topic was renamed should still land somewhere.
    if (IDS.includes(id)) return { ...DEFAULT, mode: 'topics', topic: id }
    return { ...DEFAULT, mode: 'topics', topic: IDS[0] }
  }

  const ch = /^#\/ch\/(\d+)(?:\/tier\/(\d+))?/.exec(hash)
  if (!ch) return { ...DEFAULT }
  return {
    mode: 'journey',
    chapter: clamp(Number(ch[1]), 1, 8),
    tier: clamp(Number(ch[2] ?? 1), 1, 3),
    topic: null,
  }
}

export function toHash(route) {
  if (route.mode === 'topics' && route.topic) return `#/topic/${route.topic}`
  return `#/ch/${route.chapter}/tier/${route.tier}`
}

function navigate(next) {
  if (location.hash === next) applyHash()
  else location.hash = next
}

export function go(chapter, tier = 1) {
  navigate(toHash({ mode: 'journey', chapter: clamp(chapter, 1, 8), tier: clamp(tier, 1, 3) }))
}

export function goTier(tier) {
  const s = get()
  // Tier only means something inside the journey; from a topic it returns you
  // to the chapter you were last reading rather than doing nothing.
  go(s.chapter, tier)
}

export function goTopic(id) {
  navigate(toHash({ mode: 'topics', topic: id }))
}

function applyHash() {
  const route = parseHash()
  const s = get()
  const changed = s.mode !== route.mode
    || s.chapter !== route.chapter
    || s.tier !== route.tier
    || s.topic !== route.topic
  if (changed) set(route)
}

export function startRouter() {
  addEventListener('hashchange', applyHash)
  if (!location.hash) location.replace(toHash(DEFAULT))
  applyHash()
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo))
