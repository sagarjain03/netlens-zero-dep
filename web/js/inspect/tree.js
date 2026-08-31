/**
 * tree.js — the collapsible field tree.
 *
 * Reads `packet.tree` from the envelope, which the codec already built with a
 * span on every leaf. Selecting a field publishes that span to the store, and
 * the hex grid and bit ruler pick it up from there — no direct wiring between
 * the three views.
 *
 * When a draft is being edited the tree renders the *draft's* parse, so the
 * learner watches `QTYPE 1 (A)` turn into `QTYPE 28 (AAAA)` as they type.
 */
import { el, render, $ } from '../dom.js'
import { get, set, subKeys, selectedPacket } from '../state.js'

export function createTree({ node, tabsNode, metaNode, explainNode }) {
  const collapsed = new Set()

  function currentTree(state) {
    const packet = selectedPacket()
    if (!packet) return null
    // A draft only ever applies to the packet being edited.
    if (state.draftTree && packet.editable) return state.draftTree
    return packet.tree
  }

  // ── packet tabs ───────────────────────────────────────────────────────────

  function renderTabs(state) {
    render(tabsNode, state.packets.map((p) => el('button.ptab', {
      class: `ptab${p.id === state.selectedPacketId ? ' ptab--active' : ''}`,
      role: 'tab',
      'aria-selected': p.id === state.selectedPacketId ? 'true' : 'false',
      onclick: () => set({
        selectedPacketId: p.id,
        selectedSpan: null,
        selectedBits: null,
        selectionFromUser: true,
      }),
    },
    el('span.ptab__dir', { class: `ptab__dir ptab__dir--${p.dir}` }, p.dir === 'out' ? '→' : '←'),
    el('span', p.dir === 'out' ? 'Sent' : 'Received'),
    el('span.ptab__len', `${p.length} B`),
    p.editable ? el('span.ptab__edit', { title: 'this packet can be edited' }, '✎') : null,
    )))
  }

  // ── field rows ────────────────────────────────────────────────────────────

  function renderSection(section, state, path = '') {
    const key = `${path}/${section.name}`
    const isCollapsed = collapsed.has(key)

    return el('div.tsection',
      el('button.tsection__head', {
        onclick: () => {
          if (isCollapsed) collapsed.delete(key)
          else collapsed.add(key)
          draw(get())
        },
      },
      el('span.tsection__caret', isCollapsed ? '▸' : '▾'),
      el('span.tsection__name', section.name),
      section.span ? el('span.tsection__span', `${section.span[1]} B`) : null,
      ),
      isCollapsed ? null : el('div.tsection__body',
        (section.children ?? []).map((child) => (
          child.children ? renderSection(child, state, key) : renderLeaf(child, state)
        )),
      ),
    )
  }

  function renderLeaf(leaf, state) {
    const sel = state.selectedSpan
    const exact = sel && leaf.span && sel[0] === leaf.span[0] && sel[1] === leaf.span[1]
      && sameBits(state.selectedBits, leaf.bits)
    // A single byte picked in the hex grid highlights the field containing it.
    const owns = sel && sel[1] === 1 && !state.selectedBits && leaf.span && !leaf.bits
      && sel[0] >= leaf.span[0] && sel[0] < leaf.span[0] + leaf.span[1]
    const isSelected = exact || owns

    return el('button.tleaf', {
      class: `tleaf${isSelected ? ' tleaf--sel' : ''}${leaf.editHint ? ' tleaf--hint' : ''}`,
      onclick: () => set({
        selectedSpan: leaf.span ?? null,
        selectedBits: leaf.bits ?? null,
        editingOffset: null,
      }),
      title: leaf.explain ?? '',
    },
    el('span.tleaf__name', leaf.name),
    el('span.tleaf__value', leaf.value),
    leaf.editHint ? el('span.tleaf__flag', { title: leaf.editHint }, '✎') : null,
    )
  }

  const sameBits = (a, b) => (!a && !b) || (a && b && a[0] === b[0] && a[1] === b[1])

  // ── explanation box ───────────────────────────────────────────────────────

  function renderExplain(state) {
    const tree = currentTree(state)
    // Exact span first; otherwise whichever field owns this byte, so stepping
    // through the hex with the arrow keys keeps explaining where you are.
    const leaf = findLeaf(tree, state.selectedSpan, state.selectedBits)
      ?? leafAtOffset(tree, state.selectedSpan?.[0])
    if (!leaf || (!leaf.explain && !leaf.editHint && !leaf.note)) {
      explainNode.hidden = true
      return
    }
    explainNode.hidden = false
    render(explainNode,
      el('div.explainbox__name', leaf.name),
      leaf.explain ? el('div.explainbox__text', leaf.explain) : null,
      leaf.note ? el('div.explainbox__note', leaf.note) : null,
      leaf.editHint ? el('div.explainbox__hint', el('span.explainbox__tag', 'try'), leaf.editHint) : null,
    )
  }

  // ── draw ──────────────────────────────────────────────────────────────────

  function draw(state) {
    const packet = selectedPacket()
    if (!packet) {
      render(tabsNode)
      render(node, el('div.tempty', 'Run a command to inspect a packet.'))
      metaNode.textContent = ''
      explainNode.hidden = true
      return
    }

    renderTabs(state)

    const tree = currentTree(state)
    const edited = state.draftHex && packet.editable
    metaNode.textContent = edited
      ? `${packet.proto} · ${state.draftHex.length / 2} B · edited`
      : `${packet.proto} · ${packet.length} B`

    render(node,
      state.draftNote ? el('div.tparse-error', state.draftNote) : null,
      (tree ?? []).map((section) => renderSection(section, state)),
    )
    renderExplain(state)

    // The tree is taller than its pane, so a field selected from the hex grid
    // would otherwise change off-screen — which is exactly the change the
    // learner is trying to watch.
    node.querySelector('.tleaf--sel')?.scrollIntoView({ block: 'nearest' })
  }

  subKeys(
    ['packets', 'selectedPacketId', 'selectedSpan', 'selectedBits', 'draftTree', 'draftHex', 'draftNote', 'tier'],
    draw,
  )
  draw(get())

  return { draw }
}

/** Walk a tree to find the leaf a span/bits pair points at. */
export function findLeaf(tree, span, bits) {
  if (!tree || !span) return null
  const stack = [...tree]
  while (stack.length) {
    const node = stack.shift()
    if (node.children) { stack.push(...node.children); continue }
    if (!node.span) continue
    if (node.span[0] !== span[0] || node.span[1] !== span[1]) continue
    const a = node.bits ?? null
    if ((!a && !bits) || (a && bits && a[0] === bits[0] && a[1] === bits[1])) return node
  }
  return null
}

/**
 * Which leaf owns a given byte offset. The last match wins, so a bit-level field
 * beats the section that contains it.
 */
export function leafAtOffset(tree, offset) {
  if (!tree) return null
  let found = null
  const stack = [...tree]
  while (stack.length) {
    const node = stack.shift()
    if (node.children) { stack.push(...node.children); continue }
    if (!node.span) continue
    const [start, len] = node.span
    if (offset >= start && offset < start + len) found = node
  }
  return found
}

/** Every leaf in the tree, flattened — used by the hex grid for tooltips. */
export function flattenLeaves(tree) {
  const out = []
  const stack = [...(tree ?? [])]
  while (stack.length) {
    const node = stack.shift()
    if (node.children) stack.push(...node.children)
    else out.push(node)
  }
  return out
}
