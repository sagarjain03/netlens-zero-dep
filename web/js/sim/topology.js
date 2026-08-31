/**
 * topology.js — the topology lab.
 *
 * Four shapes, one question: what happens when a cable breaks?
 *
 * The interaction is the same shape as every other lab in this project — break
 * something on purpose and read the consequence — and it is the reason this is
 * a lab rather than four pictures. Click a machine to send from it and see who
 * hears. Click a cable to cut it and watch who stops hearing.
 *
 * All the graph work is in topo.js, where the tests can reach it. Cable counts
 * and reachability are computed, never looked up from a table of adjectives.
 */
import { el, svg, render, clear } from '../dom.js'
import {
  KINDS, build, cableCount, reach, connected,
  survivesAnySingleBreak, singlePointsOfFailure, TRAITS,
} from './topo.js'

const LABEL = { bus: 'Bus', star: 'Star', ring: 'Ring', mesh: 'Mesh' }

const HI = {
  bus: {
    cable: 'ek hi shared cable, har machine ke liye ek tap',
    listen: 'sab sab kuch sunte hain — privacy wiring se nahi, encryption se aati hai',
    fail: 'cable kahin se bhi kato aur ye do alag networks me bat jaata hai',
    why: 'sasta aur badhane me aasan, isiliye shuruaati Ethernet aisa hi tha. Switches ne ise hata diya.',
  },
  star: {
    cable: 'har machine ka apna cable, sab beech me',
    listen: 'sirf hub sab kuch sunta hai; switch to har frame sirf ek port pe bhejta hai',
    fail: 'ek spoke toota to ek machine gayi — hub toota to sab gaye',
    why: 'aaj ke lagbhag har asli network ki shakl yahi hai, kyunki ek failure aksar ek hi machine hoti hai.',
  },
  ring: {
    cable: 'har machine ka ek cable, sab jud ke ek loop',
    listen: 'frame ghoomta rehta hai jab tak apni manzil na pa le',
    fail: 'ek break pe lamba raasta bacha rehta hai; do break pe ye bat jaata hai',
    why: 'loop hi iski redundancy hai, aur wahi loop nayi machine jodna mushkil bhi banata hai.',
  },
  mesh: {
    cable: 'har do machines ke beech ek cable',
    listen: 'har baatcheet ka apna alag taar',
    fail: 'ek machine ko poori tarah kaate bina koi network se bahar nahi hota',
    why: 'sabse mazboot aur sabse mehnga: cables machines ke square ki raftaar se badhte hain.',
  },
}

const trait = (kind, key, lang) => (lang === 'hi' ? HI[kind][key] : TRAITS[kind][key])

// The diagram is drawn on a square and scaled by the CSS.
const BOX = 460
const PAD = 42

export function createTopologyLab({ node, langOf }) {
  let model = null

  /**
   * The shape is `shape`, not `kind`, on purpose. The lab is dispatched by the
   * name "topology" and the whole lab state object is spread in as params — so
   * a field called `kind` was being overwritten with "topology", which is not
   * a shape, and the traits lookup threw.
   */
  function load(_kind, params = {}) {
    const { kind, ...rest } = params
    model = { shape: 'star', n: 6, from: null, broken: [], ...rest }
    if (!KINDS.includes(model.shape)) model.shape = 'star'
    draw()
    return true
  }

  function draw() {
    if (!model) { render(node); return }
    const lang = langOf()
    const topology = build(model.shape, model.n)
    const broken = new Set(model.broken.filter((id) => topology.links.some((l) => l.id === id)))
    const heard = model.from === null ? null : reach(topology, model.from, broken)
    const whole = connected(topology, broken)

    render(node,
      el('div.lab__head',
        el('span.lab__tag', 'LAB'),
        el('span.lab__title', `${LABEL[model.shape]} — ${lang === 'hi' ? 'cable kaato, natija dekho' : 'cut a cable, read the consequence'}`),
        el('span.lab__real', 'REAL GRAPH'),
      ),
      el('div.lab__body',
        el('p.lab__blurb', trait(model.shape, 'why', lang)),
        controls(lang, topology),
        el('div.topo__split',
          diagram(topology, broken, heard),
          facts(topology, broken, heard, lang),
        ),
        verdict(topology, broken, heard, whole, lang),
      ),
    )
  }

  // ── controls ───────────────────────────────────────────────────────────
  function controls(lang, topology) {
    return el('div.tl__controls',
      el('div.tl__protocols', KINDS.map((k) => el('button.tl__proto', {
        class: `tl__proto${model.shape === k ? ' tl__proto--on' : ''}`,
        onclick: () => { model.shape = k; model.broken = []; model.from = null; draw() },
      }, LABEL[k]))),

      el('div.tl__sliders',
        el('label.tl__slider',
          el('span.tl__sliderLabel', lang === 'hi' ? 'machines' : 'machines'),
          el('input', {
            type: 'range', min: 3, max: 10, step: 1, value: model.n,
            oninput: (e) => { model.n = Number(e.target.value); model.broken = []; model.from = null; draw() },
          }),
          el('span.tl__sliderValue', String(model.n)),
        ),
        el('button.lab__btn', {
          onclick: () => { model.broken = []; model.from = null; draw() },
        }, lang === 'hi' ? 'sab jod do' : 'repair everything'),
      ),

      el('p.lab__hint', lang === 'hi'
        ? 'Kisi machine pe click karke usse bhejo. Kisi cable pe click karke use kaat do.'
        : 'Click a machine to send from it. Click a cable to cut it.'),
    )
  }

  // ── the diagram ────────────────────────────────────────────────────────
  function diagram(topology, broken, heard) {
    const px = (v) => PAD + v * (BOX - 2 * PAD)
    const at = (id) => topology.nodes.find((nd) => nd.id === id)

    const cables = topology.links.map((l) => {
      const a = at(l.a)
      const b = at(l.b)
      const cut = broken.has(l.id)
      // A cable is only carrying this frame if both ends heard it.
      const live = heard && !cut && heard.has(l.a) && heard.has(l.b)
      return svg('line', {
        class: `topo__cable${cut ? ' topo__cable--cut' : ''}${live ? ' topo__cable--live' : ''}`,
        x1: px(a.x), y1: px(a.y), x2: px(b.x), y2: px(b.y),
        onclick: () => { toggleLink(l.id); draw() },
      })
    })

    // The cut marks sit on top of the cables so they read as breaks, not gaps.
    const cuts = topology.links.filter((l) => broken.has(l.id)).map((l) => {
      const a = at(l.a)
      const b = at(l.b)
      return svg('text', {
        class: 'topo__cut',
        x: (px(a.x) + px(b.x)) / 2,
        y: (px(a.y) + px(b.y)) / 2 + 4,
        'text-anchor': 'middle',
      }, '✕')
    })

    const machines = topology.nodes.map((nd) => {
      const isSender = model.from === nd.id
      const got = heard?.has(nd.id)
      const cls = [
        'topo__node',
        nd.role === 'hub' ? 'topo__node--hub' : '',
        isSender ? 'topo__node--sender' : '',
        heard && !got ? 'topo__node--deaf' : '',
        heard && got && !isSender ? 'topo__node--heard' : '',
      ].filter(Boolean).join(' ')

      return svg('g', { class: cls, onclick: () => { model.from = isSender ? null : nd.id; draw() } },
        svg('circle', { class: 'topo__dot', cx: px(nd.x), cy: px(nd.y), r: nd.role === 'hub' ? 15 : 12 }),
        svg('text', { class: 'topo__label', x: px(nd.x), y: px(nd.y) + 4, 'text-anchor': 'middle' },
          nd.role === 'hub' ? 'H' : String(nd.id)),
        heard && got && !isSender
          ? svg('text', { class: 'topo__hops', x: px(nd.x), y: px(nd.y) - 18, 'text-anchor': 'middle' },
            `${heard.get(nd.id)} hop${heard.get(nd.id) === 1 ? '' : 's'}`)
          : null,
      )
    })

    return el('div.topo__stage',
      svg('svg.topo__svg', { viewBox: `0 0 ${BOX} ${BOX}` }, cables, cuts, machines),
    )
  }

  // ── the numbers beside it ──────────────────────────────────────────────
  function facts(topology, broken, heard, lang) {
    const spofs = singlePointsOfFailure(topology)
    const robust = survivesAnySingleBreak(topology)
    const cables = cableCount(model.shape, model.n)
    const meshCost = cableCount('mesh', model.n)

    return el('div.topo__facts',
      row(lang === 'hi' ? 'cables' : 'cables', String(cables)),
      row(lang === 'hi' ? 'kate hue' : 'cut', String(broken.size), broken.size ? 'bad' : null),
      row(lang === 'hi' ? 'ek break jhel leta hai' : 'survives any one break',
        robust ? (lang === 'hi' ? 'haan' : 'yes') : (lang === 'hi' ? 'nahi' : 'no'),
        robust ? 'ok' : 'bad'),
      row(lang === 'hi' ? 'single point of failure' : 'single points of failure',
        spofs.length ? spofs.map((id) => (id === 0 && model.shape === 'star' ? 'hub' : id)).join(', ') : (lang === 'hi' ? 'koi nahi' : 'none'),
        spofs.length ? 'bad' : 'ok'),

      el('div.topo__trait',
        el('h4', lang === 'hi' ? 'cable' : 'cabling'), el('p', trait(model.shape, 'cable', lang)),
        el('h4', lang === 'hi' ? 'kaun sunta hai' : 'who hears it'), el('p', trait(model.shape, 'listen', lang)),
        el('h4', lang === 'hi' ? 'kuch toote to' : 'when something breaks'), el('p', trait(model.shape, 'fail', lang)),
      ),

      model.shape !== 'mesh'
        ? el('div.lab__meta', lang === 'hi'
          ? `Isi ${model.n} machines ke liye mesh ko ${meshCost} cables lagte — ${(meshCost / cables).toFixed(1)} guna.`
          : `A mesh of the same ${model.n} machines would cost ${meshCost} cables — ${(meshCost / cables).toFixed(1)}× as many.`)
        : el('div.lab__meta', lang === 'hi'
          ? `10 machines pe ye ${cableCount('mesh', 10)} cables hote. 50 pe ${cableCount('mesh', 50)}. Isiliye koi bhi campus mesh nahi banata.`
          : `At 10 machines that is ${cableCount('mesh', 10)} cables. At 50 it is ${cableCount('mesh', 50)}. This is why nobody wires a campus as a mesh.`),
    )
  }

  const row = (label, value, tone) => el('div.addr__row',
    el('span.addr__rowLabel', label),
    el('code', { class: `addr__rowValue${tone ? ` topo__value--${tone}` : ''}` }, value),
  )

  // ── the verdict ────────────────────────────────────────────────────────
  function verdict(topology, broken, heard, whole, lang) {
    if (!broken.size && !heard) {
      return el('div.lab__verdict',
        el('span.lab__verdictMark', '→'),
        lang === 'hi'
          ? 'Kisi machine pe click karo aur dekho kaun sunta hai. Phir ek cable kaato aur dobara bhejo.'
          : 'Click a machine and see who hears it. Then cut a cable and send again.')
    }

    if (heard) {
      const total = topology.nodes.length
      const deaf = total - heard.size
      const ok = deaf === 0
      return el('div.lab__verdict', { class: `lab__verdict lab__verdict--${ok ? 'ok' : 'bad'}` },
        el('span.lab__verdictMark', ok ? '✓' : '✕'),
        ok
          ? (lang === 'hi'
            ? `Machine ${model.from} ka frame baaki ${total - 1} tak pahuncha.`
            : `Everything machine ${model.from} sent reached all ${total - 1} others.`)
          : (lang === 'hi'
            ? `${deaf} machine${deaf === 1 ? '' : 's'} ne kuch nahi suna. Kate hue cable ke us paar wo alag network hai.`
            : `${deaf} machine${deaf === 1 ? '' : 's'} heard nothing. Past the cut, that is a separate network now.`))
    }

    return el('div.lab__verdict', { class: `lab__verdict lab__verdict--${whole ? 'warn' : 'bad'}` },
      el('span.lab__verdictMark', whole ? '!' : '✕'),
      whole
        ? (lang === 'hi'
          ? 'Cable kata hua hai, par sab abhi bhi jude hain — koi doosra raasta bacha hai. Kisi machine pe click karke saabit karo.'
          : 'A cable is cut and everyone is still connected — there is another way round. Click a machine to prove it.')
        : (lang === 'hi'
          ? 'Ye network ab do hisso me bat chuka hai.'
          : 'This network has split into pieces that cannot see each other.'))
  }

  function toggleLink(id) {
    const at = model.broken.indexOf(id)
    if (at >= 0) model.broken.splice(at, 1)
    else model.broken.push(id)
  }

  const close = () => { model = null; clear(node) }

  return { load, draw, close, isOpen: () => model !== null }
}
