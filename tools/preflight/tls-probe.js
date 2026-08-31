// Proper TLS 1.2 ClientHello — the Chapter 5 core, for real.
// KEY INSIGHT: in TLS 1.2 the Certificate message is PLAINTEXT.
// In TLS 1.3 it is encrypted. So for teaching, we offer 1.2.
import net from 'node:net'
import crypto from 'node:crypto'

const u16 = (n) => Buffer.from([(n >> 8) & 0xff, n & 0xff])
const ext = (type, data) => Buffer.concat([u16(type), u16(data.length), data])

function buildClientHello(host, { withSNI = true, maxVersion = 0x0303 } = {}) {
  const exts = []

  if (withSNI) {
    const h = Buffer.from(host, 'ascii')
    const entry = Buffer.concat([Buffer.from([0x00]), u16(h.length), h])
    exts.push(ext(0x0000, Buffer.concat([u16(entry.length), entry])))
  }
  // supported_groups: x25519, secp256r1, secp384r1
  const groups = Buffer.concat([u16(0x001d), u16(0x0017), u16(0x0018)])
  exts.push(ext(0x000a, Buffer.concat([u16(groups.length), groups])))
  // ec_point_formats: uncompressed
  exts.push(ext(0x000b, Buffer.from([0x01, 0x00])))
  // signature_algorithms
  const sigs = Buffer.concat([
    u16(0x0403), u16(0x0503), u16(0x0603),   // ecdsa sha256/384/512
    u16(0x0804), u16(0x0805), u16(0x0806),   // rsa_pss
    u16(0x0401), u16(0x0501), u16(0x0601),   // rsa_pkcs1
  ])
  exts.push(ext(0x000d, Buffer.concat([u16(sigs.length), sigs])))
  // renegotiation_info (empty)
  exts.push(ext(0xff01, Buffer.from([0x00])))

  const extBuf = Buffer.concat(exts)

  // TLS 1.2 cipher suites the whole internet supports
  const ciphers = Buffer.concat([
    u16(0xc02b), u16(0xc02f), u16(0xc02c), u16(0xc030),
    u16(0xc013), u16(0xc014), u16(0x009c), u16(0x009d),
  ])

  const body = Buffer.concat([
    u16(maxVersion),                 // client_version
    crypto.randomBytes(32),          // client random
    Buffer.from([0x00]),             // session_id length 0
    u16(ciphers.length), ciphers,
    Buffer.from([0x01, 0x00]),       // compression: null
    u16(extBuf.length), extBuf,
  ])

  const hs = Buffer.concat([
    Buffer.from([0x01, (body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff]),
    body,
  ])
  return Buffer.concat([Buffer.from([0x16, 0x03, 0x01]), u16(hs.length), hs])
}

// --- minimal record/handshake walker: exactly what proto/tls.js will do ---
function parseRecords(buf) {
  const out = []
  let o = 0
  while (o + 5 <= buf.length) {
    const type = buf[o], ver = buf.readUInt16BE(o + 1), len = buf.readUInt16BE(o + 3)
    if (o + 5 + len > buf.length) break
    out.push({ type, ver, len, body: buf.subarray(o + 5, o + 5 + len), offset: o })
    o += 5 + len
  }
  return out
}
const RT = { 0x14: 'ChangeCipherSpec', 0x15: 'Alert', 0x16: 'Handshake', 0x17: 'ApplicationData' }
const HT = { 0x02: 'ServerHello', 0x0b: 'Certificate', 0x0c: 'ServerKeyExchange', 0x0e: 'ServerHelloDone' }

function probe(host, opts, label) {
  return new Promise((resolve) => {
    const hello = buildClientHello(host, opts)
    const s = net.connect({ host, port: 443, timeout: 6000 })
    let buf = Buffer.alloc(0)
    let done = false
    const finish = () => {
      if (done) return; done = true
      s.destroy()
      console.log(`\n\x1b[1m▶ ${label}\x1b[0m`)
      console.log(`  sent ClientHello: ${hello.length} bytes`)
      if (!buf.length) { console.log('  \x1b[31mno reply\x1b[0m'); return resolve(null) }
      console.log(`  received:         ${buf.length} bytes`)
      const recs = parseRecords(buf)
      let certDer = null, chosenVer = null, chosenCipher = null, alert = null
      for (const r of recs) {
        if (r.type === 0x15) { alert = `level=${r.body[0]} desc=${r.body[1]}` }
        if (r.type !== 0x16) continue
        let o = 0
        while (o + 4 <= r.body.length) {
          const ht = r.body[o]
          const hl = (r.body[o + 1] << 16) | (r.body[o + 2] << 8) | r.body[o + 3]
          const hb = r.body.subarray(o + 4, o + 4 + hl)
          console.log(`    ${RT[r.type]} → ${HT[ht] || 'type ' + ht}  (${hl} B)`)
          if (ht === 0x02) {
            chosenVer = hb.readUInt16BE(0)
            const sidLen = hb[34]
            chosenCipher = hb.readUInt16BE(35 + sidLen)
          }
          if (ht === 0x0b && !certDer) {
            const l1 = (hb[3] << 16) | (hb[4] << 8) | hb[5]
            certDer = hb.subarray(6, 6 + l1)
          }
          o += 4 + hl
        }
      }
      if (alert) console.log(`  \x1b[31mALERT ${alert}\x1b[0m`)
      if (chosenVer) console.log(`  \x1b[32mnegotiated:\x1b[0m TLS 0x${chosenVer.toString(16)}  cipher 0x${chosenCipher.toString(16)}`)
      if (certDer) {
        console.log(`  \x1b[32m🎉 CERTIFICATE IN PLAINTEXT: ${certDer.length} bytes of DER\x1b[0m`)
        console.log(`     first bytes: ${certDer.subarray(0, 16).toString('hex').match(/../g).join(' ')}`)
        try {
          const x = new crypto.X509Certificate(certDer)   // stdlib cross-check
          console.log(`     subject : ${x.subject.replace(/\n/g, ', ')}`)
          console.log(`     issuer  : ${x.issuer.split('\n').pop()}`)
          console.log(`     valid   : ${x.validFrom}  →  ${x.validTo}`)
          console.log(`     SANs    : ${(x.subjectAltName || '').slice(0, 90)}`)
        } catch (e) { console.log(`     X509 parse: ${e.message}`) }
      }
      resolve({ certDer, chosenVer })
    }
    s.on('connect', () => s.write(hello))
    s.on('data', (d) => { buf = Buffer.concat([buf, d]); if (buf.length > 4000) finish() })
    s.on('end', finish)
    s.on('timeout', finish)
    s.on('error', (e) => { console.log(`  err ${e.code}`); finish() })
    setTimeout(finish, 5000)
  })
}

console.log('\x1b[1m╔═══ TLS ClientHello probe — Chapter 5 feasibility ═══╗\x1b[0m')
await probe('github.com', { withSNI: true }, 'github.com  WITH SNI  (TLS 1.2 offered)')
await probe('github.com', { withSNI: false }, 'github.com  WITHOUT SNI  ← the demo moment')
await probe('example.com', { withSNI: true }, 'example.com WITH SNI')
console.log('')
