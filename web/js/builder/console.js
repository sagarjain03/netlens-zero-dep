
import { spec } from './devices.js'
import * as store from './store.js'
import { canReach, pathToInternet, ipValid, broadcastDomain, audit } from './net.js'

const HELP = [
  ['send <ip>', 'fire a packet and WATCH it cross the grid, hop by hop'],
  ['ping <host>', 'reachable? — a device on your grid, or anything on the internet'],
  ['dig <domain> [type]', 'a real DNS query. try:  dig github.com AAAA'],
  ['tracert <host>', 'every router between here and there, live'],
  ['tls <host>', 'handshake and read the certificate'],
  ['curl <url>', 'fetch a page with a request we wrote by hand'],
  ['arp', 'who else is in this broadcast domain'],
  ['ipconfig', 'this device\'s own address settings'],
  ['route', 'where this device sends traffic'],
  ['check', 'test every device on the grid at once'],
  ['clear', 'clear the console'],
]

export function mountConsole({ out, input, who, onSend }) {
  const history = []
  let cursor = -1

  const write = (text, cls = '') => {
    const line = document.createElement('div')
    line.className = `bd-line ${cls}`
    line.textContent = text
    out.append(line)
    out.scrollTop = out.scrollHeight
    return line
  }

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length) { cursor = Math.min(cursor + 1, history.length - 1); input.value = history[cursor] }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      cursor = Math.max(cursor - 1, -1)
      input.value = cursor === -1 ? '' : history[cursor]
      return
    }
    if (e.key !== 'Enter') return

    const line = input.value.trim()
    if (!line) return
    input.value = ''
    history.unshift(line)
    cursor = -1

    const dev = store.node(store.get().selected)
    write(`${dev ? dev.name : '?'}> ${line}`, 'bd-line--cmd')

    input.disabled = true
    const [cmd, ...args] = line.split(/\s+/)
    let ok = false
    let extra = {}
    try {
      extra = (await run(line, dev, write, { onSend })) ?? {}
      ok = extra.ok !== false
    } catch (err) {
      write(`error: ${err.message}`, 'bd-line--err')
      ok = false
    } finally {
      // The tutor reads this log, which is how a lesson step can be
      // "run it and watch it fail" instead of only "arrange the boxes right".
      store.recordCommand({ cmd, args, devName: dev?.name ?? null, ok, ...extra })
      input.disabled = false
      input.focus()
    }
  })

  function paint(state) {
    const dev = state.nodes.find((n) => n.id === state.selected)
    const usable = dev && spec(dev.kind)?.hasIp
    input.disabled = !usable
    who.textContent = dev
      ? (usable ? `— ${dev.name}` : `— ${dev.name} has no console`)
      : '— no device'
  }

  write('select a device, then type a command. `help` lists them.', 'bd-line--dim')
  return { paint, write }
}

// ── command dispatch ────────────────────────────────────────────────────────

async function run(line, dev, write, { onSend } = {}) {
  const [cmd, ...args] = line.split(/\s+/)
  const topo = store.get()

  if (cmd === 'clear') { document.getElementById('console-out').replaceChildren(); return { ok: true } }

  if (cmd === 'help') {
    for (const [c, d] of HELP) write(`  ${c.padEnd(22)} ${d}`, 'bd-line--dim')
    return { ok: true }
  }

  if (cmd === 'check') return checkAll(topo, write)

  if (!dev) { write('select a device first', 'bd-line--err'); return { ok: false } }
  if (!spec(dev.kind)?.hasIp) { write(`a ${spec(dev.kind).name} has no console of its own`, 'bd-line--err'); return { ok: false } }

  switch (cmd) {
    case 'ipconfig': return ipconfig(dev, write)
    case 'route': return route(dev, topo, write)
    case 'arp': return arp(dev, topo, write)
    case 'send': case 'pdu': return send(dev, args[0], topo, write, onSend)
    case 'ping': return ping(dev, args[0], topo, write)
    case 'dig': return dig(dev, args, topo, write)
    case 'tracert': case 'traceroute': return tracert(dev, args[0], topo, write)
    case 'tls': return tls(dev, args[0], topo, write)
    case 'curl': return curl(dev, args[0], topo, write)
    default:
      write(`unknown command "${cmd}" — type help`, 'bd-line--err')
      return { ok: false }
  }
}

// ── local, answered from the drawing ────────────────────────────────────────

function ipconfig(dev, write) {
  write(`  address ...... ${dev.ip || '(not set)'}`)
  write(`  mask ......... ${dev.mask || '(not set)'}`)
  write(`  gateway ...... ${dev.gw || '(not set)'}`)
  write(`  ports used ... ${store.linksOf(dev.id).length} of ${dev.ports}`)
  return { ok: true }
}

function route(dev, topo, write) {
  if (!ipValid(dev.ip) || !dev.mask) return write('set an address and mask first', 'bd-line--err')
  write('  DESTINATION        VIA')
  write(`  own subnet         direct, no router involved`)
  write(`  everything else    ${dev.gw || '(nowhere — no gateway set)'}`)
  const out = pathToInternet(dev.id, topo)
  write(`  internet ......... ${out.ok ? 'reachable' : 'NOT reachable'}`, out.ok ? 'bd-line--ok' : 'bd-line--warn')
  if (!out.ok) write(`  ${out.why}`, 'bd-line--dim')
  return { ok: true }
}

function arp(dev, topo, write) {
  const domain = [...broadcastDomain(dev.id, topo)]
    .map((id) => topo.nodes.find((n) => n.id === id))
    .filter((n) => n && n.id !== dev.id && spec(n.kind)?.hasIp && n.ip)
  if (!domain.length) return write('nobody else with an address on this wire', 'bd-line--warn')
  write('  ADDRESS          DEVICE')
  for (const n of domain) write(`  ${String(n.ip).padEnd(16)} ${n.name}`)
  write('  these are reachable without a router — same broadcast domain', 'bd-line--dim')
  return { ok: true }
}

// ── real, once the drawing checks out ───────────────────────────────────────

async function send(dev, ip, topo, write, onSend) {
  if (!ip) { write('usage: send <ip of a device on the grid>', 'bd-line--err'); return { ok: false } }
  if (!onSend) { write('the animator is not available', 'bd-line--err'); return { ok: false } }
  write('  watch the grid — the trace panel fills as it travels', 'bd-line--dim')
  const res = await onSend(dev.id, ip)
  if (!res) { write('  a packet is already in flight', 'bd-line--warn'); return { ok: false } }
  for (const s of res.steps) {
    write(`  ${s.title}`, s.kind === 'drop' ? 'bd-line--err' : s.kind === 'deliver' ? 'bd-line--ok' : '')
  }
  write(`  ${res.ok ? 'delivered' : res.reason}`, res.ok ? 'bd-line--ok' : 'bd-line--err')
  return { ok: res.ok }
}

async function ping(dev, host, topo, write) {
  if (!host) { write('usage: ping <host>', 'bd-line--err'); return { ok: false } }

  // A device on your own grid never leaves the browser.
  const local = canReach(dev.id, host, topo)
  if (local.scope !== 'offgrid') {
    write(local.ok ? `  reply from ${host} — ${local.why}` : `  ${local.why}`,
      local.ok ? 'bd-line--ok' : 'bd-line--err')
    if (!local.ok) write('  nothing was sent — fix the drawing and run it again.', 'bd-line--dim')
    return { ok: local.ok }
  }

  const out = pathToInternet(dev.id, topo)
  if (!out.ok) return blocked(out, write)

  write(`  ${out.why}`, 'bd-line--dim')
  const json = await post('/api/sys', { op: 'ping', host })
  const p = json.meta?.data
  if (!p) { write('  no result', 'bd-line--warn'); return { ok: false } }
  write(`  ${p.reachable ? 'reachable' : 'no reply'} — sent ${p.sent}, got ${p.received}`,
    p.reachable ? 'bd-line--ok' : 'bd-line--warn')
  if (p.avg != null) write(`  average ${p.avg} ms${p.ttl != null ? `, ttl ${p.ttl}` : ''}`)
  if (!p.reachable && p.reason) write(`  ${p.reason}`, 'bd-line--dim')
  return { ok: p.reachable }
}

async function dig(dev, args, topo, write) {
  const domain = args.find((a) => !a.startsWith('@') && !/^[A-Z]+$/.test(a))
  if (!domain) { write('usage: dig <domain> [A|AAAA|MX|TXT|NS|CNAME]', 'bd-line--err'); return { ok: false } }
  const type = args.find((a) => /^[A-Z]+$/.test(a)) ?? 'A'
  const server = args.find((a) => a.startsWith('@'))?.slice(1)

  const out = pathToInternet(dev.id, topo)
  if (!out.ok) return blocked(out, write)

  write(`  ${out.why}`, 'bd-line--dim')
  const json = await post('/api/dns', { domain, type, server })
  for (const e of json.events ?? []) {
    write(`  ${e.dir === 'out' ? '→' : '←'} ${e.label}  ${e.bytes}B  ${e.t}ms`, e.dir === 'out' ? '' : 'bd-line--ok')
  }
  if (json.text) for (const l of json.text.split('\n')) write(`  ${l}`)
  const q = (json.packets ?? [])[0]
  if (q) write(`  query bytes: ${q.hex.slice(0, 72)}${q.hex.length > 72 ? '…' : ''}`, 'bd-line--dim')
  return { ok: true }
}

async function tracert(dev, host, topo, write) {
  if (!host) { write('usage: tracert <host>', 'bd-line--err'); return { ok: false } }
  const out = pathToInternet(dev.id, topo)
  if (!out.ok) return blocked(out, write)

  write(`  ${out.why}`, 'bd-line--dim')
  write('  tracing — hops appear as they answer', 'bd-line--dim')

  await new Promise((resolve) => {
    const src = new EventSource(`/api/trace/stream?host=${encodeURIComponent(host)}`)
    src.onmessage = (e) => {
      let d
      try { d = JSON.parse(e.data) } catch { return }
      if (d.done) { src.close(); write('  done', 'bd-line--ok'); resolve(); return }
      if (d.hop) {
        const ms = d.hop.rttMs != null ? `${d.hop.rttMs} ms` : '*'
        write(`  ${String(d.hop.ttl).padStart(2)}  ${(d.hop.ip ?? '* * *').padEnd(18)} ${ms}`)
      }
    }
    src.onerror = () => { src.close(); write('  stream ended', 'bd-line--warn'); resolve() }
  })
  return { ok: true }
}

async function tls(dev, host, topo, write) {
  if (!host) { write('usage: tls <host>', 'bd-line--err'); return { ok: false } }
  const out = pathToInternet(dev.id, topo)
  if (!out.ok) return blocked(out, write)

  write(`  ${out.why}`, 'bd-line--dim')
  const json = await post('/api/tls', { host })
  const cert = json.meta?.certificates?.[0]
  if (cert) {
    write(`  subject ...... ${cert.subjectCN ?? '?'}`, 'bd-line--ok')
    write(`  issuer ....... ${cert.issuerCN ?? '?'}`)
    write(`  valid ........ ${cert.notBefore ?? '?'} → ${cert.notAfter ?? '?'}`)
  }
  for (const e of json.events ?? []) write(`  ${e.dir === 'out' ? '→' : '←'} ${e.label}  ${e.bytes}B`)
  return { ok: true }
}

async function curl(dev, url, topo, write) {
  if (!url) { write('usage: curl <url>', 'bd-line--err'); return { ok: false } }
  const out = pathToInternet(dev.id, topo)
  if (!out.ok) return blocked(out, write)

  write(`  ${out.why}`, 'bd-line--dim')
  const json = await post('/api/http', { url: /^https?:/.test(url) ? url : `https://${url}` })
  for (const e of json.events ?? []) write(`  ${e.dir === 'out' ? '→' : '←'} ${e.label}  ${e.bytes}B  ${e.t}ms`)
  if (json.text) for (const l of json.text.split('\n').slice(0, 16)) write(`  ${l}`)
  return { ok: true }
}

// ── the whole grid at once ──────────────────────────────────────────────────

function checkAll(topo, write) {
  const ends = topo.nodes.filter((n) => spec(n.kind)?.hasIp && spec(n.kind)?.forwards !== 'route')
  if (!ends.length) { write('no end devices on the grid yet', 'bd-line--warn'); return { ok: false, allOk: false } }

  const problems = audit(topo)
  let allOk = problems.every((p) => p.level !== 'err')

  for (const n of ends) {
    const out = pathToInternet(n.id, topo)
    if (!out.ok) allOk = false
    write(`  ${n.name.padEnd(14)} ${out.ok ? 'internet OK' : 'blocked'}`, out.ok ? 'bd-line--ok' : 'bd-line--err')
    if (!out.ok) write(`  ${' '.repeat(14)} ${out.why}`, 'bd-line--dim')
  }
  for (const p of problems) {
    write(`  ${p.text}`, p.level === 'err' ? 'bd-line--err' : 'bd-line--warn')
  }
  write(allOk ? '  every device passes' : '  not there yet', allOk ? 'bd-line--ok' : 'bd-line--warn')
  return { ok: true, allOk }
}

// ── helpers ─────────────────────────────────────────────────────────────────

function blocked(result, write) {
  write('  nothing was sent.', 'bd-line--err')
  write(`  ${result.why}`, 'bd-line--warn')
  write('  fix the drawing and run it again — this is the same reason a real network fails.', 'bd-line--dim')
  return { ok: false }
}

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json().catch(() => ({ ok: false, error: `bad response (${res.status})` }))
  if (!json.ok) throw new Error(json.error || 'request failed')
  return json
}
