/**
 * terminal.js — a terminal emulator in the browser. Replaces xterm.js (2M weekly).
 *
 * The trick that keeps this small: a real <input> is kept off-screen and holds
 * the authoritative text and caret. We mirror it into a styled <span>. That
 * gives us text selection, paste, word-jump, IME and mobile keyboards for free,
 * instead of reimplementing a line editor. Only the keys a terminal owns —
 * Enter, ↑/↓ history, Tab completion, Ctrl+L, Ctrl+C — are intercepted.
 */
import { el, clear as clearNode } from '../dom.js'

const HISTORY_KEY = 'netlens.history'
const HISTORY_MAX = 100

export function createTerminal({ out, line, hint, input, onSubmit, complete }) {
  let history = loadHistory()
  let historyIndex = history.length   // one past the end == the live line
  let draft = ''                      // the line being typed, parked during history browse
  let busy = false

  // ── rendering ─────────────────────────────────────────────────────────────

  function renderLine() {
    const text = input.value
    const caret = input.selectionStart ?? text.length
    clearNode(line)
    line.append(
      document.createTextNode(text.slice(0, caret)),
      el('span.term__cursor'),
      document.createTextNode(text.slice(caret)),
    )
    hint.textContent = busy ? 'working…' : (complete?.hintFor(text) ?? '')
  }

  const atBottom = () => out.scrollHeight - out.scrollTop - out.clientHeight < 40

  function scrollToBottom() {
    out.scrollTop = out.scrollHeight
  }

  // ── output ────────────────────────────────────────────────────────────────

  /** One output line. `kind` maps to the t-* classes in app.css. */
  function print(text = '', kind = '') {
    const stick = atBottom()
    out.appendChild(el('div', { class: kind ? `t-${kind}` : '' }, String(text)))
    if (stick) scrollToBottom()
  }

  const printLines = (lines, kind) => {
    for (const l of [lines].flat()) print(l, kind)
  }

  /** Echo the command the way a shell does, so scrollback reads as a transcript. */
  function echo(cmd) {
    const stick = atBottom()
    out.appendChild(el('div', el('span.t-out', '$ '), el('span.t-cmd', cmd)))
    if (stick) scrollToBottom()
  }

  function clearScreen() {
    clearNode(out)
  }

  /** Append a node directly — used for rich rows like the answer table. */
  function printNode(node) {
    const stick = atBottom()
    out.appendChild(node)
    if (stick) scrollToBottom()
  }

  // ── input handling ────────────────────────────────────────────────────────

  function setLine(text, caret = text.length) {
    input.value = text
    input.setSelectionRange(caret, caret)
    renderLine()
  }

  async function submit() {
    const cmd = input.value.trim()
    setLine('')
    if (!cmd) { print(''); return }

    echo(cmd)
    pushHistory(cmd)

    busy = true
    renderLine()
    try {
      await onSubmit(cmd)
    } catch (err) {
      print(err.message || String(err), 'err')
    } finally {
      busy = false
      renderLine()
      scrollToBottom()
    }
  }

  function browseHistory(delta) {
    if (!history.length) return
    if (historyIndex === history.length) draft = input.value
    const next = Math.min(history.length, Math.max(0, historyIndex + delta))
    if (next === historyIndex) return
    historyIndex = next
    setLine(next === history.length ? draft : history[next])
  }

  function pushHistory(cmd) {
    if (history[history.length - 1] !== cmd) history.push(cmd)
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX)
    historyIndex = history.length
    draft = ''
    saveHistory(history)
  }

  input.addEventListener('keydown', (e) => {
    if (busy && e.key !== 'c') { if (e.key === 'Enter') e.preventDefault(); return }

    switch (true) {
      case e.key === 'Enter':
        e.preventDefault()
        submit()
        return

      case e.key === 'ArrowUp':
        e.preventDefault()
        browseHistory(-1)
        return

      case e.key === 'ArrowDown':
        e.preventDefault()
        browseHistory(+1)
        return

      case e.key === 'Tab':
        e.preventDefault()
        if (complete) {
          const filled = complete.apply(input.value)
          if (filled !== null) setLine(filled)
          else {
            const options = complete.options(input.value)
            if (options.length > 1) {
              print(options.join('   '), 'dim')
            }
          }
        }
        return

      case e.key === 'l' && e.ctrlKey:
        e.preventDefault()
        clearScreen()
        return

      case e.key === 'c' && e.ctrlKey:
        e.preventDefault()
        if (input.value) { echo(input.value + ' ^C'); setLine('') }
        return

      default:
        // Everything else is ordinary text editing; let the input handle it and
        // re-render on the next tick so the caret position is already updated.
        queueMicrotask(renderLine)
    }
  })

  input.addEventListener('input', renderLine)
  input.addEventListener('click', renderLine)
  input.addEventListener('select', renderLine)

  // Clicking anywhere in the terminal focuses it — unless text is being selected.
  for (const node of [out, line.parentElement]) {
    node.addEventListener('mousedown', (e) => {
      if (getSelection()?.toString()) return
      if (e.target.closest('a, button')) return
      setTimeout(() => input.focus(), 0)
    })
  }

  renderLine()

  return {
    print,
    printLines,
    printNode,
    echo,
    clear: clearScreen,
    focus: () => input.focus(),
    setLine,
    run: (cmd) => { setLine(cmd); return submit() },
    get history() { return [...history] },
  }
}

// ── history persistence ─────────────────────────────────────────────────────

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : []
  } catch {
    return []   // private mode, disabled storage — a terminal without history still works
  }
}

function saveHistory(history) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) } catch { /* ignore */ }
}
