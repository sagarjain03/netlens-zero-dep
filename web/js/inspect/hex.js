/**
 * hex.js — the hex grid, with an ASCII gutter.
 *
 * Sixteen bytes a row, the way every packet dump has looked since the 1970s,
 * because a learner who opens Wireshark tomorrow should recognise what they see.
 *
 * Clicking a byte selects the field that owns it, so the hex view and the field
 * tree drive each other in both directions from the one span that the codec
 * recorded during parsing.
 */
import { el, render } from '../dom.js'
import { get, set, subKeys, selectedPacket } from '../state.js'
import { leafAtOffset } from './tree.js'

const PER_ROW = 16

export function createHexView({ node, metaNode }) {
  function activeHex(state) {
    const packet = selectedPacket()
    if (!packet) return null
    return (state.draftHex && packet.editable) ? state.draftHex : packet.hex
  }

  function draw(state) {
    const packet = selectedPacket()
    const hex = activeHex(state)

    if (!packet || !hex) {
      render(node, el('div.tempty', 'No packet selected.'))
      metaNode.textContent = ''
      return
    }

    const bytes = hexToArray(hex)
    const original = hexToArray(packet.hex)
    const tree = (state.draftTree && packet.editable) ? state.draftTree : packet.tree
    const [selStart, selLen] = state.selectedSpan ?? [-1, 0]

    metaNode.textContent = `${bytes.length} bytes`

    const rows = []
    for (let base = 0; base < bytes.length; base += PER_ROW) {
      const slice = bytes.slice(base, base + PER_ROW)

      rows.push(el('div.hexrow',
        el('span.hexrow__off', base.toString(16).padStart(4, '0')),
        el('span.hexrow__bytes', slice.map((b, i) => {
          const offset = base + i
          const selected = offset >= selStart && offset < selStart + selLen
          const changed = original[offset] !== undefined && original[offset] !== b
          const editing = state.editingOffset === offset
          const owner = leafAtOffset(tree, offset)

          return el('span.hexbyte', {
            class: [
              'hexbyte',
              selected && 'hexbyte--sel',
              changed && 'hexbyte--changed',
              editing && 'hexbyte--editing',
              (i + 1) % 8 === 0 && 'hexbyte--group',
            ].filter(Boolean).join(' '),
            dataset: { offset: String(offset) },
            title: owner ? `${owner.name} = ${owner.value}` : `byte ${offset}`,
            onclick: () => selectByte(offset, tree),
          }, b.toString(16).padStart(2, '0'))
        })),
        el('span.hexrow__ascii', slice.map((b, i) => {
          const offset = base + i
          const selected = offset >= selStart && offset < selStart + selLen
          return el('span', {
            class: selected ? 'hexascii hexascii--sel' : 'hexascii',
            onclick: () => selectByte(offset, tree),
          }, printable(b))
        })),
      ))
    }

    render(node, rows)
  }

  /** Selecting a byte selects the field that contains it, not just the byte. */
  function selectByte(offset, tree) {
    const owner = leafAtOffset(tree, offset)
    set({
      selectedSpan: owner?.span ?? [offset, 1],
      selectedBits: owner?.bits ?? null,
      editingOffset: null,
    })
  }

  subKeys(
    ['packets', 'selectedPacketId', 'selectedSpan', 'draftHex', 'draftTree', 'editingOffset', 'tier'],
    draw,
  )
  draw(get())

  return { draw }
}

// ── helpers ─────────────────────────────────────────────────────────────────

export function hexToArray(hex) {
  const out = []
  for (let i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16))
  return out
}

export const arrayToHex = (arr) =>
  arr.map((b) => b.toString(16).padStart(2, '0')).join('')

/** Non-printable bytes become '.', exactly as every hex dump does. */
export const printable = (b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')
