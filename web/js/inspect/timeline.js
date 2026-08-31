/**
 * timeline.js — the event list under the canvas.
 *
 * Reads `events` straight from the shared envelope, so it renders a DNS lookup,
 * a TLS handshake or a traceroute without knowing which one it is. Selecting a
 * row selects that row's packet, which is what drives the inspector.
 */
import { el, render } from '../dom.js'
import { get, set, subKeys } from '../state.js'
import { displayName } from '../viz/scene.js'

export function createTimeline({ listNode, sectionNode, narrationNode }) {
  function draw(state) {
    const { events, tier } = state

    sectionNode.hidden = tier < 2 || events.length === 0
    narrationNode.hidden = events.length === 0

    if (!events.length) {
      render(listNode)
      return
    }

    render(listNode, events.map((e) => {
      const selected = e.packetId && e.packetId === state.selectedPacketId
      return el('li', {
        class: `tl tl--${e.dir}${selected ? ' tl--sel' : ''}`,
        onclick: () => e.packetId && set({
          selectedPacketId: e.packetId,
          selectedSpan: null,
          selectedBits: null,
          selectionFromUser: true,
        }),
        title: e.narration || '',
      },
      el('span.tl__dot', e.dir === 'out' ? '●' : '●'),
      el('span.tl__t', `${e.t.toFixed(1)}ms`),
      el('span.tl__label', e.label),
      el('span.tl__peer', e.dir === 'out' ? `→ ${displayName(e.to)}` : `← ${displayName(e.from)}`),
      el('span.tl__bytes', `${formatBytes(e.bytes)}`),
      el('span.tl__proto', e.proto),
      )
    }))

    // Default to the last event — the outcome is what a beginner needs to read.
    // Once they click a row, the narration follows their selection instead.
    const forSelected = state.selectionFromUser
      ? events.find((e) => e.packetId === state.selectedPacketId)
      : null
    const chosen = forSelected ?? events[events.length - 1]
    render(narrationNode, chosen?.narration ? el('div', chosen.narration) : null)
    narrationNode.hidden = !chosen?.narration
  }

  subKeys(['events', 'selectedPacketId', 'selectionFromUser', 'tier'], draw)
  draw(get())

  return { draw }
}

function formatBytes(n) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  return `${(n / 1024).toFixed(1)} KB`
}
