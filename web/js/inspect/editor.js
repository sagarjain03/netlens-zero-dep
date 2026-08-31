/**
 * editor.js — edit a byte, then send it for real.
 *
 * This is the whole product in one interaction. The learner changes a byte, the
 * server re-parses the draft so they can see what they just became, and pressing
 * re-send puts *their* bytes on the wire. The internet answers differently.
 * Nothing about it is simulated, which is why it cannot be faked.
 *
 * The one subtlety is `expectId`. Editing the transaction id would otherwise
 * change nothing, because a DNS server echoes whatever id it receives. So the
 * re-send carries the id of the packet the learner STARTED from, and the reply
 * fails to match — exactly the check a resolver performs on a forged answer.
 */
import { el, render, typingInto } from '../dom.js'
import { get, set, subKeys, setResult, selectedPacket } from '../state.js'
import { api } from '../api.js'
import { hexToArray, arrayToHex } from './hex.js'

export function createEditor({ node, onLog }) {
  let pending = null   // debounce handle for the live re-parse

  // ── editing ───────────────────────────────────────────────────────────────

  function baseHex() {
    const packet = selectedPacket()
    if (!packet) return null
    return get().draftHex ?? packet.hex
  }

  function beginEdit(offset) {
    const packet = selectedPacket()
    if (!packet?.editable) return
    set({ editingOffset: offset, selectedSpan: get().selectedSpan ?? [offset, 1] })
  }

  /** Write one byte into the draft and ask the server what it now means. */
  function writeByte(offset, value) {
    const hex = baseHex()
    if (hex == null) return
    const bytes = hexToArray(hex)
    if (offset < 0 || offset >= bytes.length) return

    bytes[offset] = value & 0xff
    const draftHex = arrayToHex(bytes)
    set({ draftHex, editingOffset: null })
    schedulePreview(draftHex)
  }

  /** Debounced so holding a key does not fire a request per keystroke. */
  function schedulePreview(hex) {
    clearTimeout(pending)
    pending = setTimeout(() => preview(hex), 90)
  }

  async function preview(hex) {
    try {
      const res = await api.decode({ hex, proto: 'dns', lang: get().narrationLang })
      // Ignore a stale reply if the learner has typed again since.
      if (get().draftHex !== hex) return
      set({ draftTree: res.packet.tree, draftNote: res.packet.note || '' })
    } catch (err) {
      if (get().draftHex !== hex) return
      set({ draftTree: null, draftNote: err.message })
    }
  }

  function revert() {
    clearTimeout(pending)
    set({ draftHex: null, draftTree: null, draftNote: '', editingOffset: null })
  }

  // ── re-send ───────────────────────────────────────────────────────────────

  async function resend() {
    const packet = selectedPacket()
    const state = get()
    if (!packet?.editable || !state.draftHex) return

    // The id we are still waiting for is the ORIGINAL packet's, not the draft's.
    const originalId = parseInt(packet.hex.slice(0, 4), 16)

    onLog?.(`re-sending ${state.draftHex.length / 2} edited bytes`, 'out')
    try {
      const env = await api.dns({
        rawOverride: state.draftHex,
        expectId: originalId,
        lang: state.narrationLang,
      })
      setResult(env)
      if (env.meta.idMatch === false) {
        onLog?.(`reply REJECTED — waiting for 0x${originalId.toString(16).padStart(4, '0')}, got 0x${env.meta.gotId.toString(16).padStart(4, '0')}`, 'warn')
      } else if (env.text) {
        for (const row of env.text.split('\n')) onLog?.(`  ${row}`, 'in')
      } else {
        onLog?.(`  no answers (rcode ${env.meta.rcode})`, 'warn')
      }
    } catch (err) {
      onLog?.(err.message, 'err')
    }
  }

  // ── keyboard ──────────────────────────────────────────────────────────────
  //
  // Typing hex digits over the selected byte is how a hex editor has always
  // worked; e/r/u are the shortcuts printed on the bar itself.

  let halfByte = null   // first nibble typed, waiting for the second

  function onKey(e) {
    if (typingInto(e.target)) return
    const state = get()
    if (state.tier < 3) return
    const packet = selectedPacket()
    if (!packet?.editable) return

    const offset = state.editingOffset ?? state.selectedSpan?.[0]
    if (offset == null) return

    if (/^[0-9a-fA-F]$/.test(e.key)) {
      // Digits are also the tier shortcuts. In tier 3 with a byte selected they
      // mean hex, so stop the event here rather than letting both fire.
      e.preventDefault()
      e.stopPropagation()
      const nibble = parseInt(e.key, 16)
      if (halfByte === null) {
        halfByte = nibble
        set({ editingOffset: offset })
      } else {
        writeByte(offset, (halfByte << 4) | nibble)
        halfByte = null
      }
      return
    }

    switch (e.key) {
      case 'e':
        e.preventDefault()
        e.stopPropagation()
        halfByte = null
        beginEdit(offset)
        break
      case 'r':
        e.preventDefault()
        e.stopPropagation()
        halfByte = null
        resend()
        break
      case 'u':
        e.preventDefault()
        e.stopPropagation()
        halfByte = null
        revert()
        break
      case 'Escape':
        halfByte = null
        set({ editingOffset: null })
        break
      case 'ArrowRight':
        e.preventDefault()
        halfByte = null
        moveTo(offset + 1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        halfByte = null
        moveTo(offset - 1)
        break
    }
  }

  function moveTo(offset) {
    const hex = baseHex()
    if (hex == null) return
    const max = hex.length / 2
    const next = Math.min(max - 1, Math.max(0, offset))
    set({ selectedSpan: [next, 1], selectedBits: null, editingOffset: null })
  }

  // ── the bar ───────────────────────────────────────────────────────────────

  function draw(state) {
    const packet = selectedPacket()

    if (!packet || state.tier < 3) { node.hidden = true; return }

    if (!packet.editable) {
      node.hidden = false
      render(node, el('div.editbar__note',
        'This packet came from the server, so it cannot be edited. Switch to the sent packet to change it.'))
      return
    }

    const offset = state.editingOffset ?? state.selectedSpan?.[0]
    const dirty = Boolean(state.draftHex)
    const changed = dirty ? countChanges(packet.hex, state.draftHex) : 0

    node.hidden = false
    render(node,
      el('div.editbar__row',
        offset != null
          ? el('span.editbar__target', `byte ${offset}`)
          : el('span.editbar__target editbar__target--none', 'select a byte'),
        el('span.editbar__keys',
          key('0-9 a-f'), ' type   ',
          key('r'), ' re-send   ',
          key('u'), ' undo   ',
          key('← →'), ' move',
        ),
      ),
      dirty
        ? el('div.editbar__row editbar__row--dirty',
          el('span.editbar__badge', `${changed} byte${changed === 1 ? '' : 's'} changed`),
          el('button.btn btn--send', { onclick: resend }, 'Re-send for real'),
          el('button.btn', { onclick: revert }, 'Undo'),
        )
        : el('div.editbar__row editbar__row--idle',
          el('span.editbar__idle', 'Type over a byte to change it, then send it for real.')),
    )
  }

  const key = (label) => el('kbd', label)

  // Capture phase: the editor gets first refusal on a keystroke, because in
  // tier 3 with a byte selected a digit is hex, not a tier shortcut.
  addEventListener('keydown', onKey, { capture: true })
  subKeys(['packets', 'selectedPacketId', 'selectedSpan', 'editingOffset', 'draftHex', 'tier'], draw)
  draw(get())

  return { draw, resend, revert, writeByte, beginEdit }
}

export function countChanges(a, b) {
  const x = hexToArray(a)
  const y = hexToArray(b)
  let n = Math.abs(x.length - y.length)
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) n++
  return n
}
