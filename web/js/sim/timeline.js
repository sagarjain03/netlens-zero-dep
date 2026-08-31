/**
 * timeline.js — the sliding-window lab.
 *
 * A ladder diagram: sender on the left, receiver on the right, time running
 * down. Every diagonal is one transmission. A line that stops halfway with a
 * cross was lost. The arithmetic is all in arq.js — this file draws it and
 * lets you change the settings.
 *
 * The moment the chapter exists for is the comparison strip at the bottom:
 * the same channel, the same losses, three protocols. Because arq.js decides
 * loss from (seed, frame, attempt) rather than from a stream of dice rolls,
 * the only thing that differs between those three rows is the protocol.
 */
import { el, svg, render, clear } from '../dom.js'
import { simulate, compare, PROTOCOLS } from './arq.js'

const T = (en, hi) => ({ en, hi })
const say = (t, lang) => (typeof t === 'string' ? t : t[lang] || t.en)

const LABEL = {
  'stop-and-wait': T('Stop and wait', 'Stop and wait'),
  'go-back-n': T('Go-Back-N', 'Go-Back-N'),
  'selective-repeat': T('Selective Repeat', 'Selective Repeat'),
}

const BLURB = {
  'stop-and-wait': T(
    'Send one frame, then stop and wait for its acknowledgement before sending anything else. Simple, correct, and mostly spent waiting.',
    'Ek frame bhejo, phir uske acknowledgement ka intezaar karo, tab hi agla bhejo. Simple hai, sahi hai, aur zyadatar waqt sirf intezaar me jaata hai.',
  ),
  'go-back-n': T(
    'Keep several frames in flight. The receiver accepts them strictly in order and throws away anything early, so one loss means everything after it is sent again.',
    'Kai frames ek saath chalte rehte hain. Receiver sirf kram me leta hai aur jaldi aaye frame ko phenk deta hai, isliye ek loss ka matlab hai uske baad sab dobara.',
  ),
  'selective-repeat': T(
    'Keep several frames in flight, and let the receiver hold on to the ones that arrive early. Only the frame that was actually lost is sent again — paid for with memory at both ends.',
    'Kai frames ek saath, par receiver jo jaldi aa jaayein unhe sambhaal ke rakhta hai. Sirf wahi frame dobara jaata hai jo sach me khoya tha — iski keemat dono taraf memory hai.',
  ),
}

// Geometry of the ladder, in SVG user units.
const WIDE = 640        // viewBox width; the CSS scales it to the container
const LANE_L = 96
const LANE_R = 520
const TOP = 22
const TICK = 7          // vertical pixels per tick of simulated time

export function createTimelineLab({ node, langOf }) {
  let model = null
  let playing = null

  function load(_kind, params = {}) {
    model = {
      protocol: 'go-back-n',
      frames: 8,
      window: 4,
      loss: 0.25,
      ackLoss: true,
      seed: 7,
      prop: 4,
      timeout: 14,
      cursor: Infinity,      // how far down the ladder has been revealed
      ...params,
    }
    draw()
    return true
  }

  const settings = () => ({
    protocol: model.protocol,
    frames: model.frames,
    window: model.window,
    loss: model.loss,
    lossAck: model.ackLoss ? null : 0,
    seed: model.seed,
    prop: model.prop,
    timeout: model.timeout,
  })

  function draw() {
    if (!model) { render(node); return }
    const lang = langOf()
    const run = simulate(settings())

    render(node,
      el('div.lab__head',
        el('span.lab__tag', 'LAB'),
        el('span.lab__title', say(LABEL[model.protocol], lang)),
        el('span.lab__sim', 'SIM'),
      ),
      el('div.lab__body',
        el('p.lab__blurb', say(BLURB[model.protocol], lang)),
        controls(lang),
        ladder(run, lang),
        stats(run.stats, lang),
        comparison(lang),
      ),
    )
  }

  // ── controls ───────────────────────────────────────────────────────────
  function controls(lang) {
    return el('div.tl__controls',
      el('div.tl__protocols', PROTOCOLS.map((p) => el('button.tl__proto', {
        class: `tl__proto${model.protocol === p ? ' tl__proto--on' : ''}`,
        onclick: () => { model.protocol = p; stop(); model.cursor = Infinity; draw() },
      }, say(LABEL[p], lang)))),

      el('div.tl__sliders',
        slider(T('loss', 'loss'), 'loss', 0, 0.6, 0.05, (v) => `${Math.round(v * 100)}%`),
        model.protocol === 'stop-and-wait'
          ? null
          : slider(T('window', 'window'), 'window', 1, 8, 1, (v) => String(v)),
        slider(T('frames', 'frames'), 'frames', 4, 16, 1, (v) => String(v)),
      ),

      el('div.tl__row',
        el('label.tl__check',
          el('input', {
            type: 'checkbox',
            checked: model.ackLoss || null,
            onchange: (e) => { model.ackLoss = e.target.checked; draw() },
          }),
          lang === 'hi' ? 'ACKs bhi kho sakte hain' : 'ACKs can be lost too',
        ),
        el('button.lab__btn', {
          onclick: () => { model.seed = (model.seed * 7 + 13) % 9973; stop(); model.cursor = Infinity; draw() },
        }, lang === 'hi' ? 'nayi kismat' : 'new luck'),
        el('button.lab__btn', { onclick: play },
          playing ? (lang === 'hi' ? 'rok do' : 'pause') : (lang === 'hi' ? 'dheere chalao' : 'play')),
      ),
    )
  }

  function slider(label, key, min, max, step, fmt) {
    return el('label.tl__slider',
      el('span.tl__sliderLabel', say(label, langOf())),
      el('input', {
        type: 'range', min, max, step, value: model[key],
        oninput: (e) => { model[key] = Number(e.target.value); stop(); model.cursor = Infinity; draw() },
      }),
      el('span.tl__sliderValue', fmt(model[key])),
    )
  }

  // ── the ladder ─────────────────────────────────────────────────────────
  function ladder(run, lang) {
    const end = Math.max(run.stats.ticks, 1)
    const height = TOP + end * TICK + 20
    const y = (t) => TOP + t * TICK
    const shown = (t) => t <= model.cursor

    const lines = []
    for (const e of run.events) {
      if (e.kind !== 'data' && e.kind !== 'ack') continue
      if (!shown(e.t0)) continue

      const fromLeft = e.kind === 'data'
      const x1 = fromLeft ? LANE_L : LANE_R
      const x2 = fromLeft ? LANE_R : LANE_L
      // A lost frame stops where it died, so the gap is visible rather than
      // asserted. Two thirds of the way across reads as "it never arrived".
      const cut = e.lost ? 0.66 : 1
      const ex = x1 + (x2 - x1) * cut
      const ey = y(e.t0) + (y(e.t1) - y(e.t0)) * cut

      lines.push(svg('line', {
        class: `tl__line tl__line--${e.kind}${e.lost ? ' tl__line--lost' : ''}${e.retx ? ' tl__line--retx' : ''}`,
        x1, y1: y(e.t0), x2: ex, y2: ey,
      }))

      lines.push(svg('text', {
        class: 'tl__seq',
        x: fromLeft ? x1 + 6 : x1 - 6,
        y: y(e.t0) - 2,
        'text-anchor': fromLeft ? 'start' : 'end',
      }, e.kind === 'data' ? `${e.seq}${e.retx ? '↻' : ''}` : `ack ${e.seq}`))

      if (e.lost) lines.push(svg('text', { class: 'tl__lost', x: ex, y: ey + 4, 'text-anchor': 'middle' }, '✕'))
    }

    const marks = run.events
      .filter((e) => (e.kind === 'timeout' || e.kind === 'discard') && shown(e.t))
      .map((e) => svg('text', {
        class: `tl__mark tl__mark--${e.kind}`,
        x: e.kind === 'timeout' ? LANE_L - 12 : LANE_R + 12,
        y: y(e.t) + 3,
        'text-anchor': e.kind === 'timeout' ? 'end' : 'start',
      }, e.kind === 'timeout' ? `timeout ${e.seq}` : `drop ${e.seq}`))

    return el('div.tl__ladderWrap',
      svg('svg.tl__ladder', { viewBox: `0 0 ${WIDE} ${height}` },
      svg('text', { class: 'tl__lane', x: LANE_L, y: 12, 'text-anchor': 'middle' },
        lang === 'hi' ? 'bhejne wala' : 'sender'),
      svg('text', { class: 'tl__lane', x: LANE_R, y: 12, 'text-anchor': 'middle' },
        lang === 'hi' ? 'paane wala' : 'receiver'),
      svg('line', { class: 'tl__axis', x1: LANE_L, y1: TOP, x2: LANE_L, y2: height - 10 }),
      svg('line', { class: 'tl__axis', x1: LANE_R, y1: TOP, x2: LANE_R, y2: height - 10 }),
      lines,
      marks,
      ),
    )
  }

  // ── numbers ────────────────────────────────────────────────────────────
  function stats(s, lang) {
    const chips = [
      [lang === 'hi' ? 'frames' : 'frames', String(s.frames)],
      [lang === 'hi' ? 'bheje gaye' : 'transmissions', String(s.transmissions)],
      [lang === 'hi' ? 'dobara' : 'resent', String(s.retransmissions)],
      [lang === 'hi' ? 'time' : 'ticks', String(s.ticks)],
      [lang === 'hi' ? 'kaam ka hissa' : 'useful', `${Math.round(s.efficiency * 100)}%`],
    ]
    return el('div.lsn__chips', chips.map(([label, value]) => el('span.lsn__chip',
      el('span.lsn__chipLabel', label),
      el('span.lsn__chipValue', value),
    )))
  }

  // ── the comparison — the point of the whole widget ─────────────────────
  function comparison(lang) {
    const rows = compare(settings())
    const worst = Math.max(...rows.map((r) => r.transmissions))

    return el('div.tl__compare',
      el('div.lab__sectionHead', lang === 'hi'
        ? 'wahi channel, wahi losses, teeno protocol'
        : 'the same channel, the same losses, all three protocols'),

      rows.map((r) => el('div.tl__bar',
        { class: `tl__bar${r.protocol === model.protocol ? ' tl__bar--on' : ''}` },
        el('button.tl__barName', {
          onclick: () => { model.protocol = r.protocol; stop(); model.cursor = Infinity; draw() },
        }, say(LABEL[r.protocol], lang)),
        el('span.tl__barTrack',
          el('span.tl__barFill', { style: { width: `${(r.transmissions / worst) * 100}%` } }),
        ),
        el('span.tl__barValue', `${r.transmissions} ${lang === 'hi' ? 'bheje' : 'sends'}`),
        el('span.tl__barTicks', `${r.ticks} ${lang === 'hi' ? 'ticks' : 'ticks'}`),
      )),

      el('p.lab__meta', model.ackLoss
        ? (lang === 'hi'
          ? 'ACK loss on hai. Ise band karke dekho — tabhi wo classic natija milta hai ki Go-Back-N sabse zyada dobara bhejta hai. Go-Back-N ka cumulative ACK baar-baar jaata hai, isliye ACK khone se use kam farak padta hai.'
          : 'ACK loss is on. Turn it off to see the textbook result. Go-Back-N re-sends its cumulative ACK constantly, so losing ACKs costs it far less than it costs Selective Repeat.')
        : (lang === 'hi'
          ? 'Sirf data frames kho rahe hain — yahi wo haalat hai jiske baare me kitaab ka daawa hai.'
          : 'Only data frames are being lost — the condition the textbook claim is actually about.')),
    )
  }

  // ── slow playback ──────────────────────────────────────────────────────
  function play() {
    if (playing) return stop(true)
    model.cursor = 0
    const end = simulate(settings()).stats.ticks
    let last = 0
    const frame = (now) => {
      if (!playing) return
      if (now - last > 45) { model.cursor += 1; last = now; draw() }
      if (model.cursor >= end) return stop(true)
      playing = requestAnimationFrame(frame)
    }
    playing = requestAnimationFrame(frame)
    draw()
  }

  function stop(redraw = false) {
    if (playing) cancelAnimationFrame(playing)
    playing = null
    if (redraw) { model.cursor = Infinity; draw() }
  }

  const close = () => { stop(); model = null; clear(node) }

  return { load, draw, close, isOpen: () => model !== null }
}
