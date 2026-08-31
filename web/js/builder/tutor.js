
import { LESSONS, lessonById } from './lessons.js'
import * as store from './store.js'

const DONE_KEY = 'netlens.builder.completed'

export function mountTutor({ root, onStatus }) {
  let activeId = null
  let passed = new Set()      // step indices already satisfied in this run
  let hintFor = null          // step index whose hint is revealed
  let completed = loadCompleted()

  function open(id) {
    const lesson = lessonById(id)
    if (!lesson) return
    activeId = id
    passed = new Set()
    hintFor = null
    if (lesson.setup) {
      const topo = lesson.setup()
      store.loadTopology(topo)
      onStatus?.(`${lesson.title} — starting topology loaded`)
    } else {
      store.clear()
      onStatus?.(`${lesson.title} — start from an empty grid`)
    }
    store.clearLog()
  }

  function exit() {
    activeId = null
    hintFor = null
    store.touch()
  }

  /** Re-evaluate, then redraw. Called on every store change. */
  function paint(state) {
    const lesson = activeId ? lessonById(activeId) : null

    if (lesson) {
      lesson.steps.forEach((step, i) => {
        if (passed.has(i)) return
        // Steps complete in order: a later check passing early does not skip ahead.
        if (i > 0 && !passed.has(i - 1)) return
        let ok = false
        try { ok = Boolean(step.check(state)) } catch { ok = false }
        if (ok) {
          passed.add(i)
          onStatus?.(`step ${i + 1} complete`)
        }
      })
      if (passed.size === lesson.steps.length && !completed.has(lesson.id)) {
        completed.add(lesson.id)
        saveCompleted(completed)
      }
    }

    root.replaceChildren(lesson ? renderLesson(lesson) : renderIndex())
  }

  // ── the lesson list ───────────────────────────────────────────────────────

  function renderIndex() {
    const frag = document.createDocumentFragment()

    const intro = el('p', 'bd-tut__intro',
      'Six guided labs. Each one checks your grid as you build it, so nothing is graded at the end — the tutor just tells you what is not true yet.')
    frag.append(intro)

    const bar = el('div', 'bd-tut__overall')
    bar.append(el('span', 'bd-field__l', `${completed.size} OF ${LESSONS.length} COMPLETE`))
    const track = el('div', 'bd-bar')
    const fill = el('div', 'bd-bar__fill')
    fill.style.width = `${(completed.size / LESSONS.length) * 100}%`
    track.append(fill)
    bar.append(track)
    frag.append(bar)

    LESSONS.forEach((lesson, i) => {
      const card = el('button', 'bd-lesson')
      if (completed.has(lesson.id)) card.classList.add('is-done')

      const top = el('div', 'bd-lesson__top')
      top.append(
        el('span', 'bd-lesson__n', completed.has(lesson.id) ? '✓' : String(i + 1)),
        el('span', 'bd-lesson__t', lesson.title),
      )
      const meta = el('span', 'bd-lesson__meta', `${lesson.steps.length} steps · ~${lesson.minutes} min`)
      card.append(top, el('span', 'bd-lesson__g', lesson.goal), meta)
      card.addEventListener('click', () => { open(lesson.id); store.touch() })
      frag.append(card)
    })

    const free = el('button', 'bd-btn bd-btn--wide', 'FREE BUILD — no lesson')
    free.addEventListener('click', () => { store.clear(); onStatus?.('empty grid — build whatever you like') })
    frag.append(free)

    return frag
  }

  // ── a lesson in progress ──────────────────────────────────────────────────

  function renderLesson(lesson) {
    const frag = document.createDocumentFragment()
    const done = passed.size
    const finished = done === lesson.steps.length

    const back = el('button', 'bd-tut__back', '← all lessons')
    back.addEventListener('click', () => { exit() })
    frag.append(back)

    frag.append(el('h2', 'bd-tut__title', lesson.title))

    const track = el('div', 'bd-bar')
    const fill = el('div', 'bd-bar__fill')
    fill.style.width = `${(done / lesson.steps.length) * 100}%`
    track.append(fill)
    frag.append(track)
    frag.append(el('span', 'bd-tut__count', `${done} / ${lesson.steps.length} steps`))

    frag.append(el('p', 'bd-tut__intro', lesson.intro))

    const list = el('ol', 'bd-steps')
    lesson.steps.forEach((step, i) => {
      const li = el('li', 'bd-step')
      const isDone = passed.has(i)
      const isCurrent = !isDone && (i === 0 || passed.has(i - 1))
      if (isDone) li.classList.add('is-done')
      if (isCurrent) li.classList.add('is-current')

      li.append(el('span', 'bd-step__mark', isDone ? '✓' : isCurrent ? '▸' : ''))
      li.append(el('span', 'bd-step__text', step.text))

      if (isCurrent && step.hint) {
        if (hintFor === i) {
          li.append(el('span', 'bd-step__hint', step.hint))
        } else {
          const b = el('button', 'bd-mini', 'hint')
          b.addEventListener('click', () => { hintFor = i; store.touch() })
          li.append(b)
        }
      }
      list.append(li)
    })
    frag.append(list)

    if (finished) {
      const box = el('div', 'bd-tut__done')
      box.append(el('span', 'bd-field__l', 'LESSON COMPLETE'))
      box.append(el('p', 'bd-tut__outro', lesson.outro))
      const next = LESSONS[LESSONS.indexOf(lesson) + 1]
      if (next) {
        const b = el('button', 'bd-btn bd-btn--wide', `NEXT — ${next.title}`)
        b.addEventListener('click', () => { open(next.id); store.touch() })
        box.append(b)
      }
      frag.append(box)
    }

    const reset = el('button', 'bd-mini bd-mini--wide', 'restart this lesson')
    reset.addEventListener('click', () => { open(lesson.id); store.touch() })
    frag.append(reset)

    return frag
  }

  return { paint, open }
}

// ── persistence ─────────────────────────────────────────────────────────────

function loadCompleted() {
  try {
    const raw = localStorage.getItem(DONE_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function saveCompleted(set) {
  try { localStorage.setItem(DONE_KEY, JSON.stringify([...set])) } catch { /* private mode */ }
}

function el(tag, cls, text) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}
