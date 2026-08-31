/**
 * comparison.js — the "X vs Y" lab.
 *
 * A printed table is genuinely good at this, so this does not try to win on
 * the table. It adds the two things paper cannot:
 *
 *   · a button that runs the difference. Reading that DNS uses UDP and a page
 *     uses TCP is not the same as running both and watching one take a single
 *     round trip while the other takes six.
 *   · the question an exam actually asks — a situation, not a property. Click
 *     to commit to an answer before it shows you one.
 *
 * Rows where the two genuinely agree are marked rather than omitted. What two
 * protocols have in common is usually the more surprising half.
 */
import { el, render, clear } from '../dom.js'
import { COMPARISONS, IDS } from './cmp.js'

const say = (t, lang) => (typeof t === 'string' ? t : t[lang] || t.en)

export function createComparisonLab({ node, langOf, terminal }) {
  let model = null

  function load(_kind, params = {}) {
    model = { id: IDS[0], revealed: [], ...params }
    if (!COMPARISONS[model.id]) model.id = IDS[0]
    draw()
    return true
  }

  function draw() {
    if (!model) { render(node); return }
    const lang = langOf()
    const c = COMPARISONS[model.id]

    render(node,
      el('div.lab__head',
        el('span.lab__tag', 'LAB'),
        el('span.lab__title', say(c.title, lang)),
        el('span.lab__real', 'REAL'),
      ),
      el('div.lab__body',
        el('div.tl__protocols', IDS.map((id) => el('button.tl__proto', {
          class: `tl__proto${model.id === id ? ' tl__proto--on' : ''}`,
          onclick: () => { model.id = id; model.revealed = []; draw() },
        }, say(COMPARISONS[id].title, lang)))),

        el('p.lab__blurb', say(c.blurb, lang)),
        table(c, lang),
        seeIt(c, lang),
        askIt(c, lang),
      ),
    )
  }

  // ── the table ──────────────────────────────────────────────────────────
  function table(c, lang) {
    const cols = c.columns.map((h) => say(h, lang))
    const width = `minmax(120px, 1fr) repeat(${cols.length}, minmax(110px, 1.4fr))`

    return el('div.cmp__table',
      el('div.cmp__row cmp__row--head', { style: { gridTemplateColumns: width } },
        el('span'), cols.map((h) => el('span.cmp__col', h)),
      ),
      c.rows.map((row) => el('div.cmp__row', {
        class: `cmp__row${row.same ? ' cmp__row--same' : ''}`,
        style: { gridTemplateColumns: width },
      },
      el('span.cmp__aspect', say(row.aspect, lang)),
      row.values.map((v) => el('span.cmp__value', say(v, lang))),
      row.same
        ? el('span.cmp__same', lang === 'hi' ? 'dono ek jaise' : 'the same in both')
        : null,
      )),
    )
  }

  // ── run the difference ─────────────────────────────────────────────────
  function seeIt(c, lang) {
    if (!c.see?.length) return null
    return section(lang === 'hi' ? 'khud chala ke dekho' : 'run the difference',
      c.see.map((s) => el('div.cmp__see',
        el('div.cmp__seeSay', say(s.say, lang)),
        el('button.lsn__run', {
          title: lang === 'hi' ? 'terminal me chalao' : 'run it in the terminal',
          onclick: () => terminal?.run(s.run),
        }, el('span.lsn__runIcon', '▶'), el('code', s.run)),
      )),
    )
  }

  // ── the question an exam actually asks ─────────────────────────────────
  function askIt(c, lang) {
    if (!c.asks?.length) return null
    return section(lang === 'hi' ? 'to phir, kaunsa?' : 'so which one?',
      el('p.lab__hint', lang === 'hi'
        ? 'Pehle khud jawaab socho, phir kholo.'
        : 'Decide your answer first, then open it.'),
      c.asks.map((a, i) => {
        const open = model.revealed.includes(i)
        return el('div.cmp__ask', { class: `cmp__ask${open ? ' cmp__ask--open' : ''}` },
          el('button.cmp__askQ', {
            onclick: () => { toggle(i); draw() },
          },
          el('span.cmp__askMark', open ? '−' : '+'),
          say(a.q, lang)),
          open
            ? el('div.cmp__askA',
              el('b', say(a.a, lang)),
              el('span', say(a.why, lang)),
            )
            : null,
        )
      }),
    )
  }

  function toggle(i) {
    const at = model.revealed.indexOf(i)
    if (at >= 0) model.revealed.splice(at, 1)
    else model.revealed.push(i)
  }

  const section = (title, ...children) => el('div.lab__section',
    el('div.lab__sectionHead', title), ...children)

  const close = () => { model = null; clear(node) }

  return { load, draw, close, isOpen: () => model !== null }
}
