/**
 * resize.js — a draggable divider between the stage and the terminal.
 *
 * The terminal used to be a fixed height that collapsed to a sliver on tier 1,
 * which meant the very first screen told you to type a command and then gave
 * you nowhere to read the answer. It is the input device for the whole app, so
 * it is never smaller than a few readable lines, and how much room it gets is
 * the learner's choice rather than ours: a traceroute wants a tall terminal,
 * watching the canvas wants a short one.
 *
 * The height lives in a CSS custom property on the grid, so the layout, the
 * canvas ResizeObserver and the inspector all follow without any of them
 * knowing a drag happened.
 */
const KEY = 'netlens.termHeight'
const MIN = 132          // prompt plus about five lines of output
const DEFAULT = 248
const MAX_FRACTION = 0.72

export function createTerminalResizer({ appNode, gripNode }) {
  let height = load()
  apply(height)

  function apply(px) {
    height = clamp(px)
    appNode.style.setProperty('--term-h', `${height}px`)
  }

  function clamp(px) {
    const max = Math.max(MIN, Math.round(window.innerHeight * MAX_FRACTION))
    return Math.min(max, Math.max(MIN, Math.round(px)))
  }

  // ── dragging ──────────────────────────────────────────────────────────────

  let dragging = false
  let startY = 0
  let startH = 0

  function onPointerDown(e) {
    // Ignore secondary buttons so a right-click never starts a drag.
    if (e.button !== 0) return
    dragging = true
    startY = e.clientY
    startH = height
    // Capture keeps the pointer with the grip even when it moves faster than
    // the layout follows, but the drag is tracked by `dragging` rather than by
    // asking whether capture succeeded — that would silently do nothing on any
    // browser that declines it.
    try { gripNode.setPointerCapture(e.pointerId) } catch { /* not essential */ }
    gripNode.classList.add('term__grip--dragging')
    document.body.style.cursor = 'row-resize'
    // Stops the drag from selecting terminal text as it passes over it.
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  function onPointerMove(e) {
    if (!dragging) return
    // Dragging up makes the terminal taller, so the delta is inverted.
    apply(startH - (e.clientY - startY))
  }

  function onPointerUp(e) {
    if (!dragging) return
    dragging = false
    try { gripNode.releasePointerCapture(e.pointerId) } catch { /* already gone */ }
    gripNode.classList.remove('term__grip--dragging')
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    save(height)
  }

  gripNode.addEventListener('pointerdown', onPointerDown)
  // Also on the window: if the pointer leaves the 9px grip mid-drag and capture
  // was refused, the drag must still track and must still end.
  gripNode.addEventListener('pointermove', onPointerMove)
  addEventListener('pointermove', onPointerMove)
  gripNode.addEventListener('pointerup', onPointerUp)
  addEventListener('pointerup', onPointerUp)
  addEventListener('pointercancel', onPointerUp)

  // Double-click toggles between the default and a tall terminal — quicker than
  // dragging when a traceroute is about to print twenty lines.
  gripNode.addEventListener('dblclick', () => {
    const tall = Math.round(window.innerHeight * 0.55)
    apply(Math.abs(height - DEFAULT) < 24 ? tall : DEFAULT)
    save(height)
  })

  // Keyboard access, because a drag handle alone is not reachable for everyone.
  gripNode.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 64 : 16
    if (e.key === 'ArrowUp') { apply(height + step); save(height); e.preventDefault() }
    else if (e.key === 'ArrowDown') { apply(height - step); save(height); e.preventDefault() }
  })

  // A window that shrinks must not leave the terminal taller than the viewport.
  addEventListener('resize', () => apply(height))

  return {
    get height() { return height },
    set: (px) => { apply(px); save(height) },
    reset: () => { apply(DEFAULT); save(height) },
  }
}

function load() {
  try {
    const raw = Number(localStorage.getItem(KEY))
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT
  } catch {
    return DEFAULT          // private mode — a fixed height still works
  }
}

function save(px) {
  try { localStorage.setItem(KEY, String(px)) } catch { /* ignore */ }
}

export const TERM_MIN = MIN
export const TERM_DEFAULT = DEFAULT
