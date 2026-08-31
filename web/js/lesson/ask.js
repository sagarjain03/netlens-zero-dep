/**
 * ask.js — the doubt box.
 *
 * The order here is the whole design. A question is offered to the glossary
 * first, and only what the glossary cannot answer is sent anywhere. That is
 * not a fallback ordering bolted on afterwards — it is the point.
 *
 *   · the glossary is instant, offline, deterministic and was written for
 *     exactly this app. Eighty-eight terms cover most of what a beginner
 *     stops to ask about mid-lesson.
 *   · the model handles the rest, grounded in the packet on screen, and its
 *     answer is labelled as coming from a model rather than from netlens.
 *
 * With no key configured the box still works and still helps, which is the
 * property that lets it be demoed on a bad connection.
 */
import { el, render } from '../dom.js'
import { get, selectedPacket } from '../state.js'
import { leafAtOffset } from '../inspect/tree.js'
import { GLOSSARY, KEYS } from './glossary.js'
import { chapter } from './chapters/index.js'
import { entry } from './topics/index.js'

/**
 * "What is this site?" is the most common first question anybody asks, and it
 * is answered here rather than by a model.
 *
 * Left to the model it got this wrong in a way no prompt reliably fixed: with
 * a DNS packet on screen it read "this site" as the host being looked up and
 * explained that the hostname was not in the bytes provided. Correct about
 * the packet, useless as an answer. A question about the app is a question
 * netlens can answer about itself, exactly, offline, every time.
 */
const ABOUT = /\b(netlens|this\s+(site|app|website|tool|page))\b|^\s*what\s+is\s+this\s*\??\s*$/i

const ABOUT_ANSWER = {
  term: 'netlens',
  en: 'A place to learn computer networks by sending real packets. Type a command and a genuine DNS, TLS or HTTP packet leaves your machine — then you can open it byte by byte, change one, and send it again. Eight chapters take you through it in order; the TOPICS tab is the full syllabus to come back to. Everything is built on the Node standard library, with no dependencies at all.',
  hi: 'Computer networks seekhne ki jagah, asli packets bhej ke. Command likho aur ek sach-much ka DNS, TLS ya HTTP packet tumhari machine se nikalta hai — phir use byte-dar-byte khol sakte ho, ek byte badal ke dobara bhej sakte ho. Aath chapters kram se le jaate hain; TOPICS tab me poora syllabus hai. Sab kuch Node ki standard library pe bana hai, ek bhi dependency ke bina.',
}

/**
 * Does the glossary already answer this?
 *
 * Matches on whole words so that asking about "a port" finds `port` and
 * asking about "important" does not. Longest key first, because "subnet mask"
 * is a better answer than "mask" when both appear.
 */
export function glossaryAnswer(question) {
  const text = String(question).toLowerCase()
  for (const key of KEYS) {
    const pattern = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (pattern.test(text)) return { key, ...GLOSSARY[key] }
  }
  return null
}

/** What the server needs to answer about the thing actually on screen. */
export function askContext() {
  const state = get()
  const packet = selectedPacket()

  const context = {
    lang: state.narrationLang,
    events: state.events?.slice(0, 6).map((e) => ({
      dir: e.dir, label: e.label, bytes: e.bytes, proto: e.proto,
    })),
  }

  if (state.mode === 'topics') {
    context.topic = entry(state.topic)?.title ?? state.topic
  } else {
    const ch = chapter(state.chapter)
    context.chapter = ch?.title
    context.tier = state.tier
  }

  if (packet) {
    // These are the field names a packet in the store actually has. Reading
    // `label` and `bytes` \u2014 which it does not \u2014 silently sent nothing.
    context.packet = {
      label: `${packet.proto ?? 'packet'} ${packet.dir === 'out' ? 'sent' : 'received'}`,
      bytes: packet.length,
      hex: packet.hex,
    }

    // Whatever field is open in the inspector. Somebody asking "why is this
    // zero" nearly always has one selected, and its name and value are the
    // two most useful facts we can hand over.
    const span = state.selectedSpan
    const leaf = span && packet.tree ? leafAtOffset(packet.tree, span[0]) : null
    if (leaf) context.field = { name: leaf.name, value: String(leaf.value) }
  }
  return context
}

export const aboutsThisApp = (q) => ABOUT.test(String(q))

/**
 * Is this a request for a definition, or a question about something specific?
 *
 * "what is a TTL" wants the glossary. "why is the TTL 64 here" wants the
 * packet on screen, and the glossary would only restate what a TTL is.
 */
export function isDefinitionQuestion(question) {
  const q = String(question).trim().toLowerCase()
  if (/\b(here|this packet|this byte|this field|in my|mine)\b/.test(q)) return false
  if (/^(why|how|when|where|which|should|can|does|do|is|are)\b/.test(q)) return false
  return /^(what|define|meaning|explain|tell me about)\b/.test(q) || q.split(/\s+/).length <= 4
}

export function createAsk({ node, langOf }) {
  let state = { open: false, question: '', busy: false, answer: null }

  const set = (patch) => { state = { ...state, ...patch }; draw() }

  async function submit() {
    const question = state.question.trim()
    if (!question || state.busy) return

    // Questions about netlens itself never leave the machine either.
    if (ABOUT.test(question)) {
      set({ answer: { source: 'glossary', term: ABOUT_ANSWER.term, text: ABOUT_ANSWER[langOf()] || ABOUT_ANSWER.en } })
      return
    }

    // The glossary next — but only for a question actually asking what a term
    // means. It used to answer anything containing a known word, so "why is
    // the AA bit zero here?" came back with the definition of "bit": true,
    // instant, and a worse answer than the question deserved.
    const known = glossaryAnswer(question)
    if (known && isDefinitionQuestion(question)) {
      set({ answer: { source: 'glossary', term: known.term, text: known[langOf()] || known.en, see: known.see } })
      return
    }

    set({ busy: true, answer: null })
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context: askContext() }),
      })
      const json = await res.json()
      set({
        busy: false,
        answer: json.answer
          ? { source: 'model', text: json.answer }
          // No model, but a term in the question the glossary does know. A
          // definition is a worse answer than the one asked for and a much
          // better one than nothing.
          : known
            ? { source: 'glossary', term: known.term, text: known[langOf()] || known.en, see: known.see }
            : { source: 'none', reason: json.reason },
      })
    } catch {
      set({
        busy: false,
        answer: known
          ? { source: 'glossary', term: known.term, text: known[langOf()] || known.en, see: known.see }
          : { source: 'none', reason: 'offline' },
      })
    }
  }

  function draw() {
    const lang = langOf()

    if (!state.open) {
      render(node, el('button.ask__open', {
        title: lang === 'hi' ? 'Kuch samajh nahi aaya?' : 'Something not making sense?',
        onclick: () => set({ open: true }),
      }, lang === 'hi' ? 'samajh nahi aaya?' : 'not making sense?'))
      return
    }

    render(node,
      el('div.ask__panel',
        el('div.ask__head',
          el('span', lang === 'hi' ? 'apna sawaal likho' : 'ask about what is on screen'),
          el('button.ask__close', { onclick: () => set({ open: false, answer: null }) }, '×'),
        ),

        el('form.ask__form', {
          onsubmit: (e) => { e.preventDefault(); submit() },
        },
        el('input.ask__input', {
          value: state.question,
          placeholder: lang === 'hi' ? 'jaise: TTL kya hota hai?' : 'e.g. what is a TTL?',
          oninput: (e) => { state.question = e.target.value },
        }),
        el('button.ask__send', { type: 'submit', disabled: state.busy || null },
          state.busy ? '…' : (lang === 'hi' ? 'poochho' : 'ask')),
        ),

        state.answer ? answerBox(state.answer, lang) : null,
      ),
    )
  }

  function answerBox(answer, lang) {
    if (answer.source === 'none') {
      return el('div.ask__answer ask__answer--none',
        el('div.ask__from', lang === 'hi' ? 'jawaab nahi mila' : 'no answer'),
        el('p', lang === 'hi'
          ? 'Ye sawaal glossary me nahi hai, aur model abhi uplabdh nahi hai. Neeche terminal me command chala ke khud dekh sakte ho.'
          : 'The glossary does not cover this, and the model is not available. You can still run the command below and look at the answer yourself.'),
        el('p.ask__reason', `(${answer.reason ?? 'unavailable'})`),
      )
    }

    const fromGlossary = answer.source === 'glossary'
    return el('div.ask__answer', { class: `ask__answer ask__answer--${answer.source}` },
      el('div.ask__from',
        fromGlossary
          ? (lang === 'hi' ? `netlens glossary · ${answer.term}` : `netlens glossary · ${answer.term}`)
          : (lang === 'hi' ? 'ek model se — jaanch lena' : 'from a model — worth checking')),
      el('p', answer.text),
    )
  }

  draw()
  return { draw, submit, isOpen: () => state.open }
}
