/**
 * draw.js — canvas primitives. Replaces d3, pixi.js and konva.
 *
 * Every colour comes from the CSS custom properties in theme.css, read once and
 * refreshed on a theme change, so the canvas re-themes with the rest of the app
 * instead of carrying its own hard-coded palette.
 *
 * The drawing follows the same rules as the rest of the interface: monospace,
 * square corners, hairline rules. A node is a box with corner ticks, the way a
 * schematic marks a component — not a card with a shadow.
 */

const NODE_W = 118
const NODE_H = 56
const MONO = 'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace'
const TICK = 6            // length of the corner ticks on a node

// ── theme ───────────────────────────────────────────────────────────────────

let palette = null

export function readPalette() {
  const cs = getComputedStyle(document.documentElement)
  const v = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback)
  palette = {
    bg: v('--bg', '#0b0e14'),
    surface: v('--bg-2', '#161b26'),
    surfaceHi: v('--bg-3', '#1d2431'),
    line: v('--line', '#232b3a'),
    fg: v('--fg', '#dbe3f0'),
    fg1: v('--fg-1', '#9aa7bd'),
    fg2: v('--fg-2', '#64718a'),
    out: v('--out', '#4ea3ff'),
    in: v('--in', '#52d6a0'),
    warn: v('--warn', '#f0b232'),
    err: v('--err', '#f2555a'),
    accent: v('--accent', '#4ea3ff'),
  }
  return palette
}

export const colors = () => palette ?? readPalette()

// ── shapes ──────────────────────────────────────────────────────────────────

function box(ctx, x, y, w, h) {
  // Half-pixel offsets keep a 1px stroke on the pixel grid instead of blurring
  // it across two.
  ctx.beginPath()
  ctx.rect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h))
}

/** Corner ticks, the way a schematic marks a component. */
function cornerTicks(ctx, x, y, w, h, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const [cx, cy, dx, dy] of [
    [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1],
  ]) {
    ctx.moveTo(cx + dx * TICK, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * TICK)
  }
  ctx.stroke()
  ctx.restore()
}

// ── links ───────────────────────────────────────────────────────────────────

export function drawLink(ctx, a, b, { state = 'up', active = false } = {}) {
  const c = colors()
  ctx.save()
  ctx.lineWidth = active ? 2 : 1.25
  ctx.strokeStyle = state === 'down' ? c.err : active ? c.accent : c.line
  if (state === 'down') ctx.setLineDash([5, 5])
  else if (state === 'lossy') ctx.setLineDash([2, 6])

  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.restore()
}

// ── nodes ───────────────────────────────────────────────────────────────────

export function drawNode(ctx, node, { highlight = false } = {}) {
  const c = colors()
  const x = node.x - NODE_W / 2
  const y = node.y - NODE_H / 2
  // A router that stayed quiet is drawn as an outline rather than a box. It is
  // present and forwarding — it simply declined to introduce itself — so it must
  // not read as an error.
  const ghost = node.kind === 'silent'

  ctx.save()
  if (ghost) ctx.setLineDash([3, 3])

  box(ctx, x, y, NODE_W, NODE_H)
  if (!ghost) {
    ctx.fillStyle = highlight ? c.surfaceHi : c.surface
    ctx.fill()
  }
  ctx.strokeStyle = ghost ? c.fg2 : highlight ? c.accent : c.line
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.setLineDash([])

  if (highlight && !ghost) cornerTicks(ctx, x, y, NODE_W, NODE_H, c.accent)

  drawGlyph(ctx, node.kind, node.x, y + 18, ghost ? c.fg2 : highlight ? c.accent : c.fg1)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ghost ? c.fg2 : c.fg
  ctx.font = `600 11px ${MONO}`
  ctx.fillText(truncate(ctx, node.label, NODE_W - 14), node.x, y + 40)

  // Detail lives under the box: useful, but not identity.
  const sub = ghost ? 'NO_REPLY' : node.port ? `:${node.port}` : null
  if (sub) {
    ctx.fillStyle = c.fg2
    ctx.font = `9px ${MONO}`
    ctx.fillText(sub, node.x, y + NODE_H + 11)
  }

  ctx.restore()
}

/** Small line-art glyphs — cheaper and sharper than icon fonts or SVG sprites. */
function drawGlyph(ctx, kind, cx, cy, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.4
  ctx.lineCap = 'round'

  switch (kind) {
    case 'device': {          // a laptop
      ctx.strokeRect(cx - 10, cy - 7, 20, 13)
      ctx.beginPath()
      ctx.moveTo(cx - 14, cy + 8)
      ctx.lineTo(cx + 14, cy + 8)
      ctx.stroke()
      break
    }
    case 'resolver': {        // a phonebook: stacked pages
      for (let i = 0; i < 3; i++) {
        ctx.strokeRect(cx - 9, cy - 7 + i * 5, 18, 4)
      }
      break
    }
    case 'silent': {          // a question mark: present, but not answering
      ctx.font = `600 14px ${MONO}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('?', cx, cy)
      break
    }
    case 'router': {          // crossing arrows
      ctx.beginPath()
      ctx.moveTo(cx - 10, cy - 4); ctx.lineTo(cx + 10, cy - 4)
      ctx.moveTo(cx + 6, cy - 8); ctx.lineTo(cx + 10, cy - 4); ctx.lineTo(cx + 6, cy)
      ctx.moveTo(cx + 10, cy + 5); ctx.lineTo(cx - 10, cy + 5)
      ctx.moveTo(cx - 6, cy + 1); ctx.lineTo(cx - 10, cy + 5); ctx.lineTo(cx - 6, cy + 9)
      ctx.stroke()
      break
    }
    default: {                // a server rack
      for (let i = 0; i < 3; i++) {
        ctx.strokeRect(cx - 9, cy - 8 + i * 6, 18, 5)
        ctx.beginPath()
        ctx.arc(cx + 5, cy - 5.5 + i * 6, 1, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.restore()
}

// ── packets ─────────────────────────────────────────────────────────────────

/**
 * A packet in flight: a glowing dot with a short trail and its byte count.
 * `dir` picks the colour so outbound and inbound read differently at a glance.
 */
export function drawPacket(ctx, p) {
  const c = colors()
  const color = p.rejected ? c.err : p.dir === 'out' ? c.out : c.in
  const r = Math.min(11, 5 + Math.log10(Math.max(p.bytes, 1)) * 2.2)

  ctx.save()

  // trail
  const trail = 5
  for (let i = trail; i > 0; i--) {
    const t = i / trail
    const tx = p.x - (p.dx ?? 0) * t * 16
    const ty = p.y - (p.dy ?? 0) * t * 16
    ctx.globalAlpha = 0.1 * (1 - t)
    const tr = r * (1 - t * 0.4)
    ctx.fillStyle = color
    ctx.fillRect(tx - tr, ty - tr, tr * 2, tr * 2)
  }

  ctx.globalAlpha = 1
  ctx.shadowColor = color
  ctx.shadowBlur = 14
  ctx.fillStyle = color
  // A square marker, not a dot — it is a packet, and packets are blocks.
  ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2)
  ctx.shadowBlur = 0

  if (p.bytes) {
    ctx.globalAlpha = 0.95
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = color
    ctx.font = `600 9.5px ${MONO}`
    ctx.fillText(`${p.bytes}B`, p.x, p.y - r - 6)
  }

  if (p.rejected) {
    ctx.globalAlpha = 1
    ctx.strokeStyle = c.err
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(p.x - r * 0.6, p.y - r * 0.6); ctx.lineTo(p.x + r * 0.6, p.y + r * 0.6)
    ctx.moveTo(p.x + r * 0.6, p.y - r * 0.6); ctx.lineTo(p.x - r * 0.6, p.y + r * 0.6)
    ctx.stroke()
  }

  ctx.restore()
}

// ── captions ────────────────────────────────────────────────────────────────

/** The label above the animation saying what is happening right now. */
export function drawCaption(ctx, text, { width, height }) {
  if (!text) return
  const c = colors()
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = c.fg1
  ctx.font = `600 11px ${MONO}`
  ctx.letterSpacing = '0.12em'
  ctx.fillText(String(text).toUpperCase().replace(/ /g, '_'), width / 2, height * 0.12)
  ctx.letterSpacing = '0px'
  ctx.restore()
}

export function drawHint(ctx, text, { width, height }) {
  if (!text) return
  const c = colors()
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = c.fg2
  ctx.font = `10px ${MONO}`
  ctx.fillText(text, width / 2, height - 12)
  ctx.restore()
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
  return `${s}…`
}

export const NODE_SIZE = { w: NODE_W, h: NODE_H }
