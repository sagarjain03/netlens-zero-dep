/**
 * main.js — boot. Wires the store to the shell, the terminal and the timeline.
 *
 * The canvas, inspector and lesson engine plug into the same containers and the
 * same store in later blocks. Nothing here knows what a DNS packet is: commands
 * push an envelope into the store, and every view renders from that.
 */
import { el, $, render, typingInto } from './dom.js'
import { get, set, sub, subKeys } from './state.js'
import { startRouter, go, goTier, goTopic } from './router.js'
import { api } from './api.js'
import { createTerminal } from './term/terminal.js'
import { createDispatcher } from './term/commands.js'
import { createAutocomplete } from './term/autocomplete.js'
import { createTerminalResizer } from './term/resize.js'
import { createTimeline } from './inspect/timeline.js'
import { createViz } from './viz/canvas.js'
import { createTree } from './inspect/tree.js'
import { createHexView } from './inspect/hex.js'
import { createBitView } from './inspect/bits.js'
import { createEditor } from './inspect/editor.js'
import { createLesson, wireLessonToggle } from './lesson/lesson.js'
import { createBitsLab } from './sim/bits.js'
import { createTimelineLab } from './sim/timeline.js'
import { createAddressLab } from './sim/address.js'
import { createTopologyLab } from './sim/topology.js'
import { createComparisonLab } from './sim/comparison.js'
import { createLayersLab } from './sim/layers.js'
import { CHAPTERS, COUNT, chapter } from './lesson/chapters/index.js'
import { passes } from './lesson/check.js'
import { createAsk } from './lesson/ask.js'
import { createTour, hasSeenTour } from './tour.js'
import { MODULES, hasContent, coverage } from './lesson/topics/index.js'

const TIERS = [
  { id: 1, name: 'STORY', hint: 'read' },
  { id: 2, name: 'DO_IT', hint: 'run' },
  { id: 3, name: 'REAL_BYTES', hint: 'inspect' },
]

const pad2 = (n) => String(n).padStart(2, '0')

/** The bracketed pills in the header corner. */
function setStatus(selector, kind, text) {
  const node = $(selector)
  if (!node) return
  node.className = `tag tag--${kind}`
  node.textContent = text
}

// ── challenges ───────────────────────────────────────────────────────────
//
// Every envelope is offered to the current chapter's challenge. Four of the
// eight can be settled by one — the other four ask for an explanation, carry
// no verifier, and are never marked done by this. A tick that can be earned
// without understanding anything would be worth less than no tick.

const PROGRESS_KEY = 'netlens.progress'

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}')
    return saved && typeof saved === 'object' ? saved : {}
  } catch {
    return {}          // private mode, or somebody edited it by hand
  }
}

function saveProgress(progress) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)) } catch { /* ignore */ }
}

/**
 * Check the envelope that just landed. Only the chapter being read is
 * considered: solving chapter 5's challenge by accident while reading
 * chapter 2 is not something to celebrate.
 */
function checkChallenge(state, terminal) {
  const ch = chapter(state.chapter)
  if (!ch?.challenge?.verify) return
  if (state.progress[ch.id]?.challengeDone) return
  if (!passes(state, ch.challenge.verify)) return

  const progress = {
    ...state.progress,
    [ch.id]: { ...state.progress[ch.id], visited: true, challengeDone: true },
  }
  set({ progress })
  saveProgress(progress)

  terminal.print('')
  terminal.print(`  challenge complete — chapter ${pad2(ch.id)}`, 'ok')
  terminal.print('')
}

// ── theme ────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem('netlens.theme', theme) } catch { /* private mode */ }
}

// ── sidebar ──────────────────────────────────────────────────────────────
function renderChapters(state) {
  render($('#chapter-list'), CHAPTERS.map((ch) => {
    const done = state.progress[ch.id]?.challengeDone
    const active = state.chapter === ch.id
    return el('li', el('button.chapter', {
      class: `chapter${active ? ' chapter--active' : ''}${done ? ' chapter--done' : ''}`,
      onclick: () => go(ch.id, 1),
      'aria-current': active ? 'true' : null,
    },
    el('span.chapter__num', done ? '**' : pad2(ch.id)),
    el('span.chapter__title', ch.slug),
    el('span.chapter__real', { class: `chapter__real${ch.real ? ' chapter__real--live' : ''}` },
      ch.real ? 'REAL' : 'SIM'),
    ))
  }))
}

/** Two ways in, so two tabs. The rail shows one pane at a time. */
function renderTabs(state) {
  const TABS = [
    { id: 'journey', label: 'JOURNEY', hint: 'a story, in order' },
    { id: 'topics', label: 'TOPICS', hint: 'the syllabus' },
  ]

  render($('#side-tabs'), TABS.map((t) => el('button.sidetab', {
    class: `sidetab${state.mode === t.id ? ' sidetab--on' : ''}`,
    role: 'tab',
    'aria-selected': state.mode === t.id ? 'true' : 'false',
    title: t.hint,
    onclick: () => {
      if (t.id === 'topics') goTopic(state.topic ?? firstWritten())
      else go(state.chapter, state.tier)
    },
  }, t.label)))

  $('#pane-journey').hidden = state.mode !== 'journey'
  $('#pane-topics').hidden = state.mode !== 'topics'
}

const firstWritten = () =>
  MODULES.flatMap((m) => m.topics).find((t) => hasContent(t.id))?.id
  ?? MODULES[0].topics[0].id

/**
 * The whole syllabus is listed, including what is not written yet — a rail
 * that hid the gaps would be lying about how far along this is. Unwritten
 * topics are dimmed and still open, to a page that says so.
 */
function renderTopics(state) {
  render($('#topic-list'), MODULES.map((m) => el('div.topicgroup',
    el('div.topicgroup__head', m.title),
    el('ul', m.topics.map((t) => {
      const ready = hasContent(t.id)
      const active = state.topic === t.id
      return el('li', el('button.topic', {
        class: `topic${active ? ' topic--active' : ''}${ready ? '' : ' topic--todo'}`,
        onclick: () => goTopic(t.id),
        'aria-current': active ? 'true' : null,
      },
      el('span.topic__title', t.title),
      t.lab ? el('span.topic__lab', 'LAB') : null,
      ))
    })),
  )))

  const { written, total } = coverage()
  $('#topic-count').textContent = `${written}/${total}`
}

function renderTiers(state) {
  render($('#tier-list'), TIERS.map((t) => el('li',
    el('button.tier', {
      class: `tier${state.tier === t.id ? ' tier--active' : ''}`,
      dataset: { tier: String(t.id) },
      onclick: () => goTier(t.id),
    },
    el('span.tier__dot'),
    el('span', t.name),
    el('span.tier__hint', t.hint),
    ),
  )))
}

function renderProgressDots(state) {
  render($('#progress-dots'), CHAPTERS.map((ch) => {
    const done = state.progress[ch.id]?.challengeDone
    const now = state.chapter === ch.id
    return el('span.progress__dot', {
      class: `progress__dot${done ? ' progress__dot--done' : ''}${now ? ' progress__dot--now' : ''}`,
      title: `Chapter ${ch.id} — ${ch.title}`,
    })
  }))
}

function renderHeader(state) {
  if (state.mode === 'topics') {
    const mod = MODULES.find((m) => m.topics.some((t) => t.id === state.topic))
    const topic = mod?.topics.find((t) => t.id === state.topic)
    render($('#hdr-chapter'),
      crumb('ROOT'), sep(),
      crumb('TOPICS'), sep(),
      crumb(mod?.title ?? '', false), sep(),
      crumb(topic?.title ?? '', true),
    )
    $('#viz-watermark').textContent = ''
    document.title = `netlens — ${topic?.title ?? 'topics'}`
    return
  }

  const ch = CHAPTERS[state.chapter - 1]
  const tier = TIERS[state.tier - 1]

  // ROOT / CH_02 / NAMES_TO_NUMBERS / DO_IT
  render($('#hdr-chapter'),
    crumb('ROOT'), sep(),
    crumb(`CH_${pad2(ch.id)}`), sep(),
    crumb(ch.slug, state.tier === 1), sep(),
    crumb(tier.name, true),
  )

  $('#viz-watermark').textContent = pad2(ch.id)
  document.title = `netlens — CH_${pad2(ch.id)} ${ch.slug}`
}

const crumb = (text, current = false) =>
  el('span.crumbs__item', { class: `crumbs__item${current ? ' crumbs__item--current' : ''}` }, text)
const sep = () => el('span.crumbs__sep', '/')

/** Tier drives the whole layout via one attribute. Progressive disclosure in CSS. */
function applyTier(state) {
  // A topic has no tier — the byte inspector belongs to a chapter's third
  // depth, so from TOPICS the stage stays whole and the labs get the room.
  const tier = state.mode === 'topics' ? 1 : state.tier
  $('#app').dataset.tier = String(tier)
  $('#inspector').hidden = tier < 3
  $('#timeline').hidden = tier < 2 || state.events.length === 0
}

/** The canvas placeholder steps aside once there is something real to show. */
function applyVizEmpty(state) {
  const lessonOwnsIt = state.lessonOpen && (state.tier === 1 || state.mode === 'topics')
  $('#viz-empty').hidden = state.events.length > 0 || lessonOwnsIt || !!state.lab
}

// ── terminal ─────────────────────────────────────────────────────────────
function bootTerminal() {
  let terminal          // referenced by the autocomplete closure below
  const autocomplete = createAutocomplete({ historyOf: () => terminal?.history ?? [] })

  terminal = createTerminal({
    out: $('#term-out'),
    line: $('#term-line'),
    hint: $('#term-hint'),
    input: $('#term-input'),
    complete: autocomplete,
    onSubmit: (cmd) => dispatch(cmd),
  })

  const dispatch = createDispatcher(terminal)

  terminal.print('')
  terminal.print('  netlens — every command below sends a real packet.', 'dim')
  terminal.print('  type "help", or try "dig facebook.com"', 'dim')
  terminal.print('')

  return terminal
}

// ── boot ─────────────────────────────────────────────────────────────────
function boot() {
  let saved = 'dark'
  try { saved = localStorage.getItem('netlens.theme') || 'dark' } catch { /* ignore */ }
  set({ theme: saved })
  applyTheme(saved)

  $('#btn-theme').addEventListener('click', () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    // The attribute must change FIRST. Subscribers to `theme` re-read the CSS
    // custom properties, and the canvas caches what it reads — announcing the
    // change before making it left the canvas painted in the old palette.
    applyTheme(next)
    set({ theme: next })
  })


  // Re-render the shell whenever navigation or progress changes.
  subKeys(['chapter', 'tier', 'topic', 'mode', 'progress', 'events', 'lessonOpen', 'lab'], (s) => {
    renderTabs(s)
    renderChapters(s)
    renderTopics(s)
    renderTiers(s)
    renderProgressDots(s)
    renderHeader(s)
    applyTier(s)
    applyVizEmpty(s)
  })

  // Keyboard: 1/2/3 switch tier, [ ] move chapter — as long as focus isn't in a field.
  addEventListener('keydown', (e) => {
    // The terminal owns the keyboard whenever it has focus, and the byte editor
    // claims hex digits in the capture phase before this ever runs.
    if (typingInto(e.target)) return
    if (e.defaultPrevented) return
    if (e.key >= '1' && e.key <= '3') goTier(Number(e.key))
    else if (e.key === '[') go(Math.max(1, get().chapter - 1))
    else if (e.key === ']') go(Math.min(COUNT, get().chapter + 1))
    else if (e.key === 'm' || e.key === 'M') toggleNav()
  })

  createTimeline({
    listNode: $('#timeline-list'),
    sectionNode: $('#timeline'),
    narrationNode: $('#narration'),
  })

  createViz({ canvas: $('#canvas'), container: $('#viz') })

  createTerminalResizer({ appNode: $('#app'), gripNode: $('#term-grip') })
  const terminal = bootTerminal()

  // The inspector: four views, all driven by the one span the codec recorded.
  createTree({
    node: $('#field-tree'),
    tabsNode: $('#packet-tabs'),
    metaNode: $('#tree-meta'),
    explainNode: $('#explain-box'),
  })
  createHexView({ node: $('#hex-view'), metaNode: $('#hex-meta') })
  createBitView({ node: $('#bit-view') })
  createEditor({
    node: $('#edit-bar'),
    onLog: (text, kind) => terminal.print(text, kind),
  })

  // The chapter rail is a drawer. It starts open — a beginner should not have
  // to find the navigation — but the choice is remembered once they make one.
  const navBtn = $('#btn-nav')
  const applyNav = (open) => {
    $('#app').dataset.nav = open ? 'open' : 'closed'
    navBtn.setAttribute('aria-expanded', String(open))
    navBtn.title = open ? 'Hide the chapters (M)' : 'Show the chapters (M)'
  }
  const toggleNav = () => {
    const open = !get().navOpen
    set({ navOpen: open })
    try { localStorage.setItem('netlens.nav', open ? 'open' : 'closed') } catch { /* ignore */ }
  }
  navBtn.addEventListener('click', toggleNav)
  subKeys(['navOpen'], (s) => applyNav(s.navOpen))
  applyNav(get().navOpen)

  // A lab takes over the stage: there is no packet to animate, and the point
  // of these is that you operate them rather than watch them.
  const langOf = () => get().narrationLang
  // The later labs can drive the terminal and the chapter rail, which is what
  // keeps a diagram one click away from the real packet it describes.
  const ctx = { node: $('#lab'), langOf, terminal, onChapter: (n) => go(n, 1) }
  const LABS = {
    bits: createBitsLab(ctx),
    arq: createTimelineLab(ctx),
    addr: createAddressLab(ctx),
    topo: createTopologyLab(ctx),
    cmp: createComparisonLab(ctx),
    stack: createLayersLab(ctx),
  }
  // Every lab renders into the same container, so only one may hold it.
  const OWNER = {
    arq: 'arq', subnet: 'addr', ipv4: 'addr', topology: 'topo',
    compare: 'cmp', layers: 'stack',
  }
  const labFor = (kind) => LABS[OWNER[kind] ?? 'bits']

  const applyLab = (s) => {
    const on = !!s.lab
    $('#lab').hidden = !on
    $('#canvas').style.visibility = on ? 'hidden' : ''
    for (const l of Object.values(LABS)) l.close()
    if (on) labFor(s.lab.kind).load(s.lab.kind, s.lab)
  }
  subKeys(['lab'], applyLab)
  subKeys(['narrationLang'], (s) => { if (s.lab) labFor(s.lab.kind).draw() })

  createLesson({
    node: $('#lesson'),
    terminal,
    onLab: (kind) => set({ lab: { kind } }),
  })
  wireLessonToggle('#btn-lesson')

  // One toggle for every piece of teaching text: the lesson card, the timeline
  // narration and the field explanations all read narrationLang.
  const langBtn = $('#btn-lang')
  const syncLang = (s) => { langBtn.textContent = s.narrationLang.toUpperCase() }
  langBtn.addEventListener('click', () => {
    set({ narrationLang: get().narrationLang === 'en' ? 'hi' : 'en' })
  })
  subKeys(['narrationLang'], syncLang)
  syncLang(get())

  createAsk({ node: $('#ask'), langOf: () => get().narrationLang })

  // The tour drives the app rather than describing it, so it needs the shell
  // to exist first. The ? button restarts it; `tour` in the terminal does too.
  const tour = createTour({ node: $('#tour'), langOf: () => get().narrationLang })
  window.__netlensTour = tour
  $('#btn-help').addEventListener('click', () => tour.start())

  // Progress is remembered, so a challenge earned yesterday is still earned.
  set({ progress: loadProgress() })
  subKeys(['events'], (s) => checkChallenge(s, terminal))

  startRouter()

  // First visit only. Once finished or skipped it never appears unasked.
  if (!hasSeenTour()) setTimeout(() => tour.start(), 450)

  const s = get()
  renderTabs(s); renderChapters(s); renderTopics(s); renderTiers(s)
  renderProgressDots(s); renderHeader(s)
  applyTier(s); applyVizEmpty(s)

  // Clicking the suggestion in the empty state runs it, so the very first
  // interaction needs no typing.
  $('#viz-empty').addEventListener('click', (e) => {
    const code = e.target.closest('code')
    if (code) terminal.run(code.textContent)
  })
  $('#viz-empty').style.pointerEvents = 'auto'
  terminal.focus()

  // Prove the server is alive and show what it reports.
  api.health()
    .then((h) => {
      $('#side-meta').textContent = `NODE ${h.node} / ${h.mode}`
      $('#dep-badge').title = `${h.routes.length} routes, 0 dependencies`
      setStatus('#stat-net', 'ok', 'NET: OK')
    })
    .catch(() => {
      $('#side-meta').textContent = 'SERVER UNREACHABLE'
      setStatus('#stat-net', 'err', 'NET: DOWN')
    })
}

boot()
