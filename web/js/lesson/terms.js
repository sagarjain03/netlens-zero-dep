/**
 * terms.js — makes every glossary word on screen clickable.
 *
 * The alternative was tagging terms by hand inside the chapter files. That
 * fails twice over: an author forgets one, and the same word has to be tagged
 * again in all eight chapters. Instead we walk the rendered text once and let
 * the glossary decide what is a term.
 *
 * Two rules keep it from turning the card into a field of underlines:
 *   · only the first occurrence of each term per render is linked
 *   · code, pre and the ASCII diagrams are never touched — a byte value that
 *     happens to spell a word is not a word
 */
import { el, $ } from '../dom.js'
import { get } from '../state.js'
import { go } from '../router.js'
import { GLOSSARY, KEYS, define } from './glossary.js'

const SKIP = new Set(['CODE', 'PRE', 'BUTTON', 'SCRIPT', 'STYLE'])

// Built once. Alternation is longest-first (KEYS is sorted that way), so the
// regex engine prefers "subnet mask" over "mask" at the same position.
const PATTERN = new RegExp(
  `\\b(${KEYS.map(escapeRe).join('|')})\\b`,
  'gi',
)

/**
 * Wrap known terms inside `root` in clickable buttons.
 * Safe to call after every render; it only ever adds elements.
 */
export function linkify(root) {
  const seen = new Set()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      for (let p = node.parentElement; p && p !== root; p = p.parentElement) {
        if (SKIP.has(p.tagName) || p.classList.contains('gl')) return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const targets = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) targets.push(n)

  for (const node of targets) replaceIn(node, seen)
}

function replaceIn(node, seen) {
  const text = node.nodeValue
  PATTERN.lastIndex = 0

  let match
  let cursor = 0
  let frag = null

  while ((match = PATTERN.exec(text))) {
    const key = match[0].toLowerCase()
    if (seen.has(key) || !GLOSSARY[key]) continue
    seen.add(key)

    frag = frag || document.createDocumentFragment()
    frag.appendChild(document.createTextNode(text.slice(cursor, match.index)))
    frag.appendChild(chip(match[0], key))
    cursor = match.index + match[0].length
  }

  if (!frag) return
  frag.appendChild(document.createTextNode(text.slice(cursor)))
  node.parentNode.replaceChild(frag, node)
}

const chip = (shown, key) => el('button.gl', {
  dataset: { term: key },
  title: 'What does this mean?',
  onclick: (e) => { e.stopPropagation(); open(key, e.currentTarget) },
}, shown)

// ── the popover ──────────────────────────────────────────────────────────
//
// One node, reused. Positioned in viewport coordinates and nudged back inside
// the window, so a term near the right edge does not open off screen.

let pop = null

function ensure() {
  if (pop) return pop
  pop = el('div.glpop', { hidden: true })
  document.body.appendChild(pop)

  addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !e.target.closest?.('.gl')) close()
  })
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close() })
  addEventListener('resize', close)
  return pop
}

function open(key, anchor) {
  const entry = define(key)
  if (!entry) return
  const lang = get().narrationLang
  const node = ensure()

  node.replaceChildren(
    el('div.glpop__head',
      el('span.glpop__term', entry.term),
      el('button.glpop__close', { title: 'Close', onclick: close }, '×'),
    ),
    el('p.glpop__body', entry[lang] || entry.en),
    entry.see
      ? el('button.glpop__see', {
        onclick: () => { close(); go(entry.see, 1) },
      }, lang === 'hi'
        ? `Chapter ${String(entry.see).padStart(2, '0')} me ise asli me dekho  ▶`
        : `See this for real in chapter ${String(entry.see).padStart(2, '0')}  ▶`)
      : null,
  )

  node.hidden = false

  // Measure after it is visible, then place it.
  const a = anchor.getBoundingClientRect()
  const p = node.getBoundingClientRect()
  const left = Math.max(8, Math.min(a.left, innerWidth - p.width - 8))
  const below = a.bottom + 6
  const top = below + p.height > innerHeight - 8 ? Math.max(8, a.top - p.height - 6) : below

  node.style.left = `${left}px`
  node.style.top = `${top}px`
}

function close() {
  if (pop) pop.hidden = true
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** How many glossary terms exist — the shell shows it as a badge. */
export const termCount = () => KEYS.length

export { close as closeTermPopover }
