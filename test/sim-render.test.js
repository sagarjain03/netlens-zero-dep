/**
 * sim-render.test.js — the labs render, and respond to being used.
 *
 * The algorithm suites prove the arithmetic. This one proves the widgets that
 * present it actually run: that every mode builds a tree without throwing, and
 * that clicking the thing the lesson tells you to click changes the verdict.
 *
 * It needs a DOM, and the project has no test browser, so it brings the
 * smallest one that satisfies dom.js — about forty lines. That is cheaper than
 * a headless browser and it runs in the same offline suite as everything else.
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'

// ── the smallest DOM that dom.js is happy with ─────────────────────────────

/**
 * A real class, not an object literal: dom.js decides whether an argument is a
 * child or a props bag with `instanceof Node`, so plain objects get stringified
 * into text and the whole tree collapses to "[object Object]".
 */
class StubNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase()
    this.nodeType = 1
    this.childNodes = []
    this.attrs = {}
    this.classes = new Set()
    this.handlers = {}
    this.style = {}
    this.dataset = {}
    this.id = ''
    this._text = null

    this.classList = {
      add: (...names) => { for (const n of names) this.classes.add(n) },
      contains: (n) => this.classes.has(n),
      toggle: (n, on) => { if (on) this.classes.add(n); else this.classes.delete(n) },
    }
  }

  get firstChild() { return this.childNodes[0] ?? null }

  get className() { return [...this.classes].join(' ') }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)) }

  get textContent() {
    if (this._text !== null) return this._text
    return this.childNodes.map((c) => c.textContent).join('')
  }

  appendChild(child) { this.childNodes.push(child); return child }
  removeChild(child) {
    this.childNodes = this.childNodes.filter((c) => c !== child)
    return child
  }
  addEventListener(type, fn) { (this.handlers[type] ??= []).push(fn) }
  setAttribute(k, v) {
    this.attrs[k] = String(v)
    // SVG elements take their class through setAttribute, because an SVG
    // `className` is read-only. A real DOM keeps the two in sync; if this
    // stub does not, every ladder line looks unclassed to the tests.
    if (k === 'class') this.className = String(v)
  }
  getAttribute(k) { return this.attrs[k] ?? null }
}

function textNode(value) {
  const node = new StubNode('#text')
  node.nodeType = 3
  node._text = String(value)
  return node
}

const makeNode = (tag) => new StubNode(tag)

before(() => {
  globalThis.Node = StubNode
  globalThis.document = {
    createElement: makeNode,
    createElementNS: (_ns, tag) => makeNode(tag),
    createTextNode: textNode,
  }
})

after(() => {
  delete globalThis.document
  delete globalThis.Node
})

// ── walking the rendered tree ──────────────────────────────────────────────

function walk(node, out = []) {
  out.push(node)
  for (const c of node.childNodes ?? []) walk(c, out)
  return out
}

const byClass = (root, cls) => walk(root).filter((n) => n.classes?.has(cls))
const text = (root) => walk(root).map((n) => (n.nodeType === 3 ? n.textContent : '')).join('')
const click = (node) => { for (const fn of node.handlers?.click ?? []) fn({ stopPropagation() {} }) }

const host = () => makeNode('div')
const langOf = () => 'en'

// ── the labs ───────────────────────────────────────────────────────────────

describe('dispatched the way the app dispatches them', () => {
  /**
   * This suite exists because of a bug the others could not see.
   *
   * main.js calls `labFor(kind).load(kind, state.lab)`, and `state.lab` is
   * `{ kind }` — so the mode name is spread into the model. The topology lab
   * kept its shape in a field also called `kind`, which meant the real call
   * overwrote "star" with "topology" and the lab threw on load. Every other
   * test passed an explicit valid value and sailed straight past it.
   *
   * So: exercise the exact call the app makes, for every registered mode.
   */
  const MODES = {
    bits: ['crc', 'hamming', 'bitstuff', 'parity'],
    arq: ['arq'],
    addr: ['subnet', 'ipv4'],
    topo: ['topology'],
    cmp: ['compare'],
    stack: ['layers'],
  }

  test('every lab mode loads from a bare { kind }, as the command sends it', async () => {
    const factories = {
      bits: (await import('../web/js/sim/bits.js')).createBitsLab,
      arq: (await import('../web/js/sim/timeline.js')).createTimelineLab,
      addr: (await import('../web/js/sim/address.js')).createAddressLab,
      topo: (await import('../web/js/sim/topology.js')).createTopologyLab,
      cmp: (await import('../web/js/sim/comparison.js')).createComparisonLab,
      stack: (await import('../web/js/sim/layers.js')).createLayersLab,
    }

    for (const [owner, kinds] of Object.entries(MODES)) {
      for (const kind of kinds) {
        const node = host()
        const lab = factories[owner]({ node, langOf, terminal: { run() {} }, onChapter() {} })

        assert.equal(lab.load(kind, { kind }), true, `${kind} refused to load`)
        assert.ok(byClass(node, 'lab__head').length === 1, `${kind} rendered no header`)
        assert.ok(byClass(node, 'lab__body').length === 1, `${kind} rendered no body`)
        assert.ok(text(node).length > 80, `${kind} rendered an empty body`)
        lab.close()
      }
    }
  })
})

describe('the bit lab renders every mode', () => {
  test('crc, hamming, bitstuff and parity all build a tree', async () => {
    const { createBitsLab, MODES } = await import('../web/js/sim/bits.js')
    for (const kind of Object.keys(MODES)) {
      const node = host()
      const lab = createBitsLab({ node, langOf })
      assert.equal(lab.load(kind), true, `${kind} refused to load`)
      assert.ok(node.childNodes.length > 0, `${kind} rendered nothing`)
      assert.ok(byClass(node, 'lab__verdict').length === 1, `${kind} has no verdict`)
      lab.close()
      assert.equal(node.childNodes.length, 0, `${kind} did not clean up`)
    }
  })

  test('an unknown mode is refused rather than half-rendered', async () => {
    const { createBitsLab } = await import('../web/js/sim/bits.js')
    const node = host()
    assert.equal(createBitsLab({ node, langOf }).load('nonsense'), false)
  })

  test('breaking a bit in the CRC lab flips the verdict', async () => {
    const { createBitsLab } = await import('../web/js/sim/bits.js')
    const node = host()
    const lab = createBitsLab({ node, langOf })
    lab.load('crc')

    assert.match(text(node), /accepted/, 'a fresh codeword should be accepted')

    const bits = walk(node).filter((n) => n.tagName === 'BUTTON' && n.classes.has('lab__bit'))
    assert.ok(bits.length > 0, 'the channel row should be clickable')
    click(bits[3])

    assert.match(text(node), /rejected/, 'CRC should reject a damaged frame')
    assert.equal(byClass(node, 'lab__verdict--bad').length, 1)
  })

  test('the parity rectangle is invisible, as the lesson claims', async () => {
    const { createBitsLab } = await import('../web/js/sim/bits.js')
    const node = host()
    const lab = createBitsLab({ node, langOf })
    lab.load('parity')

    const cells = () => walk(node).filter((n) => n.tagName === 'BUTTON' && n.classes.has('lab__cell'))
    // one error is located exactly
    click(cells()[5])
    assert.match(text(node), /both fail/)

    click(cells()[5])                       // repair it
    for (const i of [0, 2, 4, 6]) click(cells()[i])   // four corners of a rectangle

    assert.match(text(node), /invisible/, 'four corners should defeat 2-D parity')
    assert.equal(byClass(node, 'lab__verdict--warn').length, 1)
  })
})

describe('the sliding-window lab renders', () => {
  test('builds a ladder and a three-row comparison', async () => {
    const { createTimelineLab } = await import('../web/js/sim/timeline.js')
    const node = host()
    const lab = createTimelineLab({ node, langOf })
    lab.load('arq')

    assert.ok(byClass(node, 'tl__line').length > 0, 'no transmissions drawn')
    assert.equal(byClass(node, 'tl__bar').length, 3, 'all three protocols should be compared')
    assert.ok(byClass(node, 'tl__proto').length === 3)
    lab.close()
    assert.equal(node.childNodes.length, 0)
  })

  test('switching protocol redraws with different numbers', async () => {
    const { createTimelineLab } = await import('../web/js/sim/timeline.js')
    const node = host()
    createTimelineLab({ node, langOf }).load('arq', { protocol: 'go-back-n' })

    const discardsBefore = byClass(node, 'tl__mark--discard').length
    const toSelective = byClass(node, 'tl__proto').find((b) => text(b).includes('Selective'))
    click(toSelective)

    // Selective Repeat buffers what arrives early, so it discards nothing.
    assert.ok(discardsBefore > 0, 'go-back-n should discard out-of-order frames')
    assert.equal(byClass(node, 'tl__mark--discard').length, 0)
  })
})

describe('the comparison lab renders', () => {
  test('every comparison builds a table with one cell per column', async () => {
    const { createComparisonLab } = await import('../web/js/sim/comparison.js')
    const { COMPARISONS, IDS } = await import('../web/js/sim/cmp.js')

    for (const id of IDS) {
      const node = host()
      const lab = createComparisonLab({ node, langOf })
      lab.load('compare', { id })
      const c = COMPARISONS[id]
      assert.equal(byClass(node, 'cmp__col').length, c.columns.length, `${id} columns`)
      assert.equal(byClass(node, 'cmp__value').length,
        c.rows.length * c.columns.length, `${id} cells`)
      lab.close()
    }
  })

  test('an answer stays hidden until it is asked for', async () => {
    const { createComparisonLab } = await import('../web/js/sim/comparison.js')
    const node = host()
    createComparisonLab({ node, langOf }).load('compare', { id: 'tcp-udp' })

    assert.equal(byClass(node, 'cmp__askA').length, 0, 'answers should start closed')
    click(byClass(node, 'cmp__askQ')[0])
    assert.equal(byClass(node, 'cmp__askA').length, 1)
    assert.match(text(node), /worse than a word missing/)
  })

  test('the run button drives the terminal with the command it shows', async () => {
    const { createComparisonLab } = await import('../web/js/sim/comparison.js')
    const ran = []
    const node = host()
    createComparisonLab({ node, langOf, terminal: { run: (c) => ran.push(c) } })
      .load('compare', { id: 'ipv4-ipv6' })

    const buttons = byClass(node, 'lsn__run')
    assert.equal(buttons.length, 2)
    click(buttons[1])
    assert.deepEqual(ran, ['dig facebook.com AAAA'])
  })
})

describe('the encapsulation lab renders', () => {
  test('nests one box per layer, with the payload innermost', async () => {
    const { createLayersLab } = await import('../web/js/sim/layers.js')
    const node = host()
    const lab = createLayersLab({ node, langOf })
    lab.load('layers')

    assert.equal(byClass(node, 'stk__layer').length, 4, 'HTTP is the payload, four wrap it')
    assert.equal(byClass(node, 'stk__payload').length, 1)
    assert.match(text(node), /63 B/, 'the fixed toll should be stated')
    lab.close()
  })

  test('turning HTTPS off removes exactly the TLS record', async () => {
    const { createLayersLab } = await import('../web/js/sim/layers.js')
    const node = host()
    createLayersLab({ node, langOf }).load('layers', { tls: false })
    assert.equal(byClass(node, 'stk__layer--tls').length, 0)
    assert.equal(byClass(node, 'stk__layer').length, 3)
  })

  test('a tiny payload is nearly all envelope, a large one nearly all data', async () => {
    const { createLayersLab } = await import('../web/js/sim/layers.js')
    const tiny = host()
    createLayersLab({ node: tiny, langOf }).load('layers', { payload: 1 })
    assert.match(text(tiny), /98%/)

    const big = host()
    createLayersLab({ node: big, langOf }).load('layers', { payload: 1400 })
    assert.match(text(big), /4%/)
  })

  test('unwrapping removes a layer from the outside', async () => {
    const { createLayersLab } = await import('../web/js/sim/layers.js')
    const node = host()
    createLayersLab({ node, langOf }).load('layers')

    const unwrap = byClass(node, 'lab__btn').find((b) => text(b).includes('unwrap'))
    click(unwrap)
    assert.equal(byClass(node, 'stk__layer').length, 3)
    assert.equal(byClass(node, 'stk__layer--eth').length, 0, 'the outermost goes first')
  })

  test('a layer links back to the chapter it was met in', async () => {
    const { createLayersLab } = await import('../web/js/sim/layers.js')
    const jumped = []
    const node = host()
    createLayersLab({ node, langOf, onChapter: (n) => jumped.push(n) }).load('layers')

    const chapters = byClass(node, 'stk__chapter')
    assert.equal(chapters.length, 4)
    click(chapters[0])
    assert.deepEqual(jumped, [1], 'Ethernet was met in chapter 1')
  })
})

describe('the topology lab renders', () => {
  test('every shape draws its machines and its cables', async () => {
    const { createTopologyLab } = await import('../web/js/sim/topology.js')
    const expected = { bus: 5, star: 5, ring: 6, mesh: 15 }   // cables for 6 machines

    for (const [kind, cables] of Object.entries(expected)) {
      const node = host()
      const lab = createTopologyLab({ node, langOf })
      lab.load('topology', { shape: kind, n: 6 })
      assert.equal(byClass(node, 'topo__node').length, 6, `${kind} machines`)
      assert.equal(byClass(node, 'topo__cable').length, cables, `${kind} cables`)
      lab.close()
    }
  })

  test('sending from a machine marks who heard it', async () => {
    const { createTopologyLab } = await import('../web/js/sim/topology.js')
    const node = host()
    createTopologyLab({ node, langOf }).load('topology', { shape: 'ring', n: 6 })

    click(byClass(node, 'topo__node')[0])
    assert.equal(byClass(node, 'topo__node--sender').length, 1)
    assert.equal(byClass(node, 'topo__node--heard').length, 5, 'an intact ring reaches everyone')
    assert.equal(byClass(node, 'topo__node--deaf').length, 0)
    assert.match(text(node), /reached all 5/)
  })

  test('cutting a bus cable leaves the far side deaf', async () => {
    const { createTopologyLab } = await import('../web/js/sim/topology.js')
    const node = host()
    createTopologyLab({ node, langOf }).load('topology', { shape: 'bus', n: 6 })

    click(byClass(node, 'topo__cable')[2])       // between tap 2 and tap 3
    click(byClass(node, 'topo__node')[0])

    assert.equal(byClass(node, 'topo__node--heard').length, 2, 'taps 1 and 2 only')
    assert.equal(byClass(node, 'topo__node--deaf').length, 3)
    assert.match(text(node), /separate network/)
  })

  test('a ring survives one cut, and says so before you send', async () => {
    const { createTopologyLab } = await import('../web/js/sim/topology.js')
    const node = host()
    createTopologyLab({ node, langOf }).load('topology', { shape: 'ring', n: 6 })

    click(byClass(node, 'topo__cable')[0])
    assert.equal(byClass(node, 'lab__verdict--warn').length, 1)
    assert.match(text(node), /another way round/)

    click(byClass(node, 'topo__node')[0])
    assert.equal(byClass(node, 'topo__node--deaf').length, 0, 'the long way round still works')
  })

  test('the hub is named as the star single point of failure', async () => {
    const { createTopologyLab } = await import('../web/js/sim/topology.js')
    const node = host()
    createTopologyLab({ node, langOf }).load('topology', { shape: 'star', n: 6 })
    assert.match(text(node), /single points of failure/)
    assert.match(text(node), /hub/)
  })
})

describe('the addressing lab renders', () => {
  test('subnet mode shows 32 bits and the numbers that follow', async () => {
    const { createAddressLab } = await import('../web/js/sim/address.js')
    const node = host()
    const lab = createAddressLab({ node, langOf })
    lab.load('subnet')

    assert.equal(byClass(node, 'addr__bit').length, 32, 'an address is 32 bits')
    assert.equal(byClass(node, 'addr__bit--net').length, 26, '/26 means 26 network bits')
    assert.equal(byClass(node, 'addr__bit--host').length, 6)

    const shown = text(node)
    for (const expected of ['192.168.1.128', '192.168.1.191', '255.255.255.192', '62']) {
      assert.ok(shown.includes(expected), `missing ${expected}`)
    }
    lab.close()
  })

  test('a private address is called private, a public one is not', async () => {
    const { createAddressLab } = await import('../web/js/sim/address.js')
    const priv = host()
    createAddressLab({ node: priv, langOf }).load('subnet')
    assert.match(text(priv), /private/)

    const pub = host()
    createAddressLab({ node: pub, langOf }).load('subnet', { address: '140.82.113.4', prefix: 24 })
    assert.match(text(pub), /routable on the real internet/)
  })

  test('a malformed address explains itself instead of throwing', async () => {
    const { createAddressLab } = await import('../web/js/sim/address.js')
    const node = host()
    createAddressLab({ node, langOf }).load('subnet', { address: '999.1.1' })
    assert.equal(byClass(node, 'lab__verdict--bad').length, 1)
    assert.match(text(node), /four parts/)
  })

  test('ipv4 mode builds the header and verifies its own checksum', async () => {
    const { createAddressLab } = await import('../web/js/sim/address.js')
    const node = host()
    createAddressLab({ node, langOf }).load('ipv4')

    assert.equal(byClass(node, 'addr__byte').length, 20, 'the header is twenty bytes')
    assert.equal(byClass(node, 'addr__byte--sum').length, 2, 'the checksum field is two of them')
    assert.equal(byClass(node, 'lab__verdict--ok').length, 1)
    assert.match(text(node), /matches/)
  })

  test('corrupting a header byte fails the check', async () => {
    const { createAddressLab } = await import('../web/js/sim/address.js')
    const node = host()
    createAddressLab({ node, langOf }).load('ipv4')

    click(byClass(node, 'addr__byte')[8])          // the TTL byte
    assert.equal(byClass(node, 'lab__verdict--bad').length, 1)
    assert.match(text(node), /gets discarded/)
  })
})
