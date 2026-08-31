
import { spec, CABLES } from './devices.js'
import * as store from './store.js'
import { audit } from './net.js'

const NODE_W = 96
const NODE_H = 72

export function mountCanvas({ stage, nodesLayer, wires, onStatus, onPdu }) {
  let dragging = null

  // ── placing a new device (drag from the palette) ──────────────────────────
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('is-target') })
  stage.addEventListener('dragleave', () => stage.classList.remove('is-target'))
  stage.addEventListener('drop', (e) => {
    e.preventDefault()
    stage.classList.remove('is-target')
    const kind = e.dataTransfer.getData('text/netlens-device')
    if (!kind) return
    const r = stage.getBoundingClientRect()
    const n = store.addNode(kind, e.clientX - r.left - NODE_W / 2 + stage.scrollLeft,
      e.clientY - r.top - NODE_H / 2 + stage.scrollTop)
    if (n) onStatus?.(`placed ${n.name}`)
  })

  // ── clicking a device ─────────────────────────────────────────────────────
  nodesLayer.addEventListener('click', (e) => {
    const box = e.target.closest('.bd-node')
    if (!box) return
    const id = box.dataset.id
    const { tool, pending, cableKind } = store.get()

    if (tool === 'delete') {
      const name = store.node(id)?.name
      store.removeNode(id)
      onStatus?.(`removed ${name}`)
      return
    }

    if (tool === 'pdu') {
      if (!pending) {
        store.set({ pending: id })
        onStatus?.(`sending from ${store.node(id).name} — now click the destination`)
        return
      }
      const from = pending
      const to = store.node(id)
      store.set({ pending: null })
      const ip = to?.ip
      if (!ip) { onStatus?.(`${to?.name ?? 'that device'} has no IP address to send to`); return }
      onPdu?.(from, ip)
      return
    }

    if (tool === 'cable') {
      if (!pending) {
        store.set({ pending: id })
        onStatus?.(`from ${store.node(id).name} — now click the other device`)
        return
      }
      const res = store.addLink(pending, id, cableKind)
      store.set({ pending: null })
      onStatus?.(res.ok
        ? `wired ${store.node(pending)?.name ?? '?'} to ${store.node(id).name}`
        : `cannot wire: ${res.reason}`)
      return
    }

    store.set({ selected: id })
  })

  // ── dragging a device around ──────────────────────────────────────────────
  nodesLayer.addEventListener('pointerdown', (e) => {
    if (store.get().tool !== 'select') return
    const box = e.target.closest('.bd-node')
    if (!box) return
    const r = stage.getBoundingClientRect()
    const n = store.node(box.dataset.id)
    dragging = { id: n.id, dx: e.clientX - r.left - n.x, dy: e.clientY - r.top - n.y, moved: false }
    box.setPointerCapture(e.pointerId)
    box.classList.add('is-dragging')
  })

  nodesLayer.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const r = stage.getBoundingClientRect()
    dragging.moved = true
    store.moveNode(dragging.id,
      clamp(e.clientX - r.left - dragging.dx, 0, stage.scrollWidth - NODE_W),
      clamp(e.clientY - r.top - dragging.dy, 0, stage.scrollHeight - NODE_H))
  })

  const endDrag = () => {
    if (!dragging) return
    nodesLayer.querySelector('.is-dragging')?.classList.remove('is-dragging')
    dragging = null
  }
  nodesLayer.addEventListener('pointerup', endDrag)
  nodesLayer.addEventListener('pointercancel', endDrag)

  // ── clicking a cable removes it, when the delete tool is on ───────────────
  wires.addEventListener('click', (e) => {
    const line = e.target.closest('[data-link]')
    if (!line) return
    if (store.get().tool !== 'delete') return
    store.removeLink(line.dataset.link)
    onStatus?.('cable removed')
  })

  // ── render ────────────────────────────────────────────────────────────────
  function paint(state) {
    const problems = audit(state)
    const worst = new Map()
    for (const p of problems) {
      if (worst.get(p.id) !== 'err') worst.set(p.id, p.level)
    }

    drawWires(wires, state)

    nodesLayer.replaceChildren(...state.nodes.map((n) => {
      const s = spec(n.kind)
      const box = document.createElement('div')
      box.className = 'bd-node'
      box.dataset.id = n.id
      box.style.left = `${n.x}px`
      box.style.top = `${n.y}px`
      if (state.selected === n.id) box.classList.add('is-selected')
      if (state.pending === n.id) box.classList.add('is-pending')
      const level = worst.get(n.id)
      if (level) box.classList.add(level === 'err' ? 'is-err' : 'is-warn')

      const glyph = document.createElement('span')
      glyph.className = 'bd-node__glyph'
      glyph.textContent = s.glyph

      const name = document.createElement('span')
      name.className = 'bd-node__name'
      name.textContent = n.name

      const sub = document.createElement('span')
      sub.className = 'bd-node__sub'
      sub.textContent = s.hasIp ? (n.ip || 'no address') : `L${s.layer}`

      const ports = document.createElement('span')
      ports.className = 'bd-node__ports'
      ports.textContent = `${store.linksOf(n.id).length}/${n.ports}`

      box.append(glyph, name, sub, ports)
      box.title = `${n.name} — ${s.blurb}`
      return box
    }))
  }

  return { paint }
}

function drawWires(svg, state) {
  const pos = new Map(state.nodes.map((n) => [n.id, { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 }]))
  const ns = 'http://www.w3.org/2000/svg'

  svg.replaceChildren(...state.links.flatMap((l) => {
    const a = pos.get(l.a); const b = pos.get(l.b)
    if (!a || !b) return []
    const cable = CABLES[l.kind] ?? CABLES.copper

    // A fat invisible line underneath makes the cable easy to click.
    const hit = document.createElementNS(ns, 'line')
    const line = document.createElementNS(ns, 'line')
    for (const el of [hit, line]) {
      el.setAttribute('x1', a.x); el.setAttribute('y1', a.y)
      el.setAttribute('x2', b.x); el.setAttribute('y2', b.y)
      el.dataset.link = l.id
    }
    hit.setAttribute('class', 'bd-wire__hit')
    line.setAttribute('class', 'bd-wire')
    line.setAttribute('stroke', `var(${cable.colorVar})`)
    if (cable.dash) line.setAttribute('stroke-dasharray', cable.dash)
    return [hit, line]
  }))
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
