/**
 * address.js — the addressing lab.
 *
 * Two modes over one renderer, in the same shape as bits.js:
 *
 *   subnet   an address and a prefix. Drag the prefix and watch the 32 bits
 *            change hands between network and host, with every number that
 *            follows from that recomputed underneath. Then borrow bits and
 *            see the parent split.
 *
 *   ipv4     the twenty header bytes, built from their values. Change the TTL
 *            and the checksum moves — which is exactly why every router has to
 *            recompute it. Click a byte to corrupt it and watch the check fail.
 *
 * All arithmetic lives in addr.js, where the tests can reach it. Nothing here
 * computes anything a learner could check against an exam answer.
 */
import { el, render, clear } from '../dom.js'
import {
  parseIPv4, formatIPv4, bitsOf,
  maskFromPrefix, subnetInfo, classOf, specialOf, splitSubnets,
  buildIPv4Header, verifyIPv4Checksum, describeIPv4, PROTOCOLS,
} from './addr.js'

const T = (en, hi) => ({ en, hi })
const say = (t, lang) => (typeof t === 'string' ? t : t[lang] || t.en)

export const MODES = {
  subnet: {
    title: T('Subnetting — where the line falls', 'Subnetting — line kahan girti hai'),
    blurb: T(
      'An address is 32 bits. The prefix says how many of them name the network; the rest name a machine on it. Everything else — the mask, the broadcast address, how many hosts fit — follows from where that one line falls.',
      'Address 32 bits ka hai. Prefix batata hai unme se kitne network ka naam hain; baaki us par ki machine ka. Baaki sab — mask, broadcast address, kitne hosts aayenge — sirf isi ek line ki jagah se nikalta hai.',
    ),
    defaults: { address: '192.168.1.130', prefix: 26, splitTo: 26 },
  },
  ipv4: {
    title: T('The IPv4 header — twenty bytes', 'IPv4 header — bees bytes'),
    blurb: T(
      'Every packet you have sent today carried these twenty bytes in front of it. Change the TTL and watch the checksum move: that is why a router has to recompute it at every single hop.',
      'Aaj tumne jo bhi packet bheja, uske aage ye bees bytes lage the. TTL badlo aur checksum ko badalte dekho: isi wajah se har hop pe router ko ise dobara ginna padta hai.',
    ),
    defaults: { src: '192.168.1.5', dst: '140.82.113.4', ttl: 64, protocol: 6, damage: [] },
  },
}

export function createAddressLab({ node, langOf }) {
  let model = null

  function load(kind, params = {}) {
    const mode = MODES[kind]
    if (!mode) return false
    model = { kind, ...mode.defaults, ...params }
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
        el('span.lab__real', 'REAL MATH'),
      ),
      el('div.lab__body',
        el('p.lab__blurb', say(mode.blurb, lang)),
        model.kind === 'subnet' ? subnetView(lang) : headerView(lang),
      ),
    )
  }

  // ── subnetting ─────────────────────────────────────────────────────────
  function subnetView(lang) {
    const parsed = parseIPv4(model.address)
    if (!parsed.ok) {
      return el('div',
        addressInput(lang),
        el('div.lab__verdict lab__verdict--bad',
          el('span.lab__verdictMark', '✕'), parsed.error),
      )
    }

    const info = subnetInfo(parsed.value, model.prefix)
    const cls = classOf(parsed.value)
    const special = specialOf(parsed.value)
    const split = splitSubnets(info.network, model.prefix, Math.max(model.splitTo, model.prefix))

    return el('div',
      addressInput(lang),

      section(T('the 32 bits, and where the line falls', '32 bits, aur line kahan girti hai'),
        bitRuler(parsed.value, model.prefix),
        el('div.addr__legend',
          el('span.addr__key addr__key--net', lang === 'hi' ? 'network' : 'network'),
          el('span.addr__key addr__key--host', lang === 'hi' ? 'host' : 'host'),
          el('span.lab__meta', lang === 'hi'
            ? `${model.prefix} bits network ke, ${32 - model.prefix} host ke`
            : `${model.prefix} bits name the network, ${32 - model.prefix} name the machine`),
        ),
      ),

      section(T('everything that follows', 'jo isse nikalta hai'),
        el('div.addr__grid',
          row(T('mask', 'mask'), `${formatIPv4(info.mask)}  /${info.prefix}`),
          row(T('wildcard', 'wildcard'), formatIPv4(info.wildcard)),
          row(T('network', 'network'), formatIPv4(info.network), 'net'),
          row(T('broadcast', 'broadcast'), formatIPv4(info.broadcast), 'net'),
          row(T('first host', 'pehla host'), formatIPv4(info.firstHost), 'host'),
          row(T('last host', 'aakhri host'), formatIPv4(info.lastHost), 'host'),
          row(T('addresses', 'kul addresses'), info.total.toLocaleString('en-US')),
          row(T('usable hosts', 'kaam ke hosts'), info.usable.toLocaleString('en-US'), 'host'),
        ),
        model.prefix >= 31
          ? el('div.lab__meta', model.prefix === 32
            ? (lang === 'hi'
              ? 'Ek /32 ek hi machine hai — na network address, na broadcast.'
              : 'A /32 is one single machine — no network or broadcast address to spare.')
            : (lang === 'hi'
              ? 'Ek /31 point-to-point link hai. Yahan dono addresses use hote hain, kyunki network aur broadcast ke liye jagah hi nahi bachti.'
              : 'A /31 is a point-to-point link. Both addresses are usable here, precisely because there is no room for the usual network and broadcast.'))
          : null,
      ),

      section(T('what kind of address this is', 'ye kis kism ka address hai'),
        el('div.addr__badges',
          cls ? el('span.addr__badge', el('b', `class ${cls.letter}`),
            cls.prefix ? ` default /${cls.prefix}` : '', ' — ', cls.note) : null,
          special
            ? el('span.addr__badge addr__badge--warn', el('b', special.kind), ' — ', special.note)
            : el('span.addr__badge addr__badge--ok', el('b',
              lang === 'hi' ? 'public' : 'public'), ' — ',
            lang === 'hi' ? 'ye asli internet pe routable hai' : 'this one is routable on the real internet'),
        ),
        cls && cls.prefix && cls.prefix !== model.prefix
          ? el('div.lab__meta', lang === 'hi'
            ? `Classful duniya me iska mask /${cls.prefix} hota, chahe tumhe zaroorat ho ya na ho. CIDR ne wahi majboori khatam ki — isiliye tum /${model.prefix} chun sakte ho.`
            : `In the classful world this address got a /${cls.prefix} whether it needed one or not. CIDR removed that, which is why you can pick /${model.prefix} at all.`)
          : null,
      ),

      section(T('borrow bits, and split it', 'bits udhaar lo, aur baant do'),
        el('label.tl__slider',
          el('span.tl__sliderLabel', lang === 'hi' ? 'naya prefix' : 'new prefix'),
          el('input', {
            type: 'range', min: model.prefix, max: 32, step: 1,
            value: Math.max(model.splitTo, model.prefix),
            oninput: (e) => { model.splitTo = Number(e.target.value); draw() },
          }),
          el('span.tl__sliderValue', `/${Math.max(model.splitTo, model.prefix)}`),
        ),
        el('div.lab__meta', split.borrowed === 0
          ? (lang === 'hi' ? 'Abhi kuch udhaar nahi liya.' : 'Nothing borrowed yet.')
          : (lang === 'hi'
            ? `${split.borrowed} bits udhaar = ${split.count} subnets, har ek me ${split.subnets[0].usable} hosts`
            : `${split.borrowed} bits borrowed = ${split.count} subnets of ${split.subnets[0].usable} hosts each`)),
        split.subnets.length > 1
          ? el('div.addr__subnets',
            split.subnets.map((s, i) => el('div.addr__subnet',
              el('span.addr__subnetNum', String(i + 1).padStart(2, '0')),
              el('code', `${formatIPv4(s.network)}/${s.prefix}`),
              el('span.lab__meta', `${formatIPv4(s.firstHost)} – ${formatIPv4(s.lastHost)}`),
            )),
            split.truncated
              ? el('div.lab__meta', lang === 'hi'
                ? `…aur ${split.truncated.toLocaleString('en-US')} aur. Sirf pehle ${split.subnets.length} dikhaye gaye.`
                : `…and ${split.truncated.toLocaleString('en-US')} more. Only the first ${split.subnets.length} are listed.`)
              : null,
          )
          : null,
      ),

      el('div.lab__verdict lab__verdict--ok',
        el('span.lab__verdictMark', '→'),
        lang === 'hi'
          ? 'Ye tumhari apni machine pe bhi hai. Terminal me ifconfig chalao aur apna asli IP aur mask isi tarah tod ke dekho.'
          : 'This is not abstract — run ifconfig in the terminal and take your own address and mask apart the same way.'),
    )
  }

  const addressInput = (lang) => el('div.lab__inputs',
    el('label.lab__field',
      el('span.lab__fieldLabel', lang === 'hi' ? 'address' : 'address'),
      el('input.lab__input', {
        value: model.address,
        spellcheck: 'false',
        oninput: (e) => { model.address = e.target.value; redrawSoon() },
      }),
    ),
    el('label.tl__slider',
      el('span.tl__sliderLabel', lang === 'hi' ? 'prefix' : 'prefix'),
      el('input', {
        type: 'range', min: 0, max: 32, step: 1, value: model.prefix,
        oninput: (e) => {
          model.prefix = Number(e.target.value)
          if (model.splitTo < model.prefix) model.splitTo = model.prefix
          draw()
        },
      }),
      el('span.tl__sliderValue', `/${model.prefix}`),
    ),
  )

  /** Thirty-two bits in four groups, coloured by which side of the line they fall. */
  function bitRuler(value, prefix) {
    const bits = bitsOf(value)
    // The eight bits need their own row element. Passing the mapped array
    // straight into the octet made them eight siblings of the octet's value
    // label, so the column layout stacked the bits vertically instead.
    const octets = [0, 1, 2, 3].map((o) => el('span.addr__octet',
      el('span.addr__octetBits', bits.slice(o * 8, o * 8 + 8).map((b, i) => {
        const index = o * 8 + i
        const isNetwork = index < prefix
        return el('span.lab__bit', {
          class: `lab__bit addr__bit addr__bit--${isNetwork ? 'net' : 'host'}${index === prefix - 1 ? ' addr__bit--edge' : ''}`,
        }, el('span.lab__bitValue', String(b)))
      })),
      el('span.addr__octetValue', String((value >>> (24 - o * 8)) & 0xff)),
    ))
    return el('div.addr__ruler', octets)
  }

  const row = (label, value, tone) => el('div.addr__row',
    el('span.addr__rowLabel', say(label, langOf())),
    el('code', { class: `addr__rowValue${tone ? ` addr__rowValue--${tone}` : ''}` }, value),
  )

  // ── the IPv4 header ────────────────────────────────────────────────────
  function headerView(lang) {
    const src = parseIPv4(model.src)
    const dst = parseIPv4(model.dst)
    if (!src.ok || !dst.ok) {
      return el('div',
        headerInputs(lang),
        el('div.lab__verdict lab__verdict--bad',
          el('span.lab__verdictMark', '✕'), (src.ok ? dst : src).error),
      )
    }

    const built = buildIPv4Header({
      ttl: model.ttl, protocol: model.protocol, src: src.value, dst: dst.value,
    })

    const sent = Uint8Array.from(built.bytes)
    for (const i of model.damage) sent[i] ^= 0x01
    const check = verifyIPv4Checksum(sent)
    const fields = describeIPv4(sent)

    return el('div',
      headerInputs(lang),

      section(T('the fields', 'fields'),
        el('div.addr__fields', fields.map((f) => el('div.addr__field',
          el('span.addr__fieldAt', f.bits ? `${f.at}:${f.bits}` : `${f.at}${f.len > 1 ? `–${f.at + f.len - 1}` : ''}`),
          el('span.addr__fieldName', f.name),
          el('code.addr__fieldValue', String(f.value)),
          el('span.addr__fieldNote', f.note),
        ))),
      ),

      section(T('the bytes — click one to corrupt it', 'bytes — kisi ek pe click karke bigaad do'),
        el('div.addr__hex', Array.from(sent, (b, i) => el('button.addr__byte', {
          class: `addr__byte${model.damage.includes(i) ? ' addr__byte--broken' : ''}${i === 10 || i === 11 ? ' addr__byte--sum' : ''}`,
          title: `byte ${i}`,
          onclick: () => { toggleByte(i); draw() },
        },
        el('span.addr__byteHex', b.toString(16).padStart(2, '0')),
        el('span.addr__byteAt', String(i)),
        ))),
        el('div.lab__meta', lang === 'hi'
          ? 'Peela jodha checksum khud hai. Baaki koi bhi byte badlo — check fail ho jaayega.'
          : 'The highlighted pair is the checksum itself. Change any other byte and the check fails.'),
      ),

      section(T('what a router does at every hop', 'har hop pe router kya karta hai'),
        el('div.lab__controls',
          el('button.lab__btn', {
            onclick: () => { model.ttl = Math.max(0, model.ttl - 1); model.damage = []; draw() },
          }, lang === 'hi' ? 'ek hop aage (TTL − 1)' : 'one hop on (TTL − 1)'),
          el('span.lab__meta', `TTL ${model.ttl} · checksum 0x${built.checksum.toString(16).padStart(4, '0')}`),
        ),
        el('div.lab__meta', lang === 'hi'
          ? 'Har router TTL ek se ghata deta hai, isliye har router ko checksum dobara ginna padta hai. Ye ek chhoti si keemat hai jo har packet har hop pe deta hai.'
          : 'Every router subtracts one from the TTL, so every router has to recompute this checksum. It is a small cost that every packet pays at every hop.'),
      ),

      el('div.lab__verdict', {
        class: `lab__verdict lab__verdict--${check.ok ? 'ok' : 'bad'}`,
      },
      el('span.lab__verdictMark', check.ok ? '✓' : '✕'),
      check.ok
        ? (lang === 'hi'
          ? `checksum 0x${check.stored.toString(16).padStart(4, '0')} milta hai — header saaf hai`
          : `checksum 0x${check.stored.toString(16).padStart(4, '0')} matches — the header is intact`)
        : (lang === 'hi'
          ? `header me 0x${check.stored.toString(16).padStart(4, '0')} likha hai, ginti 0x${check.computed.toString(16).padStart(4, '0')} kehti hai — ye packet phenk diya jaayega`
          : `the header says 0x${check.stored.toString(16).padStart(4, '0')}, the arithmetic says 0x${check.computed.toString(16).padStart(4, '0')} — this packet gets discarded`)),
    )
  }

  function headerInputs(lang) {
    return el('div.lab__inputs',
      el('label.lab__field',
        el('span.lab__fieldLabel', lang === 'hi' ? 'kahan se' : 'source'),
        el('input.lab__input', {
          value: model.src, spellcheck: 'false',
          oninput: (e) => { model.src = e.target.value; model.damage = []; redrawSoon() },
        }),
      ),
      el('label.lab__field',
        el('span.lab__fieldLabel', lang === 'hi' ? 'kahan ko' : 'destination'),
        el('input.lab__input', {
          value: model.dst, spellcheck: 'false',
          oninput: (e) => { model.dst = e.target.value; model.damage = []; redrawSoon() },
        }),
      ),
      el('label.tl__slider',
        el('span.tl__sliderLabel', 'TTL'),
        el('input', {
          type: 'range', min: 1, max: 255, step: 1, value: model.ttl,
          oninput: (e) => { model.ttl = Number(e.target.value); model.damage = []; draw() },
        }),
        el('span.tl__sliderValue', String(model.ttl)),
      ),
      el('label.lab__field',
        el('span.lab__fieldLabel', lang === 'hi' ? 'andar kya hai' : 'carrying'),
        el('select.lab__input', {
          onchange: (e) => { model.protocol = Number(e.target.value); model.damage = []; draw() },
        }, Object.entries(PROTOCOLS).map(([num, name]) => el('option', {
          value: num,
          selected: Number(num) === model.protocol || null,
        }, `${num} — ${name}`))),
      ),
    )
  }

  function toggleByte(i) {
    const at = model.damage.indexOf(i)
    if (at >= 0) model.damage.splice(at, 1)
    else model.damage.push(i)
  }

  // ── shared ─────────────────────────────────────────────────────────────
  const section = (title, ...children) => el('div.lab__section',
    el('div.lab__sectionHead', say(title, langOf())), ...children)

  // Typing an address should not re-render on every keystroke and steal the caret.
  let pending = null
  function redrawSoon() {
    clearTimeout(pending)
    pending = setTimeout(draw, 260)
  }

  const close = () => { clearTimeout(pending); model = null; clear(node) }

  return { load, draw, close, isOpen: () => model !== null }
}
