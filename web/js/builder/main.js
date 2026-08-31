
import * as store from './store.js'
import { CABLES } from './devices.js'
import { mountCanvas } from './canvas.js'
import { mountPalette, paintProps } from './panels.js'
import { mountConsole } from './console.js'
import { mountTutor } from './tutor.js'
import { mountPdu } from './pdu.js'

const $ = (id) => document.getElementById(id)

const stage = $('stage')
const statusBar = $('status')
const setStatus = (text) => { statusBar.textContent = text }

const canvas = mountCanvas({
  stage,
  nodesLayer: $('nodes'),
  wires: $('wires'),
  onStatus: setStatus,
  onPdu: (srcId, dstIp) => pdu.fire(srcId, dstIp),
})

const pdu = mountPdu({
  stage,
  listRoot: $('pdu-list'),
  traceRoot: $('trace'),
  onStatus: setStatus,
})

mountPalette($('palette'), { onStatus: setStatus })

const term = mountConsole({
  out: $('console-out'),
  input: $('console-in'),
  who: $('console-who'),
  onSend: (srcId, dstIp) => pdu.fire(srcId, dstIp),
})

const tutor = mountTutor({ root: $('tutor-body'), onStatus: setStatus })

// Cable choices come from the catalogue, so adding a media type is one row there.
$('cable-kind').replaceChildren(...Object.values(CABLES).map((c) => {
  const o = document.createElement('option')
  o.value = c.id
  o.textContent = c.name
  return o
}))

// ── one subscription paints everything ──────────────────────────────────────

store.sub((state) => {
  canvas.paint(state)
  paintProps($('props-body'), state, { onStatus: setStatus })
  term.paint(state)
  tutor.paint(state)
  $('stat-count').textContent = `${state.nodes.length} DEVICE${state.nodes.length === 1 ? '' : 'S'}`
  $('empty-hint').hidden = state.nodes.length > 0
  stage.dataset.tool = state.tool
  for (const b of document.querySelectorAll('.bd-tool')) {
    b.classList.toggle('is-on', b.dataset.tool === state.tool)
  }
})

// ── toolbar ─────────────────────────────────────────────────────────────────

$('tools').addEventListener('click', (e) => {
  const b = e.target.closest('.bd-tool')
  if (b) setTool(b.dataset.tool)
})

function setTool(tool) {
  store.set({ tool, pending: null })
  setStatus(tool === 'cable' ? 'click one device, then another, to wire them'
    : tool === 'delete' ? 'click a device or a cable to remove it'
      : tool === 'pdu' ? 'click the sender, then the destination'
        : 'drag devices to move them')
}

$('cable-kind').addEventListener('change', (e) => store.set({ cableKind: e.target.value }))

$('btn-tutor').addEventListener('click', () => {
  const on = document.body.classList.toggle('is-tutor-hidden')
  $('btn-tutor').classList.toggle('is-on', !on)
})

$('btn-save').addEventListener('click', () => {
  const r = store.save()
  setStatus(r.ok ? 'saved to this browser' : `could not save: ${r.reason}`)
})
$('btn-load').addEventListener('click', () => {
  const r = store.load()
  setStatus(r.ok ? 'loaded' : `could not load: ${r.reason}`)
})
$('btn-example').addEventListener('click', () => {
  store.example()
  setStatus('a small office network — select PC0 and try:  dig github.com')
})
$('btn-clear').addEventListener('click', () => {
  store.clear()
  setStatus('cleared')
})

// ── keyboard ────────────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return
  if (e.key === 'v' || e.key === 'V') setTool('select')
  if (e.key === 'c' || e.key === 'C') setTool('cable')
  if (e.key === 'x' || e.key === 'X') setTool('delete')
  if (e.key === 'p' || e.key === 'P') setTool('pdu')
  if (e.key === 'Escape') { store.set({ pending: null, selected: null }); setStatus('ready') }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const id = store.get().selected
    if (id) { store.removeNode(id); setStatus('device removed') }
  }
})

// Start on lesson 1 rather than an empty page or a finished network.
tutor.open('first-contact')
store.touch()
setStatus('lesson 1 — drag two PCs onto the grid to begin')
