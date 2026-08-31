/**
 * dom.js — element creation and querying.
 * Replaces: jQuery, React.createElement, htm, lit-html.
 *
 *   el('div.card#main', { onclick }, 'text', el('span', 'child'))
 *
 * Tag string supports  tag.class.class#id  so most markup needs no attrs object.
 * Spaces inside a segment are treated as further class names, so both
 * `div.a.b` and the CSS-like `div.a b` work — classList.add rejects a token
 * containing a space, and having that throw mid-render is not worth the
 * strictness.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

export const el = (tagSpec, ...rest) => make(null, tagSpec, rest)

/**
 * The same builder in the SVG namespace, for the ladder diagrams and topology
 * views. `createElement` silently produces an inert HTML element for `line` or
 * `circle`, so these genuinely need `createElementNS` rather than a shortcut.
 *
 *   svg('svg', { viewBox: '0 0 100 40' }, svg('line.wire', { x1: 0, y1: 0 }))
 */
export const svg = (tagSpec, ...rest) => make(SVG_NS, tagSpec, rest)

function make(ns, tagSpec, rest) {
  const [tag, ...mods] = tagSpec.split(/(?=[.#])/)
  const name = tag.trim() || (ns ? 'g' : 'div')
  const node = ns ? document.createElementNS(ns, name) : document.createElement(name)

  for (const m of mods) {
    const [first, ...extra] = m.slice(1).trim().split(/\s+/).filter(Boolean)
    if (!first) continue
    if (m[0] === '#') node.id = first
    else node.classList.add(first)
    for (const cls of extra) node.classList.add(cls)
  }

  let children = rest
  const first = rest[0]
  const isProps = first && typeof first === 'object' && !(first instanceof Node) && !Array.isArray(first)
  if (isProps) {
    children = rest.slice(1)
    for (const [k, v] of Object.entries(first)) {
      if (v == null || v === false) continue
      if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v)
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v)
      else if (k === 'dataset') Object.assign(node.dataset, v)
      else if (k === 'html') node.innerHTML = v
      // An SVG element's `className` is a read-only SVGAnimatedString, so
      // assigning to it does nothing and the class is silently lost.
      else if (k === 'class') { if (ns) node.setAttribute('class', v); else node.className = v }
      else node.setAttribute(k, v === true ? '' : String(v))
    }
  }

  append(node, children)
  return node
}

export function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)))
  }
  return node
}

/**
 * Is a keystroke aimed at something the user is typing into?
 *
 * Every global shortcut in the app asks this first. It checks that `matches`
 * exists rather than calling it blind: a keydown can arrive with `window` or
 * `document` as its target, and those have no `matches`. Unguarded, the
 * handler throws and the shortcut silently stops working for the rest of the
 * session, with the cause nowhere near the symptom.
 */
export const typingInto = (target) =>
  typeof target?.matches === 'function'
  && target.matches('input, textarea, select, [contenteditable]')

export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild)
  return node
}

/** Replace a container's children in one shot. */
export function render(node, ...children) {
  clear(node)
  return append(node, children)
}

/** Escape text destined for an innerHTML string. */
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ))
