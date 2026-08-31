// netlens — pre-flight network capability test
// Checks EVERYTHING the project depends on. Zero dependencies (obviously).
import dgram from 'node:dgram'
import net from 'node:net'
import tls from 'node:tls'
import { execFile } from 'node:child_process'
import os from 'node:os'

const P = process.platform
const results = []
const pad = (s, n) => String(s).padEnd(n)

function log(name, ok, detail) {
  results.push({ name, ok, detail })
  const icon = ok === true ? '\x1b[32m PASS \x1b[0m' : ok === 'warn' ? '\x1b[33m WARN \x1b[0m' : '\x1b[31m FAIL \x1b[0m'
  console.log(`  [${icon}] ${pad(name, 34)} ${detail}`)
}

// ---------- 1. RAW DNS over UDP 53 (the project's #1 dependency) ----------
function buildDnsQuery(domain, id = 0x1a2b) {
  const labels = domain.split('.')
  let qlen = 0
  for (const l of labels) qlen += 1 + l.length
  qlen += 1
  const buf = Buffer.alloc(12 + qlen + 4)
  buf.writeUInt16BE(id, 0)       // ID
  buf.writeUInt16BE(0x0100, 2)   // flags: RD=1
  buf.writeUInt16BE(1, 4)        // QDCOUNT
  let o = 12
  for (const l of labels) { buf.writeUInt8(l.length, o++); buf.write(l, o, 'ascii'); o += l.length }
  buf.writeUInt8(0, o++)
  buf.writeUInt16BE(1, o); o += 2   // QTYPE A
  buf.writeUInt16BE(1, o); o += 2   // QCLASS IN
  return buf
}

function dnsTest(server, label) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket('udp4')
    const q = buildDnsQuery('github.com')
    const t0 = performance.now()
    const timer = setTimeout(() => {
      sock.close()
      log(`UDP 53 → ${label}`, false, `TIMEOUT after 3000ms  ⚠️ BLOCKED`)
      resolve(false)
    }, 3000)
    sock.on('message', (msg) => {
      clearTimeout(timer)
      const ms = (performance.now() - t0).toFixed(1)
      const ancount = msg.readUInt16BE(6)
      sock.close()
      log(`UDP 53 → ${label}`, true, `${msg.length}B in ${ms}ms, ${ancount} answer(s)`)
      resolve(true)
    })
    sock.on('error', (e) => {
      clearTimeout(timer); try { sock.close() } catch {}
      log(`UDP 53 → ${label}`, false, e.code || e.message)
      resolve(false)
    })
    sock.send(q, 53, server)
  })
}

// ---------- 2. Raw TCP (for the TLS probe) ----------
function tcpTest(host, port, label) {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const s = net.connect({ host, port, timeout: 4000 })
    s.on('connect', () => {
      const ms = (performance.now() - t0).toFixed(1)
      log(label, true, `connected ${s.localAddress}:${s.localPort} → ${host}:${port} in ${ms}ms`)
      s.destroy(); resolve(true)
    })
    s.on('timeout', () => { log(label, false, 'TIMEOUT ⚠️ BLOCKED'); s.destroy(); resolve(false) })
    s.on('error', (e) => { log(label, false, e.code || e.message); resolve(false) })
  })
}

// ---------- 3. Raw TLS ClientHello by hand (exactly what Ch5 does) ----------
function rawClientHelloTest(host) {
  return new Promise((resolve) => {
    // minimal TLS 1.2-style ClientHello with SNI
    const hostBuf = Buffer.from(host, 'ascii')
    const sniData = Buffer.alloc(5 + hostBuf.length)
    sniData.writeUInt16BE(3 + hostBuf.length, 0)
    sniData.writeUInt8(0, 2)
    sniData.writeUInt16BE(hostBuf.length, 3)
    hostBuf.copy(sniData, 5)
    const sniExt = Buffer.concat([Buffer.from([0x00, 0x00]), Buffer.from([(sniData.length >> 8) & 0xff, sniData.length & 0xff]), sniData])
    const exts = sniExt
    const body = Buffer.concat([
      Buffer.from([0x03, 0x03]),                 // client version TLS1.2
      Buffer.alloc(32, 0x42),                    // random
      Buffer.from([0x00]),                       // session id len
      Buffer.from([0x00, 0x08,                   // cipher suites len
        0x13, 0x01, 0x13, 0x02, 0x13, 0x03, 0xc0, 0x2f]),
      Buffer.from([0x01, 0x00]),                 // compression
      Buffer.from([(exts.length >> 8) & 0xff, exts.length & 0xff]),
      exts,
    ])
    const hs = Buffer.concat([Buffer.from([0x01, 0x00, (body.length >> 8) & 0xff, body.length & 0xff]), body])
    const rec = Buffer.concat([Buffer.from([0x16, 0x03, 0x01, (hs.length >> 8) & 0xff, hs.length & 0xff]), hs])

    const s = net.connect({ host, port: 443, timeout: 5000 })
    let got = Buffer.alloc(0)
    s.on('connect', () => s.write(rec))
    s.on('data', (d) => {
      got = Buffer.concat([got, d])
      if (got.length >= 6) {
        const type = got[0]
        const ok = type === 0x16
        log('Raw ClientHello (Ch5 core)', ok, ok
          ? `got record type 0x16 Handshake, ${got.length}B — server replied to OUR bytes ✅`
          : `unexpected record type 0x${type.toString(16)}`)
        s.destroy(); resolve(ok)
      }
    })
    s.on('timeout', () => { log('Raw ClientHello (Ch5 core)', false, 'TIMEOUT'); s.destroy(); resolve(false) })
    s.on('error', (e) => { log('Raw ClientHello (Ch5 core)', false, e.code || e.message); resolve(false) })
  })
}

// ---------- 4. OS tools via child_process ----------
function exec(cmd, args, timeout = 25000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ err, out: (stdout || '') + (stderr || '') })
    })
  })
}

async function main() {
  console.log('\n\x1b[1m╔══════════════════════════════════════════════════════════════════════════╗')
  console.log('║   netlens — PRE-FLIGHT NETWORK TEST                                       ║')
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\x1b[0m')
  console.log(`  platform: ${P}  ${os.release()}   node: ${process.version}\n`)

  console.log('\x1b[1m── 1. DNS over UDP 53  (Chapter 2 — MISSION CRITICAL) ──\x1b[0m')
  const d1 = await dnsTest('8.8.8.8', 'Google 8.8.8.8')
  const d2 = await dnsTest('1.1.1.1', 'Cloudflare 1.1.1.1')
  const d3 = await dnsTest('9.9.9.9', 'Quad9 9.9.9.9')

  console.log('\n\x1b[1m── 2. TCP  (Chapters 4,5,6) ──\x1b[0m')
  const t1 = await tcpTest('1.1.1.1', 443, 'TCP 443 → 1.1.1.1')
  const t2 = await tcpTest('140.82.113.4', 443, 'TCP 443 → github.com IP')
  const t3 = await tcpTest('1.1.1.1', 80, 'TCP 80  → 1.1.1.1')

  console.log('\n\x1b[1m── 3. Raw TLS handshake  (Chapter 5) ──\x1b[0m')
  const tlsOk = await rawClientHelloTest('github.com')

  console.log('\n\x1b[1m── 4. OS tools via child_process  (Chapters 1,3) ──\x1b[0m')
  const pingArgs = P === 'win32' ? ['-n', '2', '8.8.8.8'] : ['-c', '2', '8.8.8.8']
  const ping = await exec('ping', pingArgs, 15000)
  const pingOk = /ttl=/i.test(ping.out) || /time[=<]/i.test(ping.out)
  log('ping (ICMP)', pingOk, pingOk ? (ping.out.match(/[Tt][Tt][Ll][=:]\s*\d+/) || ['ok'])[0] + ' — ICMP allowed' : 'no reply — ICMP likely BLOCKED')

  const traceCmd = P === 'win32' ? 'tracert' : 'traceroute'
  const traceArgs = P === 'win32' ? ['-h', '5', '-w', '900', '8.8.8.8'] : ['-m', '5', '-w', '1', '8.8.8.8']
  const tr = await exec(traceCmd, traceArgs, 40000)
  const hops = (tr.out.match(/^\s*\d+\s/gm) || []).length
  const trStars = (tr.out.match(/\*/g) || []).length
  log(`${traceCmd}`, hops > 0 ? (hops >= 2 ? true : 'warn') : false,
    hops > 0 ? `${hops} hop lines parsed, ${trStars} timeouts` : 'command failed or unavailable')

  const ipcfg = await exec(P === 'win32' ? 'ipconfig' : 'ifconfig', P === 'win32' ? ['/all'] : [])
  log(P === 'win32' ? 'ipconfig /all' : 'ifconfig', !ipcfg.err, !ipcfg.err ? `${ipcfg.out.split('\n').length} lines` : 'unavailable')

  const arp = await exec('arp', ['-a'])
  const arpRows = (arp.out.match(/\d+\.\d+\.\d+\.\d+/g) || []).length
  log('arp -a', arpRows > 0, arpRows > 0 ? `${arpRows} entries — LAN visible (Ch1)` : 'no entries')

  const routeCmd = P === 'win32' ? ['route', ['print']] : ['ip', ['route']]
  const rt = await exec(routeCmd[0], routeCmd[1])
  log(routeCmd[0] + ' ' + routeCmd[1].join(' '), !rt.err && rt.out.length > 20, !rt.err ? `${rt.out.split('\n').length} lines` : 'unavailable')

  const ns = await exec('netstat', P === 'win32' ? ['-n'] : ['-tn'])
  log('netstat', !ns.err, !ns.err ? `${(ns.out.match(/ESTABLISHED/g) || []).length} established conns` : 'unavailable')

  // ---------- verdict ----------
  const fails = results.filter(r => r.ok === false)
  const dnsOk = d1 || d2 || d3
  console.log('\n\x1b[1m╔══════════════════════════════════════════════════════════════════════════╗')
  console.log('║   VERDICT                                                                ║')
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\x1b[0m')
  const verdict = (c, ok, note) => console.log(`  ${ok ? '\x1b[32m✅' : '\x1b[31m❌'}\x1b[0m ${pad(c, 30)} ${note}`)
  verdict('Ch2 DNS (raw UDP 53)', dnsOk, dnsOk ? 'WORKS — project is safe' : 'BLOCKED — need hotspot / TCP-DNS fallback')
  verdict('Ch5 TLS (raw ClientHello)', tlsOk, tlsOk ? 'WORKS' : 'blocked')
  verdict('Ch6 HTTP (TCP 443/80)', t1 || t2, (t1 || t2) ? 'WORKS' : 'blocked')
  verdict('Ch3 traceroute', hops > 0, hops > 0 ? 'WORKS' : 'BLOCKED — cache demo data')
  verdict('Ch1 LAN info', arpRows > 0, arpRows > 0 ? 'WORKS' : 'limited')
  verdict('ICMP ping', pingOk, pingOk ? 'WORKS' : 'blocked — use TCP-ping fallback')
  console.log(`\n  ${fails.length === 0 ? '\x1b[32m🏆 ALL CLEAR — build with confidence\x1b[0m' : `\x1b[33m⚠️  ${fails.length} check(s) failed — see fallbacks above\x1b[0m`}\n`)
}

main()
