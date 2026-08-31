
import { simulatePdu } from './simulate.js'
import * as store from './store.js'

const NODE_W = 96
const NODE_H = 72
const TRAVEL = 520   // ms per hop
const PAUSE = 420    // ms sitting on a device while its explanation shows

export function mountPdu({ stage, listRoot, traceRoot, onStatus }) {
  let running = false
  let history = []      // { id, srcName, dstIp, ok, reason, steps }
  let seq = 1

  const envelope = document.createElement('div')
  envelope.className = 'bd-pdu'
  envelope.hidden = true
  stage.append(envelope)

  /** Fire a packet and animate it. Returns the simulation result. */
  async function fire(srcId, dstIp, { animate = true } = {}) {
    if (running) return null
    const topo = store.get()
    const src = topo.nodes.find((n) => n.id === srcId)
    if (!src) return null

    const result = simulatePdu(srcId, dstIp, topo)
    const record = {
      id: `p${seq++}`, srcName: src.name, dstIp,
      ok: result.ok, reason: result.reason, steps: result.steps, srcId,
    }
    history = [record, ...history].slice(0, 12)

    store.recordCommand({ cmd: 'send', args: [dstIp], devName: src.name, ok: result.ok })

    paintTrace(record, -1)
    paintList()

    if (animate && result.steps.length) await play(record)
    else onStatus?.(result.ok ? 'delivered' : result.reason)

    return result
  }

  // ── the animation ─────────────────────────────────────────────────────────

  async function play(record) {
    running = true
    stage.classList.add('is-running')
    const positions = centres()

    envelope.hidden = false
    envelope.className = 'bd-pdu'
    const first = positions.get(record.steps[0].nodeId)
    if (first) place(first)

    for (let i = 0; i < record.steps.length; i++) {
      const step = record.steps[i]
      const to = positions.get(step.nodeId)
      if (!to) continue

      if (i > 0) {
        const from = positions.get(record.steps[i - 1].nodeId)
        if (from) await glide(from, to)
      }

      paintTrace(record, i)
      flash(step.nodeId, step.kind)

      if (step.kind === 'drop') {
        envelope.classList.add('is-dead')
        envelope.textContent = '✕'
        onStatus?.(step.text)
        await wait(PAUSE * 2)
        break
      }
      envelope.textContent = step.kind === 'reply' ? '↩' : '✉'
      await wait(PAUSE)
    }

    if (record.ok) {
      envelope.classList.add('is-ok')
      onStatus?.(`delivered — ${record.srcName} → ${record.dstIp}, and the reply came back`)
      await wait(500)
    }

    envelope.hidden = true
    stage.classList.remove('is-running')
    running = false
  }

  function glide(from, to) {
    return new Promise((resolve) => {
      const t0 = performance.now()
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / TRAVEL)
        const e = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2   // ease in-out
        place({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e })
        if (p < 1) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
  }

  const place = (pt) => {
    envelope.style.left = `${pt.x}px`
    envelope.style.top = `${pt.y}px`
  }

  const centres = () => new Map(store.get().nodes.map((n) =>
    [n.id, { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 }]))

  function flash(nodeId, kind) {
    const box = stage.querySelector(`.bd-node[data-id="${nodeId}"]`)
    if (!box) return
    const cls = kind === 'drop' ? 'is-hit-bad' : 'is-hit'
    box.classList.add(cls)
    setTimeout(() => box.classList.remove(cls), kind === 'drop' ? 2000 : 700)
  }

  // ── the trace log ─────────────────────────────────────────────────────────

  function paintTrace(record, upto) {
    traceRoot.replaceChildren()

    const head = document.createElement('div')
    head.className = 'bd-trace__head'
    head.textContent = `${record.srcName} → ${record.dstIp}`
    traceRoot.append(head)

    record.steps.forEach((step, i) => {
      if (upto >= 0 && i > upto) return
      const row = document.createElement('div')
      row.className = `bd-trace__step is-${step.kind}`
      if (i === upto) row.classList.add('is-now')

      const t = document.createElement('span')
      t.className = 'bd-trace__t'
      t.textContent = `${String(i + 1).padStart(2, '0')}  ${step.title}`

      const d = document.createElement('span')
      d.className = 'bd-trace__d'
      d.textContent = step.text

      row.append(t, d)
      traceRoot.append(row)
    })

    if (upto < 0 || upto >= record.steps.length - 1) {
      const end = document.createElement('div')
      end.className = `bd-trace__end ${record.ok ? 'is-ok' : 'is-bad'}`
      end.textContent = record.ok ? '✓ delivered, reply received' : `✕ ${record.reason}`
      traceRoot.append(end)
    }
    traceRoot.scrollTop = traceRoot.scrollHeight
  }

  // ── the fired-packet list ─────────────────────────────────────────────────

  function paintList() {
    listRoot.replaceChildren()
    if (!history.length) {
      const p = document.createElement('p')
      p.className = 'bd-dim'
      p.textContent = 'press P, click a sender, then click a destination'
      listRoot.append(p)
      return
    }
    for (const rec of history) {
      const row = document.createElement('button')
      row.className = `bd-pdurow ${rec.ok ? 'is-ok' : 'is-bad'}`
      const dot = document.createElement('span')
      dot.className = 'bd-pdurow__dot'
      dot.textContent = rec.ok ? '●' : '●'
      const label = document.createElement('span')
      label.textContent = `${rec.srcName} → ${rec.dstIp}`
      const again = document.createElement('span')
      again.className = 'bd-pdurow__replay'
      again.textContent = 'replay'
      row.append(dot, label, again)
      row.addEventListener('click', () => fire(rec.srcId, rec.dstIp))
      listRoot.append(row)
    }
  }

  paintList()
  return { fire, isRunning: () => running }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
