
import { CATEGORIES, byCategory, spec } from './devices.js'
import * as store from './store.js'
import { audit, ipValid, maskToPrefix, networkAddress, broadcastDomain, addressesOf } from './net.js'

// ── left: the parts bin ─────────────────────────────────────────────────────

export function mountPalette(root, { onStatus }) {
  for (const cat of CATEGORIES) {
    const h = document.createElement('h2')
    h.className = 'bd-palette__h'
    h.textContent = cat.name
    if (cat.note) {
      const note = document.createElement('span')
      note.className = 'bd-palette__note'
      note.textContent = cat.note
      h.append(note)
    }
    root.append(h)

    const grid = document.createElement('div')
    grid.className = 'bd-palette__grid'

    for (const d of byCategory(cat.id)) {
      const item = document.createElement('button')
      item.className = 'bd-part'
      item.draggable = true
      item.dataset.kind = d.id
      item.title = d.blurb

      const glyph = document.createElement('span')
      glyph.className = 'bd-part__glyph'
      glyph.textContent = d.glyph
      const label = document.createElement('span')
      label.className = 'bd-part__name'
      label.textContent = d.name

      item.append(glyph, label)

      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/netlens-device', d.id)
        e.dataTransfer.effectAllowed = 'copy'
      })
      // Click also works, for anyone who does not want to drag.
      item.addEventListener('click', () => {
        const n = store.addNode(d.id, 60 + Math.random() * 320, 60 + Math.random() * 260)
        onStatus?.(`placed ${n.name} — drag it where you want it`)
      })

      grid.append(item)
    }
    root.append(grid)
  }
}

// ── right: properties ───────────────────────────────────────────────────────

export function paintProps(root, state, { onStatus }) {
  const n = state.nodes.find((x) => x.id === state.selected)
  root.replaceChildren()

  if (!n) {
    root.append(p('nothing selected — click a device on the grid', 'bd-dim'))
    const problems = audit(state)
    if (problems.length) {
      root.append(h3(`${problems.length} THING${problems.length > 1 ? 'S' : ''} TO FIX`))
      const ul = document.createElement('ul')
      ul.className = 'bd-problems'
      for (const pr of problems.slice(0, 8)) {
        const li = document.createElement('li')
        li.className = pr.level === 'err' ? 'is-err' : 'is-warn'
        li.textContent = pr.text
        ul.append(li)
      }
      root.append(ul)
    }
    return
  }

  const s = spec(n.kind)

  const head = document.createElement('div')
  head.className = 'bd-props__head'
  head.innerHTML = ''
  const g = document.createElement('span'); g.className = 'bd-props__glyph'; g.textContent = s.glyph
  const t = document.createElement('div')
  const t1 = document.createElement('strong'); t1.textContent = n.name
  const t2 = document.createElement('span'); t2.className = 'bd-dim'; t2.textContent = ` layer ${s.layer}`
  t.append(t1, t2)
  head.append(g, t)
  root.append(head)

  root.append(p(s.blurb, 'bd-blurb'))

  root.append(field('NAME', n.name, (v) => store.updateNode(n.id, { name: v || n.name })))

  if (s.hasIp) {
    root.append(field('IP_ADDRESS', n.ip, (v) => store.updateNode(n.id, { ip: v.trim() }),
      (v) => (v === '' || ipValid(v) ? null : 'four numbers, 0–255, like 192.168.1.10')))
    root.append(field('SUBNET_MASK', n.mask, (v) => store.updateNode(n.id, { mask: v.trim() }),
      (v) => (v === '' || maskToPrefix(v) !== null ? null : 'a mask is all 1s then all 0s, like 255.255.255.0')))
    if (s.forwards !== 'route') {
      root.append(field('DEFAULT_GATEWAY', n.gw, (v) => store.updateNode(n.id, { gw: v.trim() }),
        (v) => (v === '' || ipValid(v) ? null : 'the router address on this wire')))
    } else {
      // A router stands inside every subnet it serves, so it needs an address
      // in each. This is the difference between a router and everything else.
      const ifaces = n.ifaces ?? []
      ifaces.forEach((f, i) => {
        root.append(field(`INTERFACE_${i + 1}`, f.ip, (v) => {
          const next = ifaces.map((x, j) => (j === i ? { ...x, ip: v.trim() } : x))
          store.updateNode(n.id, { ifaces: next })
        }, (v) => (v === '' || ipValid(v) ? null : 'an address inside the other subnet')))
        root.append(field(`INTERFACE_${i + 1}_MASK`, f.mask, (v) => {
          const next = ifaces.map((x, j) => (j === i ? { ...x, mask: v.trim() } : x))
          store.updateNode(n.id, { ifaces: next })
        }, (v) => (v === '' || maskToPrefix(v) !== null ? null : 'like 255.255.255.0')))
      })
      if (ifaces.length + 1 < n.ports) {
        const add = document.createElement('button')
        add.className = 'bd-mini bd-mini--wide'
        add.textContent = '+ add interface (another subnet)'
        add.addEventListener('click', () => {
          store.updateNode(n.id, { ifaces: [...ifaces, { ip: '', mask: '255.255.255.0' }] })
          onStatus?.('give the new interface an address inside the other subnet')
        })
        root.append(add)
      }
      root.append(field('DEFAULT_ROUTE', n.gw, (v) => store.updateNode(n.id, { gw: v.trim() }),
        (v) => (v === '' || ipValid(v) ? null : 'where to send anything it has no interface for')))
    }
    if (n.ip && n.mask && maskToPrefix(n.mask) !== null && ipValid(n.ip)) {
      root.append(readout('NETWORK', `${networkAddress(n.ip, n.mask)}/${maskToPrefix(n.mask)}`))
    }
  } else {
    root.append(readout('ADDRESS', 'none — this device does not use IP'))
  }

  const links = store.linksOf(n.id)
  root.append(readout('PORTS_USED', `${links.length} of ${n.ports}`))

  if (s.hasIp) {
    const nets = addressesOf(n)
      .filter((a) => ipValid(a.ip) && maskToPrefix(a.mask) !== null)
      .map((a) => `${networkAddress(a.ip, a.mask)}/${maskToPrefix(a.mask)}`)
    if (nets.length > 1) root.append(readout('SERVES', nets.join('  ')))
  }

  const domain = broadcastDomain(n.id, state)
  root.append(readout('BROADCAST_DOMAIN', `${domain.size} device${domain.size === 1 ? '' : 's'}`))

  if (links.length) {
    root.append(h3('CABLES'))
    const ul = document.createElement('ul')
    ul.className = 'bd-links'
    for (const l of links) {
      const otherId = l.a === n.id ? l.b : l.a
      const other = state.nodes.find((x) => x.id === otherId)
      const li = document.createElement('li')
      const label = document.createElement('span')
      label.textContent = `${l.kind} → ${other?.name ?? '?'}`
      const rm = document.createElement('button')
      rm.className = 'bd-mini'
      rm.textContent = 'unplug'
      rm.addEventListener('click', () => { store.removeLink(l.id); onStatus?.('cable removed') })
      li.append(label, rm)
      ul.append(li)
    }
    root.append(ul)
  }

  const mine = audit(state).filter((pr) => pr.id === n.id)
  if (mine.length) {
    root.append(h3('PROBLEMS'))
    const ul = document.createElement('ul')
    ul.className = 'bd-problems'
    for (const pr of mine) {
      const li = document.createElement('li')
      li.className = pr.level === 'err' ? 'is-err' : 'is-warn'
      li.textContent = pr.text
      ul.append(li)
    }
    root.append(ul)
  }

  const del = document.createElement('button')
  del.className = 'bd-btn bd-btn--warn bd-btn--wide'
  del.textContent = `DELETE ${n.name}`
  del.addEventListener('click', () => { store.removeNode(n.id); onStatus?.('device removed') })
  root.append(del)
}

// ── little builders ─────────────────────────────────────────────────────────

function field(label, value, onCommit, validate) {
  const wrap = document.createElement('label')
  wrap.className = 'bd-field'
  const l = document.createElement('span'); l.className = 'bd-field__l'; l.textContent = label
  const i = document.createElement('input')
  i.value = value ?? ''
  i.spellcheck = false
  i.autocomplete = 'off'
  const err = document.createElement('span'); err.className = 'bd-field__err'

  const check = () => {
    const msg = validate ? validate(i.value.trim()) : null
    err.textContent = msg ?? ''
    i.classList.toggle('is-bad', Boolean(msg))
    return !msg
  }
  i.addEventListener('input', check)
  i.addEventListener('change', () => { if (check()) onCommit(i.value) })
  i.addEventListener('keydown', (e) => { if (e.key === 'Enter') i.blur() })

  wrap.append(l, i, err)
  return wrap
}

function readout(label, value) {
  const wrap = document.createElement('div')
  wrap.className = 'bd-read'
  const l = document.createElement('span'); l.className = 'bd-field__l'; l.textContent = label
  const v = document.createElement('span'); v.className = 'bd-read__v'; v.textContent = value
  wrap.append(l, v)
  return wrap
}

function h3(text) {
  const h = document.createElement('h3')
  h.className = 'bd-h3'
  h.textContent = text
  return h
}

function p(text, cls) {
  const el = document.createElement('p')
  if (cls) el.className = cls
  el.textContent = text
  return el
}
