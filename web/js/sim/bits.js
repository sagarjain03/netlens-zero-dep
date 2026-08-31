/**
 * bits.js — the bit-level lab.
 *
 * Four modes over one renderer: CRC, Hamming, bit stuffing and 2-D parity.
 * They share a shape because they are the same lesson four times — a sender
 * adds something, a channel damages it, a receiver notices or fails to.
 *
 * The interaction that matters is the same in every mode: **click a bit to
 * break it.** The verdict underneath is recomputed by the real algorithm in
 * algo.js, so "CRC catches this and parity does not" is something the learner
 * discovers by trying, not something we assert at them.
 *
 * Everything here is presentation. Not one line of arithmetic lives in this
 * file — that is all in algo.js, where the test suite can reach it.
 */
import { el, render, clear } from '../dom.js'
import {
  toBits, toStr, flip,
  crcEncode, crcCheck,
  hammingEncode, hammingCheck,
  bitStuff, bitUnstuff, frameWith,
  parity2d, parity2dCheck,
} from './algo.js'

const T = (en, hi) => ({ en, hi })
const say = (t, lang) => (typeof t === 'string' ? t : t[lang] || t.en)

export const MODES = {
  crc: {
    title: T('CRC — Cyclic Redundancy Check', 'CRC — Cyclic Redundancy Check'),
    blurb: T(
      'The sender divides the data by an agreed polynomial and sends the remainder along with it. The receiver divides again: a remainder of zero means nothing changed on the way.',
      'Sender data ko ek tay polynomial se divide karta hai aur remainder saath bhej deta hai. Receiver dobara divide karta hai: remainder zero matlab raaste me kuch nahi badla.',
    ),
    defaults: { data: '11010011101100', poly: '1011' },
  },
  hamming: {
    title: T('Hamming code — find AND fix', 'Hamming code — dhoondho AUR theek karo'),
    blurb: T(
      'Parity bits sit at positions 1, 2, 4, 8. Each covers the positions whose number contains it, so the parities that fail, read as a binary number, spell out exactly which bit is wrong.',
      'Parity bits position 1, 2, 4, 8 pe baithte hain. Har ek un positions ko cover karta hai jinke number me wo hai, isliye jo parities fail hoti hain unhe binary me padho to wahi bit ka number nikalta hai jo kharaab hai.',
    ),
    defaults: { data: '1011' },
  },
  bitstuff: {
    title: T('Bit stuffing — protecting the flag', 'Bit stuffing — flag ko bachana'),
    blurb: T(
      'A frame starts and ends with 01111110. If the data itself contains six ones the receiver would stop early, so the sender inserts a zero after every five — and the receiver removes it without being told.',
      'Frame 01111110 se shuru aur khatam hoti hai. Agar data me hi chhe ones aa jaayein to receiver jaldi ruk jaata, isliye sender har paanch ke baad ek zero ghusa deta hai — aur receiver bina bataye use hata deta hai.',
    ),
    defaults: { data: '0111111011111100' },
  },
  parity: {
    title: T('2-D parity — and where it fails', '2-D parity — aur ye kahan fail hoti hai'),
    blurb: T(
      'One parity bit per row and one per column. A single wrong bit fails exactly one row and one column, and the crossing names it. Break four bits in a rectangle and every parity still passes.',
      'Har row ka ek parity bit, har column ka ek. Ek galat bit theek ek row aur ek column fail karta hai, aur unka crossing use pakad leta hai. Rectangle me chaar bits todo aur har parity phir bhi pass ho jaati hai.',
    ),
    defaults: { rows: ['1011', '0110', '1110', '0101'] },
  },
}

/**
 * @param {HTMLElement} node   container inside the stage
 * @param {() => 'en'|'hi'} langOf
 */
export function createBitsLab({ node, langOf }) {
  let model = null

  function load(kind, params = {}) {
    const mode = MODES[kind]
    if (!mode) return false
    model = { kind, ...mode.defaults, ...params, damage: [], flips: 0, caught: 0, step: null }
    draw()
    return true
  }

  function draw() {
    if (!model) { render(node); return }
    const lang = langOf()
    const mode = MODES[model.kind]

    render(node,
      el('div.lab__head',
        el('span.lab__tag', 'LAB'),
        el('span.lab__title', say(mode.title, lang)),
        el('span.lab__sim', 'SIM'),
      ),
      el('div.lab__body',
        el('p.lab__blurb', say(mode.blurb, lang)),
        model.kind === 'crc' ? crcView(lang)
          : model.kind === 'hamming' ? hammingView(lang)
            : model.kind === 'bitstuff' ? stuffView(lang)
              : parityView(lang),
      ),
    )
  }

  // ── CRC ────────────────────────────────────────────────────────────────
  function crcView(lang) {
    const data = toBits(model.data)
    const poly = toBits(model.poly)
    if (data.length < poly.length || poly.length < 2) return warn(lang)

    const { codeword, remainder, steps } = crcEncode(data, poly)
    const sent = applyDamage(codeword)
    const check = crcCheck(sent, poly)
    const at = model.step === null ? steps.length - 1 : model.step

    return el('div',
      inputs(lang, [
        { key: 'data', label: T('data', 'data') },
        { key: 'poly', label: T('polynomial', 'polynomial') },
      ]),

      section(T('the sender divides', 'sender divide karta hai'),
        el('div.lab__division',
          steps.slice(0, at + 1).map((s, i) => el('div.lab__divRow',
            { class: `lab__divRow${i === at ? ' lab__divRow--now' : ''}` },
            el('span.lab__divAt', String(s.at).padStart(2, '0')),
            el('span.lab__divWhat', s.xored ? 'XOR' : 'skip'),
            el('span.lab__divBits', toStr(s.row)),
          )),
        ),
        el('div.lab__controls',
          btn('◀', () => { model.step = Math.max(0, at - 1); draw() }),
          btn(lang === 'hi' ? 'ek step' : 'step', () => {
            model.step = Math.min(steps.length - 1, at + 1); draw()
          }),
          btn(lang === 'hi' ? 'poora' : 'all', () => { model.step = null; draw() }),
          el('span.lab__meta', `${at + 1} / ${steps.length}`),
        ),
      ),

      section(T('what goes on the wire', 'wire pe kya jaata hai'),
        el('div.lab__split',
          el('span.lab__part', el('span.lab__partLabel', 'data'), el('code', toStr(data))),
          el('span.lab__part', el('span.lab__partLabel', 'check'), el('code.lab__fcs', toStr(remainder))),
        ),
      ),

      damageSection(lang, sent, codeword),

      verdict(
        check.ok,
        check.ok
          ? T(`remainder ${toStr(check.remainder)} — accepted`, `remainder ${toStr(check.remainder)} — accept`)
          : T(`remainder ${toStr(check.remainder)} — rejected, this frame was damaged`,
            `remainder ${toStr(check.remainder)} — reject, ye frame kharaab hui hai`),
        lang,
      ),

      tally(lang),
    )
  }

  // ── Hamming ────────────────────────────────────────────────────────────
  function hammingView(lang) {
    const data = toBits(model.data)
    if (!data.length) return warn(lang)

    const { code, parityAt, covers } = hammingEncode(data)
    const sent = applyDamage(code)
    const { syndrome, errorAt, corrected, failed } = hammingCheck(sent)
    const repaired = errorAt !== null && toStr(corrected) === toStr(code)

    return el('div',
      inputs(lang, [{ key: 'data', label: T('data', 'data') }]),

      section(T('the sender builds the codeword', 'sender codeword banata hai'),
        bitRow(code, {
          mark: (i) => (parityAt.includes(i + 1) ? 'parity' : null),
          label: (i) => String(i + 1),
        }),
        el('div.lab__legend', parityAt.map((p) => el('span.lab__legendItem',
          el('code', `p${p}`), ` covers ${covers[p].join(', ')}`))),
      ),

      damageSection(lang, sent, code),

      section(T('the receiver recomputes each parity', 'receiver har parity dobara ginta hai'),
        el('div.lab__syndrome',
          el('div', failed.length
            ? `${lang === 'hi' ? 'fail hui' : 'failed'}: ${failed.map((p) => `p${p}`).join(', ')}`
            : (lang === 'hi' ? 'sab parities pass' : 'every parity passes')),
          el('div', `syndrome = ${syndrome}${errorAt ? ` → ${lang === 'hi' ? 'bit' : 'bit'} ${errorAt}` : ''}`),
        ),
      ),

      verdict(
        errorAt === null || repaired,
        errorAt === null
          ? T('nothing wrong', 'kuch galat nahi')
          : repaired
            ? T(`bit ${errorAt} was wrong and has been repaired`, `bit ${errorAt} galat tha, theek kar diya gaya`)
            : T(`it says bit ${errorAt} — and it is wrong. More than one error breaks the maths.`,
              `ye kehta hai bit ${errorAt} — aur ye galat hai. Ek se zyada error ho to ganit toot jaata hai.`),
        lang,
      ),

      tally(lang),
    )
  }

  // ── bit stuffing ───────────────────────────────────────────────────────
  function stuffView(lang) {
    const data = toBits(model.data)
    const { stuffed, inserted } = bitStuff(data)
    const framed = frameWith(stuffed)
    const back = bitUnstuff(stuffed)
    const identical = toStr(back.unstuffed) === toStr(data)

    return el('div',
      inputs(lang, [{ key: 'data', label: T('payload', 'payload') }]),

      section(T('after stuffing', 'stuffing ke baad'),
        bitRow(stuffed, { mark: (i) => (inserted.includes(i) ? 'stuffed' : null) }),
        el('div.lab__meta', inserted.length
          ? `${inserted.length} ${lang === 'hi' ? 'zero daale gaye' : 'zeros inserted'}`
          : (lang === 'hi' ? 'kuch daalne ki zaroorat nahi padi' : 'nothing needed inserting')),
      ),

      section(T('the frame on the wire', 'wire pe poori frame'),
        el('div.lab__frame',
          el('code.lab__flag', '01111110'),
          el('code.lab__payload', toStr(stuffed)),
          el('code.lab__flag', '01111110'),
        ),
        el('div.lab__meta', lang === 'hi'
          ? `${framed.length} bits total — payload me ab flag kahin nahi mil sakta`
          : `${framed.length} bits total — the flag can no longer appear inside the payload`),
      ),

      section(T('the receiver removes them again', 'receiver unhe dobara hata deta hai'),
        bitRow(back.unstuffed, {}),
      ),

      verdict(identical,
        identical
          ? T('identical to what was sent', 'jo bheja tha bilkul wahi mila')
          : T('the payload did not survive', 'payload bach nahi paya'),
        lang),
    )
  }

  // ── 2-D parity ─────────────────────────────────────────────────────────
  function parityView(lang) {
    const clean = model.rows.map(toBits)
    const { rowParity, colParity } = parity2d(clean)

    const grid = clean.map((r, y) => r.map((b, x) =>
      (model.damage.some(([dy, dx]) => dy === y && dx === x) ? b ^ 1 : b)))

    const found = parity2dCheck(grid, rowParity, colParity)
    const clean2 = found.badRows.length === 0 && found.badCols.length === 0

    return el('div',
      el('p.lab__hint', lang === 'hi'
        ? 'Grid me kisi bhi bit pe click karke use todo. Ek bit todo — pakda jaayega. Ab rectangle ke chaaron kone todo.'
        : 'Click any bit in the grid to break it. Break one — it gets caught. Now break all four corners of a rectangle.'),

      section(T('the block, with its parities', 'block, apni parities ke saath'),
        el('div.lab__grid',
          grid.map((row, y) => el('div.lab__gridRow',
            row.map((b, x) => el('button.lab__cell', {
              class: `lab__cell${found.badRows.includes(y) && found.badCols.includes(x) ? ' lab__cell--suspect' : ''}`,
              onclick: () => { toggleCell(y, x); draw() },
            }, String(b))),
            el('span.lab__cell lab__cell--parity', {
              class: `lab__cell lab__cell--parity${found.badRows.includes(y) ? ' lab__cell--bad' : ''}`,
            }, String(rowParity[y])),
          )),
          el('div.lab__gridRow',
            colParity.map((p, x) => el('span.lab__cell lab__cell--parity', {
              class: `lab__cell lab__cell--parity${found.badCols.includes(x) ? ' lab__cell--bad' : ''}`,
            }, String(p))),
            el('span.lab__cell lab__cell--corner', '·'),
          ),
        ),
      ),

      verdict(clean2,
        clean2
          ? (model.damage.length
            ? T('every parity still passes — the damage is invisible', 'har parity abhi bhi pass — nuksaan dikh hi nahi raha')
            : T('nothing broken yet', 'abhi kuch toda nahi'))
          : found.locatable
            ? T(`row ${found.at[0] + 1} and column ${found.at[1] + 1} both fail — that bit is the one`,
              `row ${found.at[0] + 1} aur column ${found.at[1] + 1} dono fail — wahi bit galat hai`)
            : T('something is wrong, but too much to pin down', 'kuch galat hai, par itna ki pakad me nahi aa raha'),
        lang, clean2 && model.damage.length > 0 ? 'warn' : null),

      el('div.lab__controls',
        btn(lang === 'hi' ? 'sab theek karo' : 'repair all', () => { model.damage = []; draw() }),
      ),
    )
  }

  // ── shared pieces ──────────────────────────────────────────────────────

  /** The damage panel: this is the whole point of the lab. */
  function damageSection(lang, sent, original) {
    return section(T('the channel — click a bit to break it', 'channel — kisi bhi bit pe click karke todo'),
      bitRow(sent, {
        mark: (i) => (sent[i] !== original[i] ? 'broken' : null),
        onclick: (i) => { toggleBit(i); draw() },
      }),
      el('div.lab__meta', model.damage.length
        ? `${model.damage.length} ${lang === 'hi' ? 'bits tode gaye' : 'bits broken'}`
        : (lang === 'hi' ? 'abhi kuch toda nahi' : 'nothing broken yet')),
    )
  }

  const bitRow = (bits, { mark, onclick, label } = {}) => el('div.lab__bits',
    bits.map((b, i) => {
      const kind = mark?.(i)
      const cls = `lab__bit${kind ? ` lab__bit--${kind}` : ''}${onclick ? ' lab__bit--live' : ''}`
      const inner = [el('span.lab__bitValue', String(b)), label ? el('span.lab__bitLabel', label(i)) : null]
      return onclick
        ? el('button', { class: cls, onclick: () => onclick(i) }, inner)
        : el('span', { class: cls }, inner)
    }),
  )

  function inputs(lang, fields) {
    return el('div.lab__inputs', fields.map(({ key, label }) => el('label.lab__field',
      el('span.lab__fieldLabel', say(label, lang)),
      el('input.lab__input', {
        value: model[key],
        spellcheck: 'false',
        oninput: (e) => {
          const cleaned = e.target.value.replace(/[^01]/g, '')
          e.target.value = cleaned
          model[key] = cleaned
          // Editing the message invalidates damage aimed at the old one.
          model.damage = []
          model.step = null
          redrawSoon()
        },
      }),
    )))
  }

  const section = (title, ...children) => el('div.lab__section',
    el('div.lab__sectionHead', say(title, langOf())), ...children)

  const btn = (text, onclick) => el('button.lab__btn', { onclick }, text)

  const verdict = (ok, text, lang, force = null) => el('div.lab__verdict',
    { class: `lab__verdict lab__verdict--${force || (ok ? 'ok' : 'bad')}` },
    el('span.lab__verdictMark', force === 'warn' ? '!' : ok ? '✓' : '✕'),
    say(text, lang),
  )

  const tally = (lang) => (model.flips
    ? el('div.lab__tally', lang === 'hi'
      ? `${model.flips} bits tode gaye · ${model.caught} baar pakda gaya`
      : `${model.flips} bits broken · caught ${model.caught} times`)
    : null)

  const warn = (lang) => el('div.lab__verdict lab__verdict--bad',
    lang === 'hi' ? 'Data polynomial se lamba hona chahiye.' : 'The data has to be longer than the polynomial.')

  function toggleBit(i) {
    const at = model.damage.indexOf(i)
    if (at >= 0) model.damage.splice(at, 1)
    else { model.damage.push(i); model.flips++; countCatch() }
  }

  function toggleCell(y, x) {
    const at = model.damage.findIndex(([dy, dx]) => dy === y && dx === x)
    if (at >= 0) model.damage.splice(at, 1)
    else { model.damage.push([y, x]); model.flips++ }
  }

  const applyDamage = (bits) => model.damage.reduce((acc, i) => flip(acc, i), bits)

  /** Did the scheme notice the damage the learner just did? */
  function countCatch() {
    if (model.kind === 'crc') {
      const poly = toBits(model.poly)
      const { codeword } = crcEncode(toBits(model.data), poly)
      if (!crcCheck(applyDamage(codeword), poly).ok) model.caught++
    } else if (model.kind === 'hamming') {
      const { code } = hammingEncode(toBits(model.data))
      if (hammingCheck(applyDamage(code)).syndrome !== 0) model.caught++
    }
  }

  // Typing should not re-render on every keystroke and steal the caret.
  let pending = null
  function redrawSoon() {
    clearTimeout(pending)
    pending = setTimeout(draw, 220)
  }

  const close = () => { model = null; clear(node) }

  return { load, draw, close, isOpen: () => model !== null, kinds: Object.keys(MODES) }
}
