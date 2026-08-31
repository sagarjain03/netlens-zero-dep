/**
 * state.js — the entire state-management layer.
 *
 * Replaces: redux, zustand, jotai, and React's own re-render machinery.
 * Every view calls sub() once and re-renders when the slice it cares about
 * changes. That is all an app of this size needs.
 */

/** @type {Set<(state:object, patch:object)=>void>} */
const listeners = new Set()

let state = {
  // navigation
  //
  // Two ways in: the journey is a story taken once in order, TOPICS is the
  // syllabus entered anywhere. `mode` says which of them owns the screen.
  mode: 'journey',
  chapter: 1,
  tier: 1,
  topic: null,

  // the last API envelope — drives canvas, timeline and inspector together
  events: [],
  packets: [],
  meta: null,           // the endpoint's summary; challenge checks read this

  // inspector selection
  selectedPacketId: null,
  selectedSpan: null,      // [offset, length]
  selectedBits: null,      // [bitOffset, bitLength] within the selected byte
  selectionFromUser: false, // a click, rather than the default after a command

  // byte editor
  draftHex: null,       // edited copy of the selected packet, null while untouched
  draftTree: null,      // the draft re-parsed by the server, for live preview
  draftNote: '',        // why the draft fails to parse, if it does
  editingOffset: null,  // the byte currently being typed into

  // learner progress: { [chapterId]: { visited, challengeDone } }
  progress: {},

  // ui
  lab: null,            // { kind } while a bit-level lab owns the stage
  navOpen: true,        // the chapter rail; the hamburger and M toggle it
  lessonOpen: true,     // the teaching card over the canvas; L toggles it
  theme: 'dark',
  busy: false,
  narrationLang: 'en',
  playbackSpeed: 1,   // divisor: 4 plays the same exchange four times slower
}

export const get = () => state

/** Shallow-merge a patch and notify every subscriber. */
export function set(patch) {
  state = { ...state, ...patch }
  for (const fn of listeners) fn(state, patch)
  return state
}

/** @returns {() => void} unsubscribe */
export function sub(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Subscribe to one key only. Saves every view from diffing the whole store.
 * @param {string|string[]} keys
 */
export function subKeys(keys, fn) {
  const want = Array.isArray(keys) ? keys : [keys]
  return sub((s, patch) => {
    if (want.some((k) => k in patch)) fn(s, patch)
  })
}

/**
 * Replace the current result set (called after every command).
 *
 * The first packet is selected so the inspector and byte editor have something
 * to show, but `selectionFromUser` stays false: until the learner clicks a row,
 * the narration bar shows the OUTCOME (the last event) rather than the question
 * they just asked.
 */
export function setResult({ events = [], packets = [], meta = null }) {
  set({
    events,
    packets,
    // The endpoint's own summary — record types, TLS name match, HTTP status.
    // The canvas and inspector never needed it, so it used to be dropped here;
    // challenge verification reads it, and silently got undefined instead.
    meta,
    selectedPacketId: packets[0]?.id ?? null,
    selectedSpan: null,
    selectedBits: null,
    selectionFromUser: false,
    draftHex: null,
    draftTree: null,
    draftNote: '',
    editingOffset: null,
  })
}

export const selectedPacket = () =>
  state.packets.find((p) => p.id === state.selectedPacketId) ?? null
