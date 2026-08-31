/**
 * sim-addr.test.js — the addressing arithmetic.
 *
 * Subnetting is the part of the syllabus a learner is most likely to check
 * against an exam answer, so the numbers here have to be exactly right rather
 * than approximately convincing. The awkward cases — /31, /32, /0, a mask with
 * a hole in it — are the ones worth pinning.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseIPv4, formatIPv4, bitsOf,
  maskFromPrefix, prefixFromMask,
  subnetInfo, sameNetwork, classOf, specialOf, splitSubnets,
  buildIPv4Header, ipv4Checksum, verifyIPv4Checksum, describeIPv4,
  expandIPv6, compressIPv6,
} from '../web/js/sim/addr.js'

const ip = (s) => parseIPv4(s).value

describe('parsing and formatting', () => {
  test('round-trips every octet boundary', () => {
    for (const s of ['0.0.0.0', '255.255.255.255', '192.168.1.5', '128.0.0.0', '10.0.0.1']) {
      assert.equal(formatIPv4(ip(s)), s)
    }
  })

  test('128.0.0.0 does not come out negative', () => {
    // The classic signed-shift bug: without >>> 0 this is -2147483648.
    assert.ok(ip('128.0.0.0') > 0)
    assert.equal(ip('255.255.255.255'), 4294967295)
  })

  test('rejects what is not an address, with a reason', () => {
    for (const bad of ['1.2.3', '1.2.3.4.5', '256.0.0.1', 'a.b.c.d', '1.2.3.-1', '']) {
      const r = parseIPv4(bad)
      assert.equal(r.ok, false, `${bad} was accepted`)
      assert.ok(r.error && r.error.length > 8, `${bad} gave no useful reason`)
    }
  })

  test('bits are most significant first', () => {
    assert.equal(bitsOf(ip('255.0.0.0')).join(''), '1'.repeat(8) + '0'.repeat(24))
    assert.equal(bitsOf(ip('0.0.0.1')).join(''), '0'.repeat(31) + '1')
  })
})

describe('masks', () => {
  test('every prefix maps to its mask and back', () => {
    for (let p = 0; p <= 32; p++) {
      assert.equal(prefixFromMask(maskFromPrefix(p)), p, `prefix ${p} did not round-trip`)
    }
  })

  test('/0 and /32 are the ends, not special cases that break', () => {
    assert.equal(formatIPv4(maskFromPrefix(0)), '0.0.0.0')
    assert.equal(formatIPv4(maskFromPrefix(32)), '255.255.255.255')
    assert.equal(formatIPv4(maskFromPrefix(24)), '255.255.255.0')
    assert.equal(formatIPv4(maskFromPrefix(12)), '255.240.0.0')
  })

  test('a mask with a hole in it is not a mask', () => {
    assert.equal(prefixFromMask(ip('255.0.255.0')), null)
    assert.equal(prefixFromMask(ip('255.255.0.255')), null)
    assert.equal(prefixFromMask(ip('255.255.254.0')), 23)
  })
})

describe('what a prefix gives you', () => {
  test('the worked example every exam uses', () => {
    const s = subnetInfo(ip('192.168.1.130'), 26)
    assert.equal(formatIPv4(s.network), '192.168.1.128')
    assert.equal(formatIPv4(s.broadcast), '192.168.1.191')
    assert.equal(formatIPv4(s.firstHost), '192.168.1.129')
    assert.equal(formatIPv4(s.lastHost), '192.168.1.190')
    assert.equal(s.total, 64)
    assert.equal(s.usable, 62)
    assert.equal(formatIPv4(s.mask), '255.255.255.192')
    assert.equal(formatIPv4(s.wildcard), '0.0.0.63')
  })

  test('/31 gives two usable addresses, not zero', () => {
    // RFC 3021. A point-to-point link has no room for a network and broadcast
    // address, so both addresses are usable — the exception people get wrong.
    const s = subnetInfo(ip('10.0.0.4'), 31)
    assert.equal(s.total, 2)
    assert.equal(s.usable, 2)
    assert.equal(formatIPv4(s.firstHost), '10.0.0.4')
    assert.equal(formatIPv4(s.lastHost), '10.0.0.5')
  })

  test('/32 is a single host', () => {
    const s = subnetInfo(ip('10.0.0.7'), 32)
    assert.equal(s.total, 1)
    assert.equal(s.usable, 1)
    assert.equal(formatIPv4(s.network), '10.0.0.7')
    assert.equal(formatIPv4(s.broadcast), '10.0.0.7')
  })

  test('/0 is the whole internet', () => {
    const s = subnetInfo(ip('8.8.8.8'), 0)
    assert.equal(s.total, 4294967296)
    assert.equal(formatIPv4(s.network), '0.0.0.0')
    assert.equal(formatIPv4(s.broadcast), '255.255.255.255')
  })

  test('neighbours are decided by the mask, not by looking similar', () => {
    // .130 and .190 look further apart than .126 and .130, and are not.
    assert.equal(sameNetwork(ip('192.168.1.130'), ip('192.168.1.190'), 26), true)
    assert.equal(sameNetwork(ip('192.168.1.126'), ip('192.168.1.130'), 26), false)
  })
})

describe('classes and special ranges', () => {
  test('the first octet decides the class', () => {
    assert.equal(classOf(ip('10.0.0.1')).letter, 'A')
    assert.equal(classOf(ip('172.16.0.1')).letter, 'B')
    assert.equal(classOf(ip('192.168.1.1')).letter, 'C')
    assert.equal(classOf(ip('224.0.0.1')).letter, 'D')
    assert.equal(classOf(ip('250.1.1.1')).letter, 'E')
  })

  test('classes A, B and C carry a default prefix; D and E do not', () => {
    assert.equal(classOf(ip('10.0.0.1')).prefix, 8)
    assert.equal(classOf(ip('172.16.0.1')).prefix, 16)
    assert.equal(classOf(ip('192.168.1.1')).prefix, 24)
    assert.equal(classOf(ip('239.0.0.1')).prefix, null)
  })

  test('the ranges that are not ordinary addresses', () => {
    assert.equal(specialOf(ip('192.168.1.5')).kind, 'private')
    assert.equal(specialOf(ip('10.255.0.1')).kind, 'private')
    assert.equal(specialOf(ip('172.16.0.1')).kind, 'private')
    assert.equal(specialOf(ip('172.32.0.1')), null, '172.32 is outside the private block')
    assert.equal(specialOf(ip('127.0.0.1')).kind, 'loopback')
    assert.equal(specialOf(ip('169.254.5.5')).kind, 'link-local')
    assert.equal(specialOf(ip('224.0.0.251')).kind, 'multicast')
    assert.equal(specialOf(ip('255.255.255.255')).kind, 'broadcast')
    assert.equal(specialOf(ip('8.8.8.8')), null)
  })
})

describe('splitting a network', () => {
  test('borrowing bits doubles the subnets and halves the hosts', () => {
    const r = splitSubnets(ip('192.168.1.0'), 24, 26)
    assert.equal(r.borrowed, 2)
    assert.equal(r.count, 4)
    assert.deepEqual(r.subnets.map((s) => formatIPv4(s.network)),
      ['192.168.1.0', '192.168.1.64', '192.168.1.128', '192.168.1.192'])
    assert.equal(r.subnets[0].usable, 62)
  })

  test('the subnets tile the parent exactly, with no gap or overlap', () => {
    const parent = subnetInfo(ip('10.1.0.0'), 16)
    const r = splitSubnets(parent.network, 16, 20)
    assert.equal(r.count, 16)
    const built = splitSubnets(parent.network, 16, 20, 16).subnets
    assert.equal(formatIPv4(built[0].network), formatIPv4(parent.network))
    assert.equal(formatIPv4(built[built.length - 1].broadcast), formatIPv4(parent.broadcast))
    for (let i = 1; i < built.length; i++) {
      assert.equal(built[i].network, (built[i - 1].broadcast + 1) >>> 0, `gap before subnet ${i}`)
    }
  })

  test('a huge split is counted, not built', () => {
    const r = splitSubnets(ip('10.0.0.0'), 8, 24)
    assert.equal(r.count, 65536)
    assert.equal(r.subnets.length, 16)
    assert.equal(r.truncated, 65520)
  })

  test('you cannot split into something larger than the parent', () => {
    assert.equal(splitSubnets(ip('192.168.1.0'), 24, 20).count, 0)
  })
})

describe('the IPv4 header', () => {
  test('builds 20 bytes with version 4 and a 5-word header', () => {
    const { bytes } = buildIPv4Header({ src: ip('192.168.1.5'), dst: ip('140.82.113.4') })
    assert.equal(bytes.length, 20)
    assert.equal(bytes[0] >> 4, 4)
    assert.equal(bytes[0] & 0x0f, 5)
  })

  test('the checksum it writes is the checksum that verifies', () => {
    const { bytes } = buildIPv4Header({ ttl: 64, src: ip('192.168.1.5'), dst: ip('8.8.8.8') })
    assert.equal(verifyIPv4Checksum(bytes).ok, true)
  })

  test('changing any byte breaks the checksum — that is the whole point', () => {
    const { bytes } = buildIPv4Header({ ttl: 64, src: ip('192.168.1.5'), dst: ip('8.8.8.8') })
    for (let i = 0; i < bytes.length; i++) {
      if (i === 10 || i === 11) continue          // the checksum field itself
      const damaged = Uint8Array.from(bytes)
      damaged[i] ^= 0x01
      assert.equal(verifyIPv4Checksum(damaged).ok, false, `byte ${i} slipped through`)
    }
  })

  test('every hop must recompute it, because every hop changes the TTL', () => {
    const a = buildIPv4Header({ ttl: 64, src: ip('1.1.1.1'), dst: ip('2.2.2.2') })
    const b = buildIPv4Header({ ttl: 63, src: ip('1.1.1.1'), dst: ip('2.2.2.2') })
    assert.notEqual(a.checksum, b.checksum)
    assert.equal(verifyIPv4Checksum(b.bytes).ok, true)
  })

  test('the field map covers the header and reads back the values put in', () => {
    const { bytes } = buildIPv4Header({ ttl: 55, protocol: 17, src: ip('192.168.1.5'), dst: ip('8.8.4.4') })
    const fields = describeIPv4(bytes)
    const byName = Object.fromEntries(fields.map((f) => [f.name, f.value]))
    assert.equal(byName.TTL, 55)
    assert.equal(byName.Protocol, '17 (UDP)')
    assert.equal(byName.Source, '192.168.1.5')
    assert.equal(byName.Destination, '8.8.4.4')
  })
})

describe('IPv6 notation', () => {
  test('expands the short form to all eight groups', () => {
    assert.deepEqual(expandIPv6('::1'),
      ['0000', '0000', '0000', '0000', '0000', '0000', '0000', '0001'])
    assert.deepEqual(expandIPv6('2001:db8::1'),
      ['2001', '0db8', '0000', '0000', '0000', '0000', '0000', '0001'])
  })

  test('compresses the longest run of zeros, and only one run', () => {
    assert.equal(compressIPv6(expandIPv6('2001:db8::1')), '2001:db8::1')
    assert.equal(compressIPv6(expandIPv6('::1')), '::1')
    // Two runs of equal length: only the first may collapse, or the address
    // would be ambiguous. This is why :: appears at most once.
    const both = ['2001', '0000', '0000', '0001', '0000', '0000', '0000', '0002']
    const out = compressIPv6(both)
    assert.equal(out.split('::').length, 2, `${out} collapsed twice`)
    assert.equal(out, '2001:0:0:1::2')
  })

  test('round-trips a real address', () => {
    const facebook = '2a03:2880:f312:1:face:b00c:0:25de'
    assert.equal(compressIPv6(expandIPv6(facebook)), facebook)
  })

  test('rejects what is not an address', () => {
    for (const bad of ['1.2.3.4', 'gggg::1', '1:2:3:4:5:6:7', '1:2:3:4:5:6:7:8:9']) {
      assert.equal(expandIPv6(bad), null, `${bad} was accepted`)
    }
  })
})
