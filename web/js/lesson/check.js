/**
 * check.js — deciding whether a challenge has actually been met.
 *
 * Chapters are data and never logic, so a challenge cannot carry a function.
 * It carries a small declaration instead — `{ kind: 'dnsType', type: 'AAAA' }`
 * — and this file is the one place that knows what those mean.
 *
 * The important rule here is what does NOT get a check.
 *
 * Four of the eight challenges are genuinely machine-checkable: they ask the
 * learner to make the network do something, and the envelope says whether it
 * did. The other four ask for an explanation, and no envelope can confirm one.
 * Those carry no verifier at all and the card says "answer this yourself"
 * rather than ticking green for having run a command. A progress mark that can
 * be earned without understanding anything is worth less than no mark.
 */

const CHECKS = {
  /**
   * A particular record type came back — chapter 2, where the learner edits
   * QTYPE by hand and an IPv6 address arrives instead of an IPv4 one.
   */
  dnsType({ meta }, { type }) {
    const types = meta?.answerTypes ?? []
    return types.includes(String(type).toUpperCase())
  },

  /**
   * A certificate arrived that does not cover the host actually dialled —
   * chapter 5's SNI swap. `matchesConnectedHost` is computed against the host
   * we connected to, not the name we asked for, which is the whole point.
   */
  certForOtherName({ meta }) {
    return meta?.matchesConnectedHost === false
  },

  /** A specific HTTP status was provoked — chapter 6 asks for a 304. */
  httpStatus({ meta }, { code }) {
    return meta?.status === code
  },

  /**
   * A trace reached at least this many hops. Each hop arrives as one event,
   * including the ones that did not answer — a silent router still counts,
   * because it still forwarded the packet.
   */
  hops({ events }, { min }) {
    return (events?.length ?? 0) >= min
  },
}

/**
 * @param {object} envelope the result just installed in the store
 * @param {object|undefined} verify the declaration from the chapter file
 * @returns {boolean} false for anything unverifiable, including a missing or
 *   unknown declaration — this never guesses in the learner's favour.
 */
export function passes(envelope, verify) {
  if (!verify || !envelope) return false
  const check = CHECKS[verify.kind]
  if (!check) return false
  try {
    return Boolean(check(envelope, verify))
  } catch {
    // A malformed envelope means the challenge was not met, not that the app
    // should fall over while somebody is halfway through a lesson.
    return false
  }
}

export const isCheckable = (verify) => Boolean(verify && CHECKS[verify.kind])

export const kinds = () => Object.keys(CHECKS)
