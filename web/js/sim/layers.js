/**
 * layers.js — the encapsulation lab.
 *
 * Chapter 8's reveal, made operable. The nested boxes are the picture every
 * textbook draws; what a textbook cannot do is let you drag the payload size
 * and watch the overhead go from 98% to 4% while the envelopes never change.
 *
 * That is the actual lesson, and it is arithmetic: overhead is a fixed toll,
 * not a percentage of anything. stack.js does the counting.
 */
import { el, render, clear } from '../dom.js'
import { encapsulate, STACK, MODELS, SWAPS } from './stack.js'

export function createLayersLab({ node, langOf, terminal, onChapter }) {
  let model = null

  function load(_kind, params = {}) {
    model = { payload: 142, tls: true, depth: null, answered: [], ...params }
    draw()
    return true
  }

  function draw() {
    if (!model) { render(node); return }
    const lang = langOf()
    const r = encapsulate(model.payload, { tls: model.tls })
    const depth = model.depth === null ? r.layers.length : model.depth

    render(node,
      el('div.lab__head',
        el('span.lab__tag', 'LAB'),
        el('span.lab__title', lang === 'hi' ? 'Encapsulation — lifaafe me lifaafa' : 'Encapsulation — envelopes inside envelopes'),
        el('span.lab__real', 'REAL MATH'),
      ),
      el('div.lab__body',
        el('p.lab__blurb', lang === 'hi'
          ? 'Neeche jaate hue har layer apne upar wali ko apne header me lapet leti hai. Payload ka size ghumao aur dekho: lifaafe kabhi nahi badalte, bas unka hissa badalta hai.'
          : 'On the way down, each layer wraps the one above it in its own header. Drag the payload size and watch what happens: the envelopes never change, only their share of the total does.'),

        controls(r, depth, lang),
        nest(r, depth, lang),
        overhead(r, lang),
        models(lang),
        swaps(lang),
      ),
    )
  }

  // ── controls ───────────────────────────────────────────────────────────
  function controls(r, depth, lang) {
    return el('div.tl__controls',
      el('div.tl__sliders',
        el('label.tl__slider',
          el('span.tl__sliderLabel', lang === 'hi' ? 'payload' : 'payload'),
          el('input', {
            type: 'range', min: 1, max: 1400, step: 1, value: model.payload,
            oninput: (e) => { model.payload = Number(e.target.value); draw() },
          }),
          el('span.tl__sliderValue', `${model.payload} B`),
        ),
        el('label.tl__check',
          el('input', {
            type: 'checkbox', checked: model.tls || null,
            onchange: (e) => { model.tls = e.target.checked; model.depth = null; draw() },
          }),
          lang === 'hi' ? 'HTTPS (TLS record)' : 'HTTPS (a TLS record)',
        ),
      ),
      el('div.lab__controls',
        el('button.lab__btn', {
          onclick: () => { model.depth = Math.max(1, depth - 1); draw() },
        }, lang === 'hi' ? '◀ ek layer kholo' : '◀ unwrap one'),
        el('button.lab__btn', {
          onclick: () => { model.depth = Math.min(r.layers.length, depth + 1); draw() },
        }, lang === 'hi' ? 'ek layer lapeto ▶' : 'wrap one ▶'),
        el('span.lab__meta', `${depth - 1} / ${r.layers.length - 1}`),
      ),
    )
  }

  // ── the nesting ────────────────────────────────────────────────────────
  //
  // Built inside out, so the DOM nesting is the encapsulation itself rather
  // than a set of boxes drawn to look nested.
  function nest(r, depth, lang) {
    // The innermost layer adds no header because it IS the payload — the HTTP
    // request is the thing being carried, not an envelope around it. Drawing
    // it as a wrapper made an empty box around "your data".
    const [payload, ...wrappers] = r.layers
    const shown = wrappers.slice(0, depth - 1)

    let inner = el('div.stk__payload',
      el('span.stk__name', payload.name),
      el('span.stk__role', lang === 'hi' ? payload.roleHi : payload.role),
      el('span.stk__size', `${r.payload} B`),
    )

    for (const l of shown) {
      inner = el('div.stk__layer', { class: `stk__layer stk__layer--${l.id}` },
        el('div.stk__bar',
          el('span.stk__name', l.name),
          el('span.stk__osi', `L${l.osi}`),
          el('span.stk__added', `+${l.added} B`),
          l.chapter
            ? el('button.stk__chapter', {
              title: lang === 'hi' ? `Chapter ${l.chapter} me dekho` : `See it in chapter ${l.chapter}`,
              onclick: () => onChapter?.(l.chapter),
            }, `ch ${String(l.chapter).padStart(2, '0')}`)
            : null,
          el('span.stk__size', `${l.after} B`),
        ),
        el('div.stk__role', lang === 'hi' ? l.roleHi : l.role),
        inner,
      )
    }

    return el('div.stk__nest', inner)
  }

  // ── the toll ───────────────────────────────────────────────────────────
  function overhead(r, lang) {
    const pct = Math.round(r.overheadPct)
    return el('div.lab__section',
      el('div.lab__sectionHead', lang === 'hi' ? 'kitna hissa address ka hai' : 'how much of this is addressing'),
      el('div.stk__meter',
        el('span.stk__meterFill', { style: { width: `${100 - pct}%` } }),
        el('span.stk__meterLabel', `${100 - pct}% ${lang === 'hi' ? 'data' : 'data'}`),
      ),
      el('div.lsn__chips',
        chip(lang === 'hi' ? 'payload' : 'payload', `${r.payload} B`),
        chip(lang === 'hi' ? 'headers' : 'headers', `${r.overhead} B`),
        chip(lang === 'hi' ? 'wire pe' : 'on the wire', `${r.total} B`),
        chip(lang === 'hi' ? 'overhead' : 'overhead', `${pct}%`),
      ),
      el('p.lab__meta', lang === 'hi'
        ? `Yahi ${r.overhead} bytes 1-byte message pe bhi lagte hain aur 1400-byte pe bhi. Overhead percentage nahi, ek fix toll hai — isiliye chhote packets mehnge padte hain.`
        : `Those same ${r.overhead} bytes are charged on a 1-byte message and on a 1400-byte one. Overhead is a fixed toll, not a percentage — which is exactly why small packets are expensive.`),
      terminal
        ? el('div.cmp__see',
          el('div.cmp__seeSay', lang === 'hi'
            ? 'Ye sab ek asli exchange me ek saath chalta hai:'
            : 'All of this fires at once in one real exchange:'),
          el('button.lsn__run', { onclick: () => terminal.run('journey https://example.com') },
            el('span.lsn__runIcon', '▶'), el('code', 'journey https://example.com')),
        )
        : null,
    )
  }

  const chip = (label, value) => el('span.lsn__chip',
    el('span.lsn__chipLabel', label), el('span.lsn__chipValue', value))

  // ── seven against four ─────────────────────────────────────────────────
  function models(lang) {
    return el('div.lab__section',
      el('div.lab__sectionHead', lang === 'hi' ? 'OSI ke saat, TCP/IP ke chaar' : 'seven against four'),
      el('div.stk__models', MODELS.map((m) => el('div.stk__model', {
        class: `stk__model${m.real ? '' : ' stk__model--ghost'}`,
      },
      el('span.stk__modelN', `L${m.osi}`),
      el('span.stk__modelOsi', m.osiName),
      el('span.stk__modelArrow', '→'),
      el('span.stk__modelTcp', m.tcpip),
      m.real ? null : el('span.stk__modelNote', lang === 'hi'
        ? 'alag se koi nahi banata'
        : 'nobody implements this separately'),
      ))),
      el('p.lab__meta', lang === 'hi'
        ? 'Layer 5 aur 6 kitaabon me hain, code me lagbhag nahi. Ye baat koi nahi batata.'
        : 'Layers 5 and 6 exist in the book and barely in any code. Nobody tells you that.'),
    )
  }

  // ── which layer would you change? ──────────────────────────────────────
  function swaps(lang) {
    return el('div.lab__section',
      el('div.lab__sectionHead', lang === 'hi' ? 'kaunsi layer badlogi?' : 'which layer would you change?'),
      SWAPS.map((s, i) => {
        const open = model.answered.includes(i)
        return el('div.cmp__ask', { class: `cmp__ask${open ? ' cmp__ask--open' : ''}` },
          el('button.cmp__askQ', {
            onclick: () => {
              const at = model.answered.indexOf(i)
              if (at >= 0) model.answered.splice(at, 1)
              else model.answered.push(i)
              draw()
            },
          }, el('span.cmp__askMark', open ? '−' : '+'), s.goal),
          open ? el('div.cmp__askA', el('b', `layer ${s.layer}`), el('span', s.why)) : null,
        )
      }),
    )
  }

  const close = () => { model = null; clear(node) }

  return { load, draw, close, isOpen: () => model !== null }
}
