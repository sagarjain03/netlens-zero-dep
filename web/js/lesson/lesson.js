/**
 * lesson.js — the one renderer that draws all eight chapters.
 *
 * Reads a chapter data file (web/js/lesson/chapters/*.js) and the current
 * tier, and paints the card that floats over the canvas. It knows nothing
 * about DNS, TLS or HTTP; it knows about beats, steps and points. That is
 * what keeps eight chapters from becoming eight code paths.
 *
 * Three tiers, three shapes:
 *   1 STORY       one beat at a time, revealed on click. Never a wall of text.
 *   2 DO_IT       numbered steps, each with a Run button that drives the
 *                 terminal, and a payoff line that appears once it has run.
 *   3 REAL_BYTES  its own runnable steps first, then the deeper points and
 *                 the byte-editor experiments.
 *
 * Nothing here ever says "try it yourself" and stops. Every instruction the
 * card gives carries the exact command next to it, on a button that runs it —
 * a beginner should never have to guess what to type.
 *
 * The card is fixed to the viewport and draggable by its title bar to anywhere
 * on the window, over any panel. It remembers where it was put.
 */
import { el, $, render, typingInto } from '../dom.js'
import { get, set, subKeys } from '../state.js'
import { goTier, go, goTopic } from '../router.js'
import { chapter } from './chapters/index.js'
import { entry, moduleOf, neighbours, loadTopic, hasContent } from './topics/index.js'
import { pick, lines } from './format.js'
import { measured } from './facts.js'
import { linkify } from './terms.js'
import { isCheckable } from './check.js'

// Which beat of the story the learner has reached, and how each step went.
// Kept in module scope rather than the store: it is presentation, nobody else
// subscribes to it, and it should reset when the page does.
const beatAt = new Map()
const steps = new Map()   // "chapterId:tier:index" -> { status, chips }

const POS_KEY = 'netlens.lesson.pos'

const stepKey = (chId, tier, i) => `${chId}:${tier}:${i}`
const statusOf = (key) => steps.get(key)?.status ?? 'idle'

export function createLesson({ node, terminal, onLab }) {
  let lastChapter = null
  let lastTopic = null
  let loaded = null        // the topic content currently on screen
  let loading = false

  const draw = () => {
    const state = get()

    node.hidden = !state.lessonOpen
    if (!state.lessonOpen) { render(node); return }

    if (state.mode === 'topics') { drawTopic(state); return }

    const ch = chapter(state.chapter)
    const lang = state.narrationLang

    // Moving to a new chapter always restarts its story.
    if (lastChapter !== ch.id) {
      lastChapter = ch.id
      if (!beatAt.has(ch.id)) beatAt.set(ch.id, 0)
    }

    render(node,
      head(ch, lang),
      state.tier === 1 ? story(ch, lang)
        : state.tier === 2 ? doIt(ch, lang)
          : realBytes(ch, lang),
    )

    // Done last, over the finished card: every glossary word becomes clickable
    // without a single term being tagged by hand in the chapter files.
    linkify(node)
    clampIntoView()
  }

  /**
   * Run one step and report what actually happened.
   *
   * The old version ticked the step the moment the button was pressed, which
   * lied whenever the network refused. We compare the envelope identity before
   * and after instead: `setResult` always installs a fresh array, so a command
   * that produced nothing leaves the old one in place and the step fails
   * honestly rather than showing a green tick over an error.
   */
  async function runStep(ch, tier, i, command) {
    const key = stepKey(ch.id, tier, i)
    const before = get().events

    steps.set(key, { status: 'running' })
    markVisited(ch.id)
    draw()

    try {
      await terminal.run(command)
    } catch { /* the terminal has already printed it */ }

    const after = get()
    const ok = after.events !== before && after.events.length > 0
    steps.set(key, { status: ok ? 'done' : 'failed', chips: ok ? measured(after) : [] })
    draw()
  }

  // ── tier 1 ─────────────────────────────────────────────────────────────
  function story(ch, lang) {
    const beats = ch.tier1.beats
    const at = Math.min(beatAt.get(ch.id) ?? 0, beats.length - 1)
    const last = at >= beats.length - 1
    const firstCommand = ch.tier2.steps[0]?.run

    return el('div.lsn__body',
      el('p.lsn__question', pick(ch.question, lang)),

      // Every beat up to the current one stays on screen, so the argument
      // accumulates instead of replacing itself.
      beats.slice(0, at + 1).map((b, i) => el('div.lsn__beat',
        { class: `lsn__beat${i === at ? ' lsn__beat--new' : ''}` },
        lines(b.text, lang).map((line) => el('p.lsn__line', line)),
        b.art ? el('pre.lsn__art', b.art) : null,
      )),

      last ? el('div.lsn__hook', pick(ch.tier1.hook, lang)) : null,

      // The story never ends on an instruction with no command attached: the
      // last screen hands over the first thing to actually run.
      last
        ? el('div.lsn__handoff',
          el('div.lsn__handoffSay', lang === 'hi'
            ? 'Ab isse khud chalao:'
            : 'Now run this yourself:'),
          runButton(firstCommand, lang, () => {
            goTier(2)
            runStep(ch, 2, 0, firstCommand)
          }),
        )
        : null,

      el('div.lsn__actions',
        last
          ? el('button.lsn__cta', { onclick: () => goTier(2) },
            lang === 'hi' ? 'Saare steps dekho  ▶' : 'See all the steps  ▶')
          : el('button.lsn__cta', {
            onclick: () => { beatAt.set(ch.id, at + 1); draw() },
          }, lang === 'hi' ? 'Aage  ▶' : 'Next  ▶'),

        el('span.lsn__count', `${at + 1} / ${beats.length}`),
      ),
    )
  }

  // ── tier 2 ─────────────────────────────────────────────────────────────
  const doIt = (ch, lang) => el('div.lsn__body',
    el('p.lsn__intro', pick(ch.tier2.intro, lang)),
    labHandoff(ch, lang),
    stepList(ch, lang, ch.tier2.steps, 2),
    challenge(ch, lang),
  )

  /**
   * A chapter whose point is best made by a lab hands over to it, exactly as
   * a topic does. Only chapters 4 and 8 declare one — the six that run on live
   * traffic have a real packet to show instead, which is better than a model.
   */
  const labHandoff = (ch, lang) => (ch.lab
    ? el('div.lsn__handoff',
      ch.labSay ? el('div.lsn__handoffSay', pick(ch.labSay, lang)) : null,
      el('button.lsn__run', {
        onclick: () => { onLab?.(ch.lab); terminal?.run(`lab ${ch.lab}`) },
      }, el('span.lsn__runIcon', '▶'), el('code', `lab ${ch.lab}`)),
    )
    : null)

  // ── tier 3 ─────────────────────────────────────────────────────────────
  function realBytes(ch, lang) {
    const edits = ch.tier3.edits ?? []
    const steps = ch.tier3.steps ?? []

    return el('div.lsn__body',
      el('p.lsn__intro', pick(ch.tier3.intro, lang)),

      steps.length ? stepList(ch, lang, steps, 3) : null,

      el('ul.lsn__points', ch.tier3.points.map((p) =>
        el('li.lsn__point', pick(p, lang)))),

      edits.length ? el('div.lsn__edits',
        el('div.lsn__editsHead', lang === 'hi' ? 'BYTE BADAL KE DEKHO' : 'CHANGE A BYTE'),
        el('div.lsn__editsHow', lang === 'hi'
          ? 'Upar wali command chalao, phir tree me field chuno aur uski value badal do:'
          : 'Run the command above, then select the field in the tree and change its value:'),
        edits.map((e) => el('div.lsn__edit',
          el('code.lsn__editField', e.field),
          el('span.lsn__editArrow', '→'),
          el('code.lsn__editTo', e.to),
          el('div.lsn__editResult', pick(e.result, lang)),
        )),
      ) : null,

      challenge(ch, lang),
    )
  }

  // ── shared bits ────────────────────────────────────────────────────────

  /** The numbered, runnable list. Tier 2 and tier 3 both render through it. */
  function stepList(ch, lang, list, tier) {
    return el('ol.lsn__steps', list.map((step, i) => {
      const key = stepKey(ch.id, tier, i)
      const status = statusOf(key)
      const chips = steps.get(key)?.chips ?? []

      return el('li.lsn__step', { class: `lsn__step lsn__step--${status}` },
        el('div.lsn__stepSay', pick(step.say, lang)),

        el('div.lsn__stepRow',
          runButton(step.run, lang, () => runStep(ch, tier, i, step.run), status),
          status === 'running' ? el('span.lsn__spin', lang === 'hi' ? 'ja raha hai…' : 'sending…') : null,
          status === 'done' ? el('span.lsn__tick', '✓') : null,
          status === 'failed' ? el('span.lsn__cross', '✕') : null,
        ),

        // The payoff, and under it the numbers that only existed once the
        // packet came back. The lesson is never describing a hypothetical.
        status === 'done' ? el('div.lsn__stepAfter',
          el('div', pick(step.after, lang)),
          chips.length ? el('div.lsn__chips', chips.map((c) => el('span.lsn__chip',
            el('span.lsn__chipLabel', c.label),
            el('span.lsn__chipValue', c.value),
          ))) : null,
        ) : null,

        status === 'failed' ? el('div.lsn__stepFailed', lang === 'hi'
          ? 'Kuch wapas nahi aaya. Terminal me neeche wajah likhi hai — aksar network block ya galat naam hota hai. Dobara try karo.'
          : 'Nothing came back. The terminal below says why — usually a blocked network or a name that does not resolve. Try it again.')
          : null,
      )
    }))
  }

  const runButton = (command, lang, onclick, status = 'idle') => el('button.lsn__run', {
    class: `lsn__run${status === 'running' ? ' lsn__run--busy' : ''}`,
    title: lang === 'hi' ? 'Terminal me chalao' : 'Run it in the terminal',
    disabled: status === 'running',
    onclick,
  }, el('span.lsn__runIcon', '▶'), el('code', command))

  function head(ch, lang) {
    return el('div.lsn__head',
      el('span.lsn__grip', {
        title: lang === 'hi' ? 'Kheench ke hilao · double-click se wapas' : 'Drag to move · double-click to reset',
      }, '⣿'),
      el('span.lsn__num', String(ch.id).padStart(2, '0')),
      el('span.lsn__title', ch.title),
      el('span.lsn__proto', ch.proto),
      el('button.lsn__close', {
        title: lang === 'hi' ? 'Chhupao (L)' : 'Hide (L)',
        onclick: () => set({ lessonOpen: false }),
      }, '─'),
    )
  }

  /**
   * The challenge always ships with the command that sets it up.
   *
   * Two kinds, and the difference is stated rather than blurred: one is met
   * when the network does a particular thing, and ticks by itself. The other
   * asks for an explanation, which no envelope can confirm — so it says so
   * instead of ticking green for having run a command.
   */
  function challenge(ch, lang) {
    const checked = isCheckable(ch.challenge.verify)
    const done = Boolean(get().progress[ch.id]?.challengeDone)

    return el('div.lsn__challenge', { class: `lsn__challenge${done ? ' lsn__challenge--done' : ''}` },
      el('div.lsn__challengeHead',
        el('span', 'CHALLENGE'),
        checked
          ? el('span.lsn__challengeState', { class: `lsn__challengeState${done ? ' lsn__challengeState--done' : ''}` },
            done
              ? (lang === 'hi' ? 'ho gaya \u2713' : 'done \u2713')
              : (lang === 'hi' ? 'checked hoga' : 'checked automatically'))
          : el('span.lsn__challengeState', lang === 'hi' ? 'khud jawaab do' : 'answer this yourself'),
      ),
      el('div.lsn__challengeBody', pick(ch.challenge.ask, lang)),
      ch.challenge.run
        ? el('div.lsn__challengeRun',
          el('span.lsn__challengeStart', lang === 'hi' ? 'Yahan se shuru karo' : 'Start here'),
          runButton(ch.challenge.run, lang, () => {
            markVisited(ch.id)
            terminal.run(ch.challenge.run)
          }),
        )
        : null,
    )
  }

  function markVisited(id) {
    const progress = get().progress
    if (progress[id]?.visited) return
    set({ progress: { ...progress, [id]: { ...progress[id], visited: true } } })
  }

  // ── topics ─────────────────────────────────────────────────────────────
  //
  // Same card, same steps, same glossary. A topic is content, so it renders
  // through the pieces the chapters already use rather than a second engine.

  function drawTopic(state) {
    const meta = entry(state.topic)
    const lang = state.narrationLang

    if (!meta) { render(node, missing(lang)); return }

    // Content arrives from a dynamic import, so the first draw for a topic
    // shows the frame and fills it in when the module lands.
    if (lastTopic !== state.topic) {
      lastTopic = state.topic
      loaded = null
      if (hasContent(state.topic)) {
        loading = true
        loadTopic(state.topic).then((t) => {
          loading = false
          // Ignore a load that finished after the learner moved on.
          if (get().topic !== state.topic) return
          loaded = t
          draw()
        })
      }
    }

    render(node,
      topicHead(meta, lang),
      el('div.lsn__body',
        loaded
          ? topicBody(meta, loaded, lang)
          : loading
            ? el('p.lsn__intro', lang === 'hi' ? 'khul raha hai…' : 'opening…')
            : notWritten(meta, lang),
        topicNav(state.topic, lang),
      ),
    )

    linkify(node)
    clampIntoView()
  }

  const topicHead = (meta, lang) => el('div.lsn__head',
    el('span.lsn__grip', {
      title: lang === 'hi' ? 'Kheench ke hilao \u00b7 double-click se wapas' : 'Drag to move \u00b7 double-click to reset',
    }, '\u28ff'),
    el('span.lsn__num', 'TOPIC'),
    el('span.lsn__title', meta.title),
    el('span.lsn__proto', moduleOf(meta.id)?.title ?? ''),
    el('button.lsn__close', {
      title: lang === 'hi' ? 'Chhupao (L)' : 'Hide (L)',
      onclick: () => set({ lessonOpen: false }),
    }, '\u2500'),
  )

  function topicBody(meta, topic, lang) {
    const beats = topic.beats ?? []
    const at = Math.min(beatAt.get(`t:${meta.id}`) ?? 0, Math.max(0, beats.length - 1))
    const last = at >= beats.length - 1

    return [
      topic.question ? el('p.lsn__question', pick(topic.question, lang)) : null,

      beats.slice(0, at + 1).map((b, i) => el('div.lsn__beat',
        { class: `lsn__beat${i === at ? ' lsn__beat--new' : ''}` },
        lines(b.text, lang).map((line) => el('p.lsn__line', line)),
        b.art ? el('pre.lsn__art', b.art) : null,
      )),

      !last
        ? el('div.lsn__actions',
          el('button.lsn__cta', {
            onclick: () => { beatAt.set(`t:${meta.id}`, at + 1); draw() },
          }, lang === 'hi' ? 'Aage  \u25b6' : 'Next  \u25b6'),
          el('span.lsn__count', `${at + 1} / ${beats.length}`),
        )
        : null,

      last && topic.hook ? el('div.lsn__hook', pick(topic.hook, lang)) : null,

      // The lab is the point of most topics, so it gets its own affordance
      // rather than being buried in a sentence.
      last && topic.lab
        ? el('div.lsn__handoff',
          topic.labSay ? el('div.lsn__handoffSay', pick(topic.labSay, lang)) : null,
          el('button.lsn__run', {
            onclick: () => { onLab?.(topic.lab); terminal?.run(`lab ${topic.lab}`) },
          }, el('span.lsn__runIcon', '\u25b6'), el('code', `lab ${topic.lab}`)),
        )
        : null,

      last && topic.steps?.length ? stepList({ id: `t:${meta.id}` }, lang, topic.steps, 2) : null,

      last && topic.points?.length
        ? el('ul.lsn__points', topic.points.map((p) => el('li.lsn__point', pick(p, lang))))
        : null,

      last && topic.challenge
        ? el('div.lsn__challenge',
          el('div.lsn__challengeHead', 'CHALLENGE'),
          el('div.lsn__challengeBody', pick(topic.challenge.ask, lang)),
          topic.challenge.run
            ? el('div.lsn__challengeRun',
              el('span.lsn__challengeStart', lang === 'hi' ? 'Yahan se shuru karo' : 'Start here'),
              runButton(topic.challenge.run, lang, () => terminal?.run(topic.challenge.run)),
            )
            : null,
        )
        : null,

      // The cross-link back into the journey. This is the move a textbook
      // cannot make: the same idea, on a packet that just left the machine.
      last && meta.see
        ? el('div.lsn__seeChapter',
          el('span', lang === 'hi'
            ? 'Ise asli packet pe dekhna hai?'
            : 'Want to see this on a real packet?'),
          el('button.lsn__cta', { onclick: () => go(meta.see, 1) },
            lang === 'hi'
              ? `Chapter ${String(meta.see).padStart(2, '0')} kholo  \u25b6`
              : `Open chapter ${String(meta.see).padStart(2, '0')}  \u25b6`),
        )
        : null,
    ]
  }

  const notWritten = (meta, lang) => el('div',
    el('p.lsn__question', lang === 'hi'
      ? 'Is topic ka content abhi likha nahi gaya.'
      : 'This topic has not been written yet.'),
    el('p.lsn__intro', lang === 'hi'
      ? 'Syllabus poora list kiya gaya hai taaki pata rahe kya aana baaki hai. Jo topics tayyar hain unke aage rail me nishaan laga hai.'
      : 'The whole syllabus is listed so you can see what is still to come. The topics that are ready are marked in the rail.'),
    meta.see
      ? el('div.lsn__seeChapter',
        el('span', lang === 'hi' ? 'Iske kareeb ka chapter:' : 'The nearest chapter:'),
        el('button.lsn__cta', { onclick: () => go(meta.see, 1) },
          `Chapter ${String(meta.see).padStart(2, '0')}  \u25b6`),
      )
      : null,
  )

  const missing = (lang) => el('div.lsn__body',
    el('p.lsn__intro', lang === 'hi' ? 'Aisa koi topic nahi hai.' : 'No such topic.'))

  /** Walk the syllabus without going back to the rail. */
  function topicNav(id, lang) {
    const { prev, next } = neighbours(id)
    if (!prev && !next) return null
    return el('div.lsn__topicNav',
      prev
        ? el('button.lsn__navBtn', { onclick: () => goTopic(prev.id) }, '\u25c0 ', prev.title)
        : el('span'),
      next
        ? el('button.lsn__navBtn', { onclick: () => goTopic(next.id) }, next.title, ' \u25b6')
        : null,
    )
  }

  // ── dragging ───────────────────────────────────────────────────────────
  //
  // The card overlaps whatever is under it by design, which means it will
  // sooner or later sit on top of the one thing somebody wants to look at.
  // Rather than guess a safe corner, let them put it anywhere on the window
  // and remember where they put it. It is position:fixed, so the coordinates
  // it stores are viewport coordinates and survive any panel opening.

  let drag = null

  const bounds = () => ({
    maxX: Math.max(0, innerWidth - node.offsetWidth),
    maxY: Math.max(0, innerHeight - node.offsetHeight),
  })

  const clamp = (n, max) => Math.max(0, Math.min(n, max))

  function place(x, y) {
    const { maxX, maxY } = bounds()
    const top = clamp(y, maxY)
    node.style.left = `${clamp(x, maxX)}px`
    node.style.top = `${top}px`
    // The CSS cap assumes the card is near the top. Once it has been dragged
    // down, the room left below it is what actually limits its height.
    node.style.maxHeight = `${Math.max(160, innerHeight - top - 12)}px`
  }

  /**
   * A resize, or a longer chapter, can leave a saved position off-screen.
   *
   * With no position of its own the card sits at the top-left of the canvas,
   * read from the live layout rather than hard-coded — so it lands correctly
   * whether or not the rail and the inspector are open.
   */
  function clampIntoView() {
    if (node.hidden) return
    if (!node.style.left) {
      const viz = document.querySelector('.viz')
      if (!viz) return
      const box = viz.getBoundingClientRect()
      place(box.left + 12, box.top + 12)
      return
    }
    place(parseFloat(node.style.left), parseFloat(node.style.top))
  }

  node.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.lsn__head')
    if (!grip || e.target.closest('.lsn__close') || e.button !== 0) return

    drag = {
      dx: e.clientX - node.offsetLeft,
      dy: e.clientY - node.offsetTop,
      id: e.pointerId,
    }
    node.setPointerCapture(e.pointerId)
    node.classList.add('lesson--dragging')
    e.preventDefault()
  })

  node.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    place(e.clientX - drag.dx, e.clientY - drag.dy)
  })

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return
    drag = null
    node.classList.remove('lesson--dragging')
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({
        left: parseFloat(node.style.left),
        top: parseFloat(node.style.top),
      }))
    } catch { /* private mode — the card still moved, it just will not persist */ }
  }
  node.addEventListener('pointerup', endDrag)
  node.addEventListener('pointercancel', endDrag)

  // Double-click the title bar to put it back in the corner.
  node.addEventListener('dblclick', (e) => {
    if (!e.target.closest('.lsn__head')) return
    node.style.left = ''
    node.style.top = ''
    node.style.maxHeight = ''
    try { localStorage.removeItem(POS_KEY) } catch { /* ignore */ }
  })

  addEventListener('resize', clampIntoView)

  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null')
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      node.style.left = `${saved.left}px`
      node.style.top = `${saved.top}px`
    }
  } catch { /* ignore */ }

  // `progress` is in here so the challenge badge flips the moment one is
  // earned, rather than on the next navigation.
  subKeys(['chapter', 'tier', 'topic', 'mode', 'narrationLang', 'lessonOpen', 'progress'], draw)
  draw()

  return { draw }
}

/** The button in the header corner, and the L shortcut, both toggle the card. */
export function wireLessonToggle(buttonSelector) {
  const btn = $(buttonSelector)
  const sync = () => {
    if (!btn) return
    const open = get().lessonOpen
    btn.classList.toggle('iconbtn--on', open)
    btn.title = open ? 'Hide the lesson (L)' : 'Show the lesson (L)'
  }

  btn?.addEventListener('click', () => set({ lessonOpen: !get().lessonOpen }))
  subKeys(['lessonOpen'], sync)
  sync()

  addEventListener('keydown', (e) => {
    if (typingInto(e.target)) return
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'l' || e.key === 'L') set({ lessonOpen: !get().lessonOpen })
  })
}
