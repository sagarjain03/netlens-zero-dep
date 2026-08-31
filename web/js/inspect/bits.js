/**
 * bits.js — the bit ruler. The fourth and last zoom level.
 *
 * A byte such as the DNS flags octet holds five separate fields. Showing it as
 * `0x01` teaches nothing; showing it as eight labelled bits is the moment the
 * header stops being a hex blob and becomes a set of switches.
 *
 *   byte 2   0x01   0 0000 0 0 1
 *                   │ │    │ │ └ RD      1  recursion desired
 *                   │ │    │ └── TC      0
 *                   │ │    └──── AA      0
 *                   │ └───────── Opcode  0  QUERY
 *                   └─────────── QR      0  query
 */
import { el, render } from '../dom.js'
import { get, subKeys, selectedPacket } from '../state.js'
import { flattenLeaves } from './tree.js'
import { hexToArray } from './hex.js'

export function createBitView({ node }) {
  function draw(state) {
    const packet = selectedPacket()
    const span = state.selectedSpan

    if (!packet || !span) {
      node.hidden = true
      return
    }

    const hex = (state.draftHex && packet.editable) ? state.draftHex : packet.hex
    const bytes = hexToArray(hex)
    const offset = span[0]
    const value = bytes[offset]

    if (value === undefined) {
      node.hidden = true
      return
    }

    const tree = (state.draftTree && packet.editable) ? state.draftTree : packet.tree
    // Every field that lives inside this one byte, in bit order.
    const inByte = flattenLeaves(tree)
      .filter((leaf) => leaf.bits && leaf.span?.[0] === offset)
      .sort((a, b) => a.bits[0] - b.bits[0])

    const selBits = state.selectedBits

    node.hidden = false
    render(node,
      el('div.bits__head',
        el('span.bits__label', `byte ${offset}`),
        el('span.bits__hex', `0x${value.toString(16).padStart(2, '0')}`),
        el('span.bits__dec', String(value)),
      ),

      el('div.bits__row', Array.from({ length: 8 }, (_, i) => {
        const bit = (value >> (7 - i)) & 1
        const selected = selBits && i >= selBits[0] && i < selBits[0] + selBits[1]
        const owner = inByte.find((f) => i >= f.bits[0] && i < f.bits[0] + f.bits[1])
        return el('span.bit', {
          class: `bit${selected ? ' bit--sel' : ''}${bit ? ' bit--on' : ''}${i === 3 ? ' bit--gap' : ''}`,
          title: owner ? `${owner.name} = ${owner.value}` : `bit ${i}`,
        }, String(bit))
      })),

      inByte.length
        ? el('div.bits__fields', inByte.map((f) => {
          const selected = selBits && f.bits[0] === selBits[0] && f.bits[1] === selBits[1]
          return el('div.bitfield', { class: `bitfield${selected ? ' bitfield--sel' : ''}` },
            el('span.bitfield__range', f.bits[1] === 1 ? `bit ${f.bits[0]}` : `bits ${f.bits[0]}–${f.bits[0] + f.bits[1] - 1}`),
            el('span.bitfield__name', f.name),
            el('span.bitfield__value', f.value),
          )
        }))
        : el('div.bits__none', 'This byte is not split into bit fields.'),
    )
  }

  subKeys(
    ['packets', 'selectedPacketId', 'selectedSpan', 'selectedBits', 'draftHex', 'draftTree', 'tier'],
    draw,
  )
  draw(get())

  return { draw }
}
