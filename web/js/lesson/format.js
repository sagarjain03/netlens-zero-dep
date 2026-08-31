/**
 * format.js — the shape of a chapter, and the two helpers that read it.
 *
 * Chapter files are DATA, never logic. That decision is settled (docs/08):
 * eight chapters with eight code paths become eight divergent copies within a
 * day. One renderer reads all of them, so a new chapter is a data file and
 * nothing else.
 *
 * ── The shape ─────────────────────────────────────────────────────────────
 *
 *   {
 *     id, slug, title, real, proto,
 *
 *     question:  T,          the question the PREVIOUS chapter left open.
 *                            This is the narrative spine — printed at the top
 *                            of tier 1 so every chapter starts as an answer.
 *
 *     tier1: {               STORY. Read it.
 *       beats: [{ text: T,   max three lines. The design law in docs/03 is
 *                            "three lines, then the user must DO something" —
 *                            beats are how theory obeys it: a beat, an action,
 *                            a beat. Never a paragraph.
 *                 art: str }],   optional ASCII diagram under the beat
 *       hook: T,             the line that makes them care. Shown last.
 *     },
 *
 *     tier2: {               DO IT. Guided, in order.
 *       intro: T,
 *       steps: [{ say: T,    what we are about to do, in plain words
 *                 run: str,  the exact command — rendered as a Run button
 *                 after: T }],   what to look at in the output
 *     },
 *
 *     tier3: {               REAL BYTES. Deeper.
 *       intro: T,
 *       points: [T],
 *       edits: [{ field, to, result: T }],   byte-editor experiments
 *     },
 *
 *     challenge: { ask: T },
 *     terms: [str],          glossary keys this chapter is responsible for
 *   }
 *
 * `T` is a bilingual string: { en, hi }. `hi` is Hinglish in Roman script,
 * the same convention src/shared/explain.js already uses for field text.
 */

/** Read a bilingual value. Missing `hi` falls back to `en`, never to blank. */
export function pick(text, lang = 'en') {
  if (text == null) return ''
  if (typeof text === 'string') return text
  return text[lang] || text.en || ''
}

/** Split a beat into its lines so the renderer can stagger them. */
export const lines = (text, lang) =>
  pick(text, lang).split('\n').map((s) => s.trim()).filter(Boolean)
