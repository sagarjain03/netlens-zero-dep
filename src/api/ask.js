/**
 * ask.js — the "I don't understand this" button.
 *
 * A deliberately small, deliberately optional feature, and the design is
 * shaped by three constraints that were settled before a line of it existed.
 *
 * 1. It is a supplement, never the teacher. Everything else in netlens is
 *    deterministic, offline-capable and inspectable. If this became the way
 *    the app explains things, the pitch would quietly turn into "a chat
 *    wrapper", and the eighty-eight-term glossary would rot. So the glossary
 *    answers first and this only handles what the glossary cannot.
 *
 * 2. It must degrade to useful, not to broken. No key, no network, a rate
 *    limit, a bad gateway — every one of those returns a real answer from the
 *    glossary with `source: 'offline'`, and the interface says which it got.
 *    The demo cannot be one flaky Wi-Fi connection away from failing.
 *
 * 3. It is grounded, not asked to imagine. The prompt carries the actual
 *    packet on screen — the fields, the bytes, the chapter — so the model is
 *    describing something in front of it rather than recalling something
 *    about protocols in general. Ungrounded, it would invent plausible byte
 *    offsets, which is the single worst failure mode for this app.
 *
 * Zero dependencies still holds: this is `node:https` and nothing else. It is
 * an outbound network call, not a package, and DEPENDENCY-PROOF.md says so.
 */
import { request } from 'node:https'
import { sendJson } from '../server/respond.js'

const ENDPOINT = { host: 'api.groq.com', path: '/openai/v1/chat/completions' }
// Groq retires models without much notice, and a retired one answers 404.
// Override with NETLENS_ASK_MODEL; `curl api.groq.com/openai/v1/models` with
// your key lists what is currently served.
const MODEL = process.env.NETLENS_ASK_MODEL || 'openai/gpt-oss-120b'
const TIMEOUT_MS = 12_000
const MAX_QUESTION = 400

/** A plain cap, so a stuck loop in the client cannot run up somebody's bill. */
const RATE = { windowMs: 60_000, max: 12, hits: [] }

function withinRate(now = Date.now()) {
  RATE.hits = RATE.hits.filter((t) => now - t < RATE.windowMs)
  if (RATE.hits.length >= RATE.max) return false
  RATE.hits.push(now)
  return true
}

export const isConfigured = () => Boolean(process.env.GROQ_API_KEY)

/**
 * What the model is allowed to be. Short, because a long persona produces
 * long answers, and a long answer is the wrong shape for a lesson card.
 */
const SYSTEM = [
  'You explain computer networking to a beginner who is looking at a real packet.',
  'They are using netlens: a browser app that sends real DNS, TCP, TLS and HTTP',
  'packets from their own machine and lets them open, edit and re-send the bytes.',
  'It has eight chapters, a syllabus of topics, and labs for things a program',
  'cannot observe.',
  // With a DNS packet on screen, "this site" was read as the host being
  // looked up rather than as netlens, and the answer went somewhere useless.
  'If they say "this site", "this app", "this tool" or "netlens", they mean the',
  'app itself — never a hostname inside the packet. Answer about the app.',
  'Answer in at most four sentences. Plain language, no lists, no headings, no markdown.',
  'You are given the actual packet and chapter on screen. Refer to it directly.',
  'If the context does not contain what is needed, say so plainly rather than guessing.',
  'Never invent byte offsets, field names or values that are not in the context.',
].join(' ')

/**
 * Build the grounding block from whatever the client had on screen.
 * Kept small on purpose — the whole packet tree would bury the question.
 */
function groundIn({ chapter, tier, topic, field, packet, events, lang } = {}) {
  const lines = []

  if (chapter) lines.push(`Chapter: ${chapter}${tier ? ` (depth ${tier})` : ''}`)
  if (topic) lines.push(`Topic: ${topic}`)
  if (field) lines.push(`Selected field: ${field.name} = ${field.value}${field.note ? ` — ${field.note}` : ''}`)

  // The hex used to be nested inside the label check, so a packet with no
  // label sent no bytes at all and the model rightly said it had nothing.
  if (packet?.label) {
    lines.push(`Packet on screen: ${packet.label}${packet.bytes ? `, ${packet.bytes} bytes` : ''}`)
  }
  if (packet?.hex) {
    lines.push(`Its bytes in hex: ${String(packet.hex).slice(0, 160)}`)
  }

  if (Array.isArray(events) && events.length) {
    const summary = events.slice(0, 6)
      .map((e) => `${e.dir === 'out' ? '->' : '<-'} ${e.label} ${e.bytes ?? ''}B ${e.proto ?? ''}`.trim())
      .join('; ')
    lines.push(`Exchange: ${summary}`)
  }

  if (lang === 'hi') lines.push('Answer in Hinglish (Hindi written in Roman script).')

  return lines.join('\n') || 'No packet is on screen; answer generally but briefly.'
}

function callGroq(payload, key) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const req = request({
      ...ENDPOINT,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        authorization: `Bearer ${key}`,
      },
      timeout: TIMEOUT_MS,
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (res.statusCode !== 200) {
          // The body carries the actual reason — a decommissioned model, a
          // bad key, a quota. Dropping it turned a one-line fix into a hunt.
          let detail = ''
          try { detail = JSON.parse(text)?.error?.message ?? '' } catch { detail = text.slice(0, 160) }
          return reject(new Error(`groq ${res.statusCode}${detail ? `: ${detail}` : ''}`))
        }
        try {
          const json = JSON.parse(text)
          const answer = json.choices?.[0]?.message?.content?.trim()
          if (!answer) return reject(new Error('groq returned no answer'))
          resolve(answer)
        } catch {
          reject(new Error('groq returned something that was not JSON'))
        }
      })
    })

    req.on('timeout', () => req.destroy(new Error('groq timed out')))
    req.on('error', reject)
    req.end(body)
  })
}

export async function handleAsk({ res, body }) {
  const question = String(body?.question ?? '').trim().slice(0, MAX_QUESTION)
  if (!question) {
    return sendJson(res, { ok: false, error: 'ask what?', code: 'EMPTY' }, 400)
  }

  // Every failure below returns the same shape, so the client has one path.
  const decline = (reason) =>
    sendJson(res, { ok: true, source: 'offline', reason, answer: null })

  if (!isConfigured()) return decline('no-key')
  if (!withinRate()) return decline('rate-limit')

  try {
    const answer = await callGroq({
      model: MODEL,
      temperature: 0.2,
      // Generous, because the models Groq serves now spend tokens reasoning
      // before they answer, and a cap that only fits the answer truncates it
      // mid-sentence. Length is controlled by the instruction, not the cap.
      max_tokens: 700,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `${groundIn(body.context)}\n\nQuestion: ${question}` },
      ],
    }, process.env.GROQ_API_KEY)

    return sendJson(res, { ok: true, source: 'groq', model: MODEL, answer })
  } catch (err) {
    // A failed call is not an error the learner should see as a stack trace.
    // It is simply the offline path, and the card says so.
    return decline(err.message)
  }
}

/** Exported for the tests: the grounding block is the part worth pinning. */
export const _groundIn = groundIn
