/**
 * commands.js — the command registry.
 *
 * Each command declares its usage and examples once; help, the inline hint bar
 * and tab completion all read from the same declaration, so a new chapter's
 * command cannot end up undocumented.
 *
 * `dig` deliberately keeps real dig's `@server` syntax. A learner who types
 * `dig @8.8.8.8 github.com MX` here has typed a command that works in a real
 * shell too — that transfer is part of the teaching.
 */
import { api, stream } from '../api.js'
import { setResult, get, set } from '../state.js'

// ── argument parsing ────────────────────────────────────────────────────────

/** Split a command line, honouring quotes. Replaces a yargs-style parser. */
export function tokenize(input) {
  const tokens = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m
  while ((m = re.exec(input))) tokens.push(m[1] ?? m[2] ?? m[3])
  return tokens
}

/** Pull `--flag value` and `--flag` out of a token list, returning the rest. */
export function parseFlags(tokens) {
  const flags = {}
  const rest = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.startsWith('--')) {
      const [name, inline] = t.slice(2).split('=')
      if (inline !== undefined) flags[name] = inline
      else if (tokens[i + 1] && !tokens[i + 1].startsWith('--')) flags[name] = tokens[++i]
      else flags[name] = true
    } else rest.push(t)
  }
  return { flags, args: rest }
}

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV', 'CAA', 'PTR']

// ── commands ────────────────────────────────────────────────────────────────

export const COMMANDS = {
  help: {
    summary: 'list the commands you can run',
    usage: 'help [command]',
    run({ term, args }) {
      if (args[0]) {
        const cmd = COMMANDS[args[0]]
        if (!cmd) return term.print(`no such command: ${args[0]}`, 'err')
        term.print(`  ${args[0]} — ${cmd.summary}`)
        term.print(`  usage: ${cmd.usage}`, 'dim')
        for (const ex of cmd.examples ?? []) term.print(`         ${ex}`, 'dim')
        return
      }
      term.print('')
      for (const [name, cmd] of Object.entries(COMMANDS)) {
        if (cmd.hidden) continue
        term.print(`  ${name.padEnd(11)}${cmd.summary}`)
      }
      term.print('')
      term.print('  ↑ ↓ history   Tab complete   Ctrl+L clear   1 2 3 change depth', 'dim')
      term.print('')
    },
  },

  clear: {
    summary: 'clear the screen',
    usage: 'clear',
    run: ({ term }) => term.clear(),
  },

  dig: {
    summary: 'look up a name — sends a real DNS packet',
    usage: 'dig [@server] <domain> [type]',
    examples: [
      'dig facebook.com',
      'dig facebook.com AAAA      # IPv6 — look for face:b00c',
      'dig @8.8.8.8 github.com    # ask Google instead of Cloudflare',
      'dig gmail.com MX           # who handles this domain\'s mail',
    ],
    // Token indices count from the command itself: 0=dig, 1=domain, 2=type.
    completeArg(index, partial) {
      if (index === 2) return RECORD_TYPES.filter((t) => t.startsWith(partial.toUpperCase()))
      return []
    },
    async run({ term, args, flags }) {
      let server = flags.server ?? null
      const positional = []
      for (const a of args) {
        if (a.startsWith('@')) server = a.slice(1)
        else positional.push(a)
      }

      const [domain, typeArg, ...extra] = positional
      if (!domain) {
        term.print('usage: dig [@server] <domain> [type]', 'err')
        term.print('try:   dig facebook.com', 'dim')
        return
      }
      if (extra.length) {
        // Without this, "dig not a domain" quietly looks up "not" and reports
        // NXDOMAIN, which teaches a beginner exactly the wrong thing.
        term.print(`dig takes one domain, but got ${positional.length}: ${positional.join(' ')}`, 'err')
        term.print('usage: dig [@server] <domain> [type]', 'dim')
        return
      }

      const type = (typeArg ?? 'A').toUpperCase()
      if (!RECORD_TYPES.includes(type)) {
        term.print(`unknown record type "${type}"`, 'err')
        term.print(`known types: ${RECORD_TYPES.join(' ')}`, 'dim')
        return
      }

      const env = await api.dns({ domain, type, server, lang: get().narrationLang })
      printDns(term, env)
      setResult(env)
    },
  },

  resolvers: {
    summary: 'compare the public DNS resolvers, for real',
    usage: 'resolvers [domain]',
    examples: ['resolvers', 'resolvers wikipedia.org'],
    async run({ term, args }) {
      const domain = args[0] ?? 'wikipedia.org'
      term.print('')
      term.print(`  asking three resolvers for ${domain} — same question, three servers`, 'dim')
      term.print('')

      let last = null
      const answers = []
      for (const [name, ip] of [['Cloudflare', '1.1.1.1'], ['Google', '8.8.8.8'], ['Quad9', '9.9.9.9']]) {
        try {
          const env = await api.dns({ domain, type: 'A', server: ip, lang: get().narrationLang })
          const answer = env.text.split('\n')[0]?.split('\t').pop() ?? '(no answer)'
          term.print(`  ${name.padEnd(12)}${ip.padEnd(10)}${String(env.durationMs).padStart(6)} ms   ${answer}`)
          answers.push(answer)
          last = env
        } catch (err) {
          term.print(`  ${name.padEnd(12)}${ip.padEnd(10)}     — ${err.message}`, 'err')
        }
      }

      // This closing line used to be hard-coded to "same answer", which is a
      // lie whenever it is not — and on a CDN-hosted name it usually is not.
      // Say what actually came back instead.
      term.print('')
      const agreed = answers.length > 1 && new Set(answers).size === 1
      term.print(agreed
        ? '  Same answer, different speeds. The distance to the resolver is real.'
        : '  Different answers to one question — a CDN steering each resolver to a nearby copy.', 'dim')
      term.print('')
      if (last) setResult(last)
    },
  },

  ifconfig: {
    summary: 'your own address, subnet, gateway and MAC',
    usage: 'ifconfig',
    examples: ['ifconfig'],
    async run({ term }) {
      const env = await api.sys({ op: 'ifconfig' })
      const { primary, prefix, ip } = env.meta.data
      if (!primary) return term.print('no active network interface found', 'err')

      term.print('')
      term.print(`  Interface   ${primary.name}${primary.description ? '  (' + primary.description + ')' : ''}`)
      term.print(`  Your IP     ${ip}/${prefix ?? '?'}`, 'in')
      term.print(`  Subnet      ${primary.mask ?? '-'}      who counts as your neighbour`, 'dim')
      term.print(`  Gateway     ${primary.gateway ?? '-'}       the door out to the internet`, 'dim')
      term.print(`  MAC         ${primary.mac ?? '-'}   burned into the hardware`, 'dim')
      if (primary.dns.length) term.print(`  DNS         ${primary.dns.join(', ')}`, 'dim')
      term.print('')
      term.print('  This is your real machine. Try "arp" to see who else is on this network.', 'dim')
      term.print('')
      setLanScene(env)
    },
  },

  arp: {
    summary: 'the other devices your computer has already met',
    usage: 'arp',
    examples: ['arp'],
    async run({ term }) {
      const [net, arp] = await Promise.all([
        api.sys({ op: 'ifconfig' }),
        api.sys({ op: 'arp' }),
      ])
      const { devices, hidden } = arp.meta.data
      const gateway = net.meta.data.primary?.gateway

      term.print('')
      if (!devices.length) {
        term.print('  Nothing in the table yet. Your machine only remembers devices it has', 'dim')
        term.print('  actually talked to - try pinging your gateway first.', 'dim')
        term.print('')
        return
      }

      for (const d of devices) {
        const label = d.ip === gateway ? 'your router' : 'another device on this network'
        term.print(`  ${d.ip.padEnd(16)}${d.mac}   ${label}`, d.ip === gateway ? 'in' : '')
      }
      term.print('')
      term.print(`  ${devices.length} device(s). ${hidden} multicast/broadcast rows hidden - those are not devices.`, 'dim')
      term.print('  Your computer learned every one of these by asking "who has this IP?" out loud.', 'dim')
      term.print('')
      setLanScene(net, arp)
    },
  },

  route: {
    summary: 'your routing table - how your machine decides where to send things',
    usage: 'route',
    examples: ['route'],
    async run({ term }) {
      const env = await api.sys({ op: 'route' })
      const { routes, default: def } = env.meta.data

      term.print('')
      term.print('  Destination         Netmask           Via')
      for (const r of routes.slice(0, 10)) {
        const via = r.gateway ?? 'on-link'
        const note = r.isDefault ? '   <- everything else goes here' : ''
        term.print(`  ${r.destination.padEnd(19)}${(r.netmask ?? '').padEnd(18)}${via}${note}`, r.isDefault ? 'in' : '')
      }
      term.print('')
      if (def) {
        term.print('  0.0.0.0/0 means "I have no idea where this is". Everything unknown', 'dim')
        term.print(`  goes to ${def.gateway}, and that router does the same thing again.`, 'dim')
      }
      term.print('')
    },
  },

  ping: {
    summary: 'is that host reachable, and how far away is it?',
    usage: 'ping <host> [count]',
    examples: ['ping 1.1.1.1', 'ping github.com 3'],
    completeArg(index, partial) {
      if (index === 2) return ['2', '3', '4', '5'].filter((n) => n.startsWith(partial))
      return []
    },
    async run({ term, args }) {
      const [host, countArg] = args
      if (!host) {
        term.print('usage: ping <host> [count]', 'err')
        term.print('try:   ping 1.1.1.1', 'dim')
        return
      }
      const env = await api.sys({ op: 'ping', host, count: countArg ? Number(countArg) : 4 })
      const p = env.meta.data

      term.print('')
      if (!p.reachable) {
        term.print(`  no reply from ${host} - ${p.reason}`, 'warn')
        term.print('  That does not always mean it is down: many networks drop ICMP on purpose.', 'dim')
        term.print('')
        setResult(env)
        return
      }

      for (const r of p.replies) {
        term.print(`  ${r.bytes} bytes from ${r.ip}  time=${r.timeMs}ms  TTL=${r.ttl}`, 'in')
      }
      term.print('')
      term.print(`  ${p.received}/${p.sent} replies - ${p.lossPercent}% loss - min ${p.min} / avg ${p.avg} / max ${p.max} ms`)
      if (p.hopsAway != null) {
        term.print(`  TTL ${p.ttl} means about ${p.hopsAway} routers between you and ${p.ip}.`, 'dim')
      }
      term.print('')
      setResult(env)
    },
  },

  netstat: {
    summary: 'the connections your machine has open right now',
    usage: 'netstat',
    examples: ['netstat'],
    async run({ term }) {
      const env = await api.sys({ op: 'netstat' })
      const { connections, established } = env.meta.data

      term.print('')
      const remote = established.filter((c) => !c.foreign.host.startsWith('127.'))
      for (const c of remote.slice(0, 12)) {
        term.print(`  ${(c.local.host + ':' + c.local.port).padEnd(24)} -> ${c.foreign.host}:${c.foreign.port}`)
      }
      term.print('')
      term.print(`  ${remote.length} live connection(s) to the outside, ${connections.length} total.`, 'dim')
      term.print('  Notice the local ports counting upward - your OS picks a fresh one each time.', 'dim')
      term.print('')
    },
  },

  doctor: {
    summary: 'check what this machine actually lets netlens do',
    usage: 'doctor',
    async run({ term }) {
      term.print('')
      const checks = [
        ['DNS over UDP 53', async () => {
          const e = await api.dns({ domain: 'example.com', type: 'A' })
          return `${e.durationMs} ms via ${e.meta.serverLabel}`
        }],
        ['Your interface', async () => {
          const e = await api.sys({ op: 'ifconfig' })
          const d = e.meta.data
          return d.primary ? `${d.primary.name} ${d.ip}/${d.prefix}` : 'none found'
        }],
        ['LAN neighbours', async () => {
          const e = await api.sys({ op: 'arp' })
          return `${e.meta.data.devices.length} device(s)`
        }],
        ['Routing table', async () => {
          const e = await api.sys({ op: 'route' })
          return e.meta.data.default ? `default via ${e.meta.data.default.gateway}` : 'no default route'
        }],
        ['ICMP ping', async () => {
          const e = await api.sys({ op: 'ping', host: '1.1.1.1', count: 2 })
          const p = e.meta.data
          if (!p.reachable) throw new Error(p.reason)
          return `${p.avg} ms, TTL ${p.ttl}`
        }],
      ]

      for (const [name, check] of checks) {
        try {
          term.print(`  ok   ${name.padEnd(20)} ${await check()}`, 'ok')
        } catch (err) {
          term.print(`  --   ${name.padEnd(20)} ${err.message}`, 'warn')
        }
      }
      term.print('')
      term.print('  Anything marked "--" is blocked or unavailable on this machine, not broken', 'dim')
      term.print('  in netlens. Corporate and campus networks often block ICMP or UDP 53.', 'dim')
      term.print('')
    },
  },

  tracert: {
    summary: 'every router between you and a host, discovered live',
    usage: 'tracert <host> [maxHops]',
    examples: ['tracert 1.1.1.1', 'tracert github.com 12'],
    completeArg(index, partial) {
      if (index === 2) return ['8', '12', '20', '30'].filter((n) => n.startsWith(partial))
      return []
    },
    run({ term, args }) {
      const [host, hopsArg] = args
      if (!host) {
        term.print('usage: tracert <host> [maxHops]', 'err')
        term.print('try:   tracert 1.1.1.1', 'dim')
        return
      }

      const maxHops = hopsArg ? Number(hopsArg) : 20
      const events = []

      term.print('')
      term.print(`  tracing the path to ${host} — each router only knows the next step`, 'dim')
      term.print('')

      // Resolves when the stream closes, so the terminal stays busy meanwhile.
      return new Promise((resolve) => {
        const params = new URLSearchParams({ host, maxHops: String(maxHops) })

        stream(`/api/trace/stream?${params}`, {
          onEvent(msg) {
            if (msg.type === 'target') {
              term.print(`  target ${msg.host}${msg.ip && msg.ip !== msg.host ? ' [' + msg.ip + ']' : ''}, up to ${msg.maxHops} hops`, 'dim')
              term.print('')
              return
            }
            if (msg.type !== 'hop') return

            const h = msg.hop
            if (h.silent) {
              term.print(`  ${String(h.hop).padStart(2)}   *  *  *      this router chose not to answer`, 'warn')
            } else {
              const times = h.times.map((t) => (t == null ? '*' : `${t}ms`)).join('  ')
              term.print(`  ${String(h.hop).padStart(2)}   ${h.host.padEnd(18)}${times}`, 'in')
            }

            // Appending rather than replacing lets the canvas animate only the
            // new hop and leave the path discovered so far on screen.
            events.push(msg.event)
            setResult({ events: [...events], packets: [] })
          },

          onDone(msg) {
            if (msg.type === 'error') {
              term.print(`  ${msg.error}`, 'err')
              term.print('')
              resolve()
              return
            }

            term.print('')
            if (msg.answered) {
              term.print(`  ${msg.answered} of ${msg.hops.length} routers answered · ${msg.totalMs} ms end to end`, 'ok')
            }
            if (msg.silent) {
              term.print(`  ${msg.silent} stayed silent — they still forwarded your packet.`, 'dim')
            }
            if (msg.biggestJump && msg.biggestJump.delta >= 8) {
              const j = msg.biggestJump
              term.print(`  biggest jump: hop ${j.from.hop} -> ${j.to.hop} adds ${j.delta} ms in one step.`, 'warn')
              term.print('  A jump that size is usually distance — often an undersea cable.', 'dim')
            }
            term.print('')
            resolve()
          },

          onError() {
            term.print('  the trace stream was interrupted', 'err')
            term.print('')
            resolve()
          },
        })
      })
    },
  },

  tls: {
    summary: 'the handshake and the certificate, parsed by us',
    usage: 'tls <host> [--sni <name>] [--no-sni]',
    examples: [
      'tls github.com',
      'tls medium.com --no-sni            # watch it refuse',
      'tls medium.com --sni discord.com   # same server, different certificate',
    ],
    async run({ term, args, flags }) {
      const host = args[0]
      if (!host) {
        term.print('usage: tls <host> [--sni <name>] [--no-sni]', 'err')
        term.print('try:   tls github.com', 'dim')
        return
      }

      const sni = flags['no-sni'] ? null : (flags.sni ?? undefined)
      const env = await api.tls({ host, sni, lang: get().narrationLang })
      const m = env.meta
      setResult(env)

      term.print('')
      term.print(`  -> ClientHello  ${env.events[0].bytes} bytes${m.sni ? '  asking for ' + m.sni : '  with NO server name'}`, 'out')

      if (m.alert) {
        term.print(`  <- Alert  ${m.alert.levelName}  ${m.alert.name}`, 'err')
        term.print('')
        term.print('  Thousands of sites share this address. With no name in the handshake', 'dim')
        term.print('  the server cannot know which certificate you wanted, so it refuses.', 'dim')
        term.print('  That is what SNI is for.', 'dim')
        term.print('')
        return
      }

      term.print(`  <- ServerHello  ${env.events[1].bytes} bytes in ${env.durationMs} ms`, 'in')
      term.print('')
      term.print(`  Version     ${m.version}`)
      term.print(`  Cipher      ${m.cipher}`)
      term.print('')

      const leaf = m.certificates[0]
      if (!leaf) {
        term.print('  no certificate in the reply', 'warn')
        term.print('')
        return
      }
      if (leaf.parseError) {
        term.print(`  certificate did not parse: ${leaf.parseError}`, 'err')
        term.print('')
        return
      }

      term.print(`  Subject     ${leaf.subject}`, 'ok')
      term.print(`  Issuer      ${leaf.issuer}`)
      term.print(`  Valid       ${day(leaf.notBefore)}  ->  ${day(leaf.notAfter)}`)
      term.print(`  Expires     ${leaf.expired ? 'ALREADY EXPIRED' : 'in ' + leaf.daysLeft + ' days'}`,
        leaf.expired ? 'err' : leaf.daysLeft < 30 ? 'warn' : '')
      term.print(`  Key         ${[leaf.keyAlgorithm, leaf.keyCurve].filter(Boolean).join(' ')}`)
      term.print(`  Signature   ${leaf.signatureAlgorithm}`)
      if (leaf.altNames?.length) {
        term.print(`  Covers      ${leaf.altNames.slice(0, 5).join(', ')}${leaf.altNames.length > 5 ? ' +' + (leaf.altNames.length - 5) + ' more' : ''}`)
      }
      term.print(`  Chain       ${m.chainLength} certificate(s), up to a root your machine already trusts`, 'dim')
      term.print('')

      if (m.sni && m.matchesConnectedHost === false) {
        term.print(`  You connected to ${m.host}, asked for ${m.sni},`, 'warn')
        term.print(`  and got back a certificate for ${leaf.commonName}.`, 'warn')
        term.print('  Same IP. Same socket. One name changed in the ClientHello.', 'dim')
        term.print('')
      }

      term.print('  We parsed every field above out of raw DER ourselves. No x509 library.', 'dim')
      term.print('  Note: we read the certificate, we do not verify who signed it.', 'dim')
      term.print('')
    },
  },

  curl: {
    summary: 'fetch a URL with a request we wrote ourselves',
    usage: 'curl <url> [--head] [--keep-alive]',
    examples: [
      'curl https://example.com',
      'curl example.com --head        # show the headers only',
    ],
    async run({ term, args, flags }) {
      const url = args[0]
      if (!url) {
        term.print('usage: curl <url> [--head] [--keep-alive]', 'err')
        term.print('try:   curl https://example.com', 'dim')
        return
      }

      const env = await api.http({
        url,
        method: flags.head ? 'HEAD' : 'GET',
        keepAlive: Boolean(flags['keep-alive']),
        lang: get().narrationLang,
      })
      const m = env.meta
      setResult(env)

      term.print('')
      term.print(`  -> ${env.events[0].bytes} bytes of plain text to ${m.peer}`, 'out')
      term.print('')
      // The whole point of the chapter: the request is readable.
      for (const line of REQUEST_SHAPE(m)) term.print(`  ${line}`, 'dim')
      term.print('')
      term.print(`  <- ${env.events[1].bytes} bytes, first byte after ${m.timings.ttfbMs} ms`, 'in')
      term.print('')

      const kind = String(m.status).charAt(0)
      term.print(`  ${m.status} ${m.reason}`, kind === '2' ? 'ok' : kind === '3' ? 'warn' : 'err')
      for (const [name, value] of m.headers.slice(0, 8)) {
        term.print(`  ${(name + ':').padEnd(20)}${value.slice(0, 60)}`)
      }
      if (m.headers.length > 8) term.print(`  ... ${m.headers.length - 8} more headers`, 'dim')
      term.print('')

      if (m.chunked) {
        term.print(`  Body arrived in ${m.chunkCount} chunks, ${m.bodyBytes} bytes decoded.`, 'dim')
        term.print('  The server did not know the total size when it started replying.', 'dim')
      } else if (m.contentLength != null) {
        term.print(`  Content-Length ${m.contentLength} - the client knew exactly when to stop reading.`, 'dim')
      }
      term.print('')
    },
  },

  journey: {
    summary: 'one URL, every protocol, in order',
    usage: 'journey <url>',
    examples: ['journey https://example.com', 'journey github.com'],
    async run({ term, args }) {
      const url = args[0]
      if (!url) {
        term.print('usage: journey <url>', 'err')
        term.print('try:   journey https://example.com', 'dim')
        return
      }

      term.print('')
      term.print('  running every stage against one address...', 'dim')

      const env = await api.journey({ url, lang: get().narrationLang })
      const m = env.meta
      setResult(env)

      term.print('')
      for (const e of env.events) {
        const arrow = e.dir === 'out' ? '->' : '<-'
        const bytes = e.bytes ? `${e.bytes} B` : ''
        term.print(
          `  ${String(e.t.toFixed(1)).padStart(7)} ms  ${arrow} ${e.label.padEnd(22)}${bytes.padStart(9)}  ${e.proto}`,
          e.dir === 'out' ? 'out' : 'in',
        )
      }

      term.print('')
      term.print(`  ${m.timings.totalMs} ms total - ${m.protocols.length} protocols - ${fmtBytes(m.totalBytes)}`, 'ok')
      term.print('')
      term.print('  WHERE THE TIME WENT', 'dim')
      for (const b of m.breakdown) {
        const bar = '#'.repeat(Math.max(1, Math.round(b.percent / 2)))
        term.print(`  ${b.name.padEnd(9)}${String(b.ms).padStart(7)} ms  ${String(b.percent).padStart(3)}%  ${bar}`)
      }
      term.print('')

      const setup = m.breakdown
        .filter((b) => b.name !== 'Transfer' && b.name !== 'Request')
        .reduce((n, b) => n + b.percent, 0)
      term.print(`  ${setup}% of that went on setup before one byte of content moved.`, 'warn')
      term.print('  Run it again - DNS is cached now, and the second run is faster.', 'dim')
      term.print('')
    },
  },

  replay: {
    summary: 'watch the last exchange again, optionally slower',
    usage: 'replay [speed]',
    examples: ['replay', 'replay 4        # four times slower'],
    run({ term, args }) {
      const { events, playbackSpeed } = get()
      if (!events.length) {
        term.print('nothing to replay yet — run a command first', 'err')
        return
      }
      const speed = args[0] ? Number(args[0]) : playbackSpeed
      if (!Number.isFinite(speed) || speed <= 0) {
        term.print('usage: replay [speed]   e.g. replay 4', 'err')
        return
      }
      // Setting the speed re-triggers playback; setting the same value still
      // needs to fire, so nudge it through a distinct value first.
      set({ playbackSpeed: speed === playbackSpeed ? speed + 1e-6 : speed })
      term.print(speed === 1 ? 'replaying' : `replaying at ${speed}x slower`, 'ok')
    },
  },

  lab: {
    summary: 'open a bit-level lab you can break on purpose',
    usage: 'lab <name>   ·   lab off',
    examples: ['lab layers', 'lab compare', 'lab subnet', 'lab topology', 'lab off'],
    run({ term, args }) {
      const KINDS = ['crc', 'hamming', 'bitstuff', 'parity', 'arq',
        'subnet', 'ipv4', 'topology', 'compare', 'layers']
      const kind = (args[0] || '').toLowerCase()

      if (kind === 'off' || kind === 'close') {
        set({ lab: null })
        return term.print('lab closed', 'dim')
      }
      if (!KINDS.includes(kind)) {
        term.print('usage: lab <name>, or lab off', kind ? 'err' : 'dim')
        return term.print(`  ${KINDS.join('   ')}`, 'dim')
      }

      set({ lab: { kind } })
      term.print(`lab: ${kind}`, 'ok')
      const HINT = {
        arq: 'move the loss slider, then switch protocol — the losses stay the same',
        subnet: 'drag the prefix and watch the 32 bits change hands',
        ipv4: 'change the TTL, and watch the checksum move with it',
        topology: 'click a machine to send from it, then cut a cable and send again',
        compare: 'answer each question in your head before you open it',
        layers: 'drag the payload size and watch the overhead, not the envelopes, change',
      }
      term.print(HINT[kind] ?? 'click any bit in the channel row to damage it, and watch what notices', 'dim')
    },
  },

  tour: {
    summary: 'walk through every part of this app',
    usage: 'tour',
    examples: ['tour'],
    run({ term }) {
      const tour = globalThis.__netlensTour
      if (!tour) return term.print('the tour is not ready yet', 'err')
      term.print('starting the tour — press escape to leave it', 'ok')
      tour.start()
    },
  },

  lang: {
    summary: 'switch narration between English and Hinglish',
    usage: 'lang [en|hi]',
    run({ term, args }) {
      const next = args[0] ?? (get().narrationLang === 'en' ? 'hi' : 'en')
      if (!['en', 'hi'].includes(next)) return term.print('usage: lang [en|hi]', 'err')
      set({ narrationLang: next })
      term.print(`narration: ${next === 'hi' ? 'Hinglish' : 'English'}`, 'ok')
      term.print('run your last command again to see it', 'dim')
    },
  },
}

// `traceroute` is what everyone outside Windows calls it, and a learner should
// not have to know which platform they are on to run it. Hidden from help so
// the list shows one name, but it behaves identically.
COMMANDS.traceroute = {
  ...COMMANDS.tracert,
  usage: 'traceroute <host> [maxHops]',
  examples: ['traceroute 1.1.1.1', 'traceroute github.com 12'],
  hidden: true,
}

/** The request as a shape, so a learner sees the framing rather than a blob. */
const REQUEST_SHAPE = (m) => [
  `${m.method} ${m.path} HTTP/1.1`,
  `Host: ${m.host}`,
  '...',
  '(blank line - this is the entire framing rule of HTTP/1.1)',
]

const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`)

const day = (d) => (d ? String(d).slice(0, 10) : '-')

// -- chapter 1: your own network as a scene --────────────────────────────────

/**
 * Chapter 1 has no packet to animate, so its canvas is built from real facts
 * instead: you, your gateway, and every neighbour your machine has already met.
 * The events carry zero bytes, which the renderer draws as a static topology
 * rather than something in flight.
 */
function setLanScene(netEnv, arpEnv) {
  const primary = netEnv.meta.data.primary
  if (!primary) return
  const me = netEnv.meta.data.ip ?? 'you'
  const gateway = primary.gateway
  const devices = arpEnv?.meta.data.devices ?? []

  const events = []
  if (gateway) {
    events.push({
      t: 0, dir: 'out', from: 'you', to: gateway, proto: 'LAN', bytes: 0,
      label: 'your router', packetId: null, note: '',
      narration: `You are ${me} on a ${primary.mask} network. Anything that is not a neighbour goes through ${gateway}.`,
    })
  }
  for (const d of devices) {
    if (d.ip === gateway) continue
    events.push({
      t: 0, dir: 'out', from: 'you', to: d.ip, proto: 'LAN', bytes: 0,
      label: d.mac, packetId: null, note: '',
      narration: `${d.ip} is another device on your network. Your computer knows its hardware address because the two have spoken.`,
    })
  }
  if (events.length) setResult({ events, packets: [] })
}

// ── DNS output ──────────────────────────────────────────────────────────────

function printDns(term, env) {
  const [out, back] = env.events
  const m = env.meta

  term.print(`  → ${out.bytes} bytes to ${m.server}:53 (${m.serverLabel})`, 'out')

  if (!m.idMatch) {
    term.print(`  ← ${back.bytes} bytes in ${env.durationMs} ms  ⚠ REJECTED`, 'warn')
    term.print(`    waiting for id ${hex16(m.expectId)}, reply carried ${hex16(m.gotId)}`, 'warn')
    term.print('')
    term.print('    A resolver drops this reply. That check is what stops a forged answer.', 'dim')
    term.print('')
    return
  }

  term.print(`  ← ${back.bytes} bytes in ${env.durationMs} ms`, 'in')
  term.print('')

  if (env.text) {
    for (const row of env.text.split('\n')) term.print(`  ${row}`)
  } else if (m.rcode === 3) {
    term.print('  NXDOMAIN — no such name', 'warn')
  } else if (m.answerCount === 0) {
    term.print(`  no records of that type (rcode ${m.rcode})`, 'warn')
  }

  if (m.truncatedParse) {
    term.print('')
    term.print(`  ⚠ parse stopped: ${m.truncatedParse}`, 'warn')
  }
  term.print('')
}

const hex16 = (n) => (n == null || n < 0 ? '?' : `0x${n.toString(16).padStart(4, '0')}`)

// ── dispatch ────────────────────────────────────────────────────────────────

export function createDispatcher(term) {
  return async function dispatch(input) {
    const tokens = tokenize(input)
    if (!tokens.length) return

    const name = tokens[0].toLowerCase()
    const cmd = COMMANDS[name]
    if (!cmd) {
      term.print(`command not found: ${name}`, 'err')
      const near = nearest(name)
      if (near) term.print(`did you mean "${near}"?`, 'dim')
      else term.print('type "help" to see what you can run', 'dim')
      return
    }

    const { flags, args } = parseFlags(tokens.slice(1))
    await cmd.run({ term, args, flags, raw: input })
  }
}

/** Cheap edit-distance suggestion so a typo does not dead-end a beginner. */
function nearest(name) {
  let best = null
  let bestScore = Infinity
  for (const candidate of Object.keys(COMMANDS)) {
    const d = distance(name, candidate)
    if (d < bestScore) { bestScore = d; best = candidate }
  }
  return bestScore <= 2 ? best : null
}

function distance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let corner = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(prev[j] + 1, prev[j - 1] + 1, corner + (a[i - 1] === b[j - 1] ? 0 : 1))
      corner = prev[j]
      prev[j] = next
    }
  }
  return prev[b.length]
}
