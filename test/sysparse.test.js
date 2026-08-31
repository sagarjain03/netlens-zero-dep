/**
 * sysparse.test.js — the OS output parsers, on all three platforms.
 *
 * These are the only parsers whose input we do not control, and a judge will
 * run this on a machine we have never seen. Every format is captured to a
 * fixture and asserted here, so a Windows-only assumption cannot reach Day 3
 * undetected.
 *
 * Fixtures use synthetic MACs and addresses that keep the exact shape of real
 * output — committing a developer's actual hardware addresses and ISP resolvers
 * to a public repository would be careless.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseIpconfig, parseIpAddr, parseIfconfig, primaryInterface,
  parseArpWin, parseIpNeigh, parseArpUnix, realDevices,
  parseRouteWin, parseIpRoute, defaultRoute,
  parseNetstat, prefixToMask, maskToPrefix, normaliseMac,
} from '../src/sys/netinfo.js'
import { parsePing, hopsFromTtl, ttlOrigin } from '../src/sys/ping.js'
import { resolveCommand, validateHost, OPERATIONS } from '../src/sys/exec.js'

const DIR = fileURLToPath(new URL('./fixtures/sys/', import.meta.url))
const fx = (n) => readFileSync(join(DIR, n), 'utf8')

// ── interfaces ──────────────────────────────────────────────────────────────

describe('sys · interfaces on every platform', () => {
  const cases = [
    ['windows', parseIpconfig(fx('ipconfig-win.txt')), 'Wi-Fi'],
    ['linux', parseIpAddr(fx('ip-addr-linux.txt')), 'wlan0'],
    ['macos', parseIfconfig(fx('ifconfig-mac.txt')), 'en0'],
  ]

  for (const [os, interfaces, wifiName] of cases) {
    test(`${os}: the primary interface has the four facts chapter 1 needs`, () => {
      const primary = primaryInterface(interfaces)
      assert.ok(primary, `${os}: an interface with a routable address`)
      assert.equal(primary.name, wifiName)
      assert.ok(primary.addresses.includes('192.168.1.35'), `${os}: your IP`)
      assert.equal(primary.mask, '255.255.255.0', `${os}: your subnet mask`)
      assert.equal(primary.mac, 'aa:bb:cc:11:22:33', `${os}: your MAC, normalised`)
    })
  }

  test('windows also reports the gateway and both DNS servers', () => {
    const primary = primaryInterface(parseIpconfig(fx('ipconfig-win.txt')))
    assert.equal(primary.gateway, '192.168.1.1')
    assert.deepEqual(primary.dns, ['103.127.130.13', '103.127.130.50'],
      'the second server is on a bare continuation line')
    assert.equal(primary.dhcp, true)
  })

  test('loopback is never chosen as your network', () => {
    for (const [, interfaces] of cases) {
      assert.notEqual(primaryInterface(interfaces)?.name, 'lo')
      assert.notEqual(primaryInterface(interfaces)?.name, 'lo0')
    }
  })

  test('a disconnected adapter is kept but not chosen', () => {
    const interfaces = parseIpconfig(fx('ipconfig-win.txt'))
    assert.ok(interfaces.some((i) => i.name === 'Ethernet'), 'still listed')
    assert.equal(primaryInterface(interfaces).name, 'Wi-Fi')
  })

  test('macOS hex netmasks are converted to dotted quads', () => {
    assert.equal(primaryInterface(parseIfconfig(fx('ifconfig-mac.txt'))).mask, '255.255.255.0')
  })

  test('a linux prefix length becomes the same mask', () => {
    assert.equal(prefixToMask(24), '255.255.255.0')
    assert.equal(prefixToMask(16), '255.255.0.0')
    assert.equal(prefixToMask(32), '255.255.255.255')
    assert.equal(prefixToMask(0), '0.0.0.0')
    assert.equal(maskToPrefix('255.255.255.0'), 24)
    assert.equal(maskToPrefix('255.255.0.0'), 16)
  })

  test('MAC formatting is normalised across platforms', () => {
    assert.equal(normaliseMac('AA-BB-CC-11-22-33'), 'aa:bb:cc:11:22:33')
    assert.equal(normaliseMac('aa:bb:cc:11:22:33'), 'aa:bb:cc:11:22:33')
  })
})

// ── ARP ─────────────────────────────────────────────────────────────────────

describe('sys · the neighbours on your LAN', () => {
  const cases = [
    ['windows', parseArpWin(fx('arp-win.txt'))],
    ['linux', parseIpNeigh(fx('ip-neigh-linux.txt'))],
    ['macos', parseArpUnix(fx('arp-mac.txt'))],
  ]

  for (const [os, entries] of cases) {
    test(`${os}: the router and two other devices are found`, () => {
      const devices = realDevices(entries)
      assert.ok(devices.length >= 3, `${os}: expected at least three real devices`)
      const router = devices.find((d) => d.ip === '192.168.1.1')
      assert.ok(router, `${os}: the gateway is in the table`)
      assert.equal(router.mac, 'aa:bb:cc:00:11:22')
      assert.ok(devices.some((d) => d.ip === '192.168.1.36'), `${os}: someone else's device`)
    })
  }

  test('multicast and broadcast are filtered out — they are not devices', () => {
    const all = parseArpWin(fx('arp-win.txt'))
    const devices = realDevices(all)
    assert.ok(all.length > devices.length, 'the raw table has more rows')
    for (const d of devices) {
      assert.ok(Number(d.ip.split('.')[0]) < 224, `${d.ip} must not be multicast`)
      assert.ok(!d.ip.endsWith('.255'), `${d.ip} must not be broadcast`)
      assert.ok(!d.mac.startsWith('01:00:5e'), `${d.mac} must not be a multicast MAC`)
    }
  })

  test('macOS drops leading zeros, and normalisation puts them back', () => {
    // macOS prints aa:bb:cc:0:11:22 where Windows prints aa-bb-cc-00-11-22.
    // Without padding, the same router appears as two different devices.
    const mac = parseArpUnix(fx('arp-mac.txt')).find((e) => e.ip === '192.168.1.1').mac
    assert.equal(mac, 'aa:bb:cc:00:11:22')
    assert.equal(normaliseMac('1:0:5e:0:0:fb'), '01:00:5e:00:00:fb')
    assert.equal(normaliseMac('AA-BB-CC-11-22-33'), normaliseMac('aa:bb:cc:11:22:33'))
  })

  test('a linux neighbour with no MAC yet is skipped, not reported as a device', () => {
    const entries = parseIpNeigh(fx('ip-neigh-linux.txt'))
    assert.ok(!entries.some((e) => e.ip === '192.168.1.99'), 'FAILED entries have no address to show')
  })
})

// ── routing ─────────────────────────────────────────────────────────────────

describe('sys · your routing table', () => {
  const win = parseRouteWin(fx('route-win.txt'))
  const linux = parseIpRoute(fx('ip-route-linux.txt'))

  test('windows: the default route points at the gateway', () => {
    const def = defaultRoute(win)
    assert.ok(def, 'there is a default route')
    assert.equal(def.destination, '0.0.0.0')
    assert.equal(def.gateway, '192.168.1.1')
    assert.equal(def.prefix, 0, '0.0.0.0/0 — "anything I do not otherwise know"')
  })

  test('linux: default via is read the same way', () => {
    const def = defaultRoute(linux)
    assert.ok(def)
    assert.equal(def.gateway, '192.168.1.1')
    assert.equal(def.iface, 'wlan0')
    assert.equal(def.isDefault, true)
  })

  test('both platforms agree the LAN is directly reachable', () => {
    for (const [os, routes] of [['win', win], ['linux', linux]]) {
      const lan = routes.find((r) => r.destination === '192.168.1.0')
      assert.ok(lan, `${os}: the local subnet has its own route`)
      assert.equal(lan.gateway, null, `${os}: on-link — no gateway needed for neighbours`)
      assert.equal(lan.prefix, 24)
    }
  })

  test('the interface list header is not mistaken for routes', () => {
    assert.ok(win.length <= 6, `parsed ${win.length} routes; the Interface List must be skipped`)
    assert.ok(win.every((r) => /^\d+\.\d+\.\d+\.\d+$/.test(r.destination)))
  })
})

// ── netstat ─────────────────────────────────────────────────────────────────

describe('sys · live connections', () => {
  test('windows netstat and linux ss reduce to the same shape', () => {
    for (const [os, rows] of [
      ['windows', parseNetstat(fx('netstat-win.txt'))],
      ['linux', parseNetstat(fx('ss-linux.txt'))],
    ]) {
      const https = rows.filter((r) => r.foreign.port === 443)
      assert.ok(https.length >= 3, `${os}: several HTTPS connections`)
      for (const r of https) {
        assert.equal(r.proto, 'TCP')
        assert.match(r.local.host, /^\d+\.\d+\.\d+\.\d+$/)
        assert.ok(r.local.port > 1024, `${os}: the local end uses an ephemeral port`)
      }
    }
  })

  test('column headers are never parsed as connections', () => {
    for (const f of ['netstat-win.txt', 'ss-linux.txt']) {
      for (const r of parseNetstat(fx(f))) {
        assert.notEqual(r.state, 'STATE')
        assert.ok(Number.isFinite(r.foreign.port), `${f}: every row has a real port`)
      }
    }
  })
})

// ── ping ────────────────────────────────────────────────────────────────────

describe('sys · ping on every platform', () => {
  for (const [os, file, count] of [
    ['windows', 'ping-win.txt', 4],
    ['linux', 'ping-linux.txt', 4],
    ['macos', 'ping-mac.txt', 3],
  ]) {
    test(`${os}: replies, timings and TTL are all read`, () => {
      const r = parsePing(fx(file))
      assert.equal(r.reachable, true)
      assert.equal(r.replies.length, count)
      assert.equal(r.sent, count)
      assert.equal(r.received, count)
      assert.equal(r.lossPercent, 0)
      assert.equal(r.ttl, 59)
      assert.equal(r.ip, '1.1.1.1')
      assert.ok(r.min >= 6 && r.min <= 7, `${os}: min ${r.min}`)
      assert.ok(r.max >= 17 && r.max <= 18, `${os}: max ${r.max}`)
      assert.ok(r.avg > r.min && r.avg < r.max, `${os}: avg sits between`)
    })
  }

  test('an unreachable host is reported as unreachable, not as an error', () => {
    for (const f of ['ping-win-unreachable.txt', 'ping-linux-unreachable.txt']) {
      const r = parsePing(fx(f))
      assert.equal(r.reachable, false)
      assert.equal(r.received, 0)
      assert.equal(r.lossPercent, 100)
      assert.ok(r.reason, `${f}: says why`)
    }
  })

  test('partial loss keeps the replies that did arrive', () => {
    const r = parsePing(fx('ping-win-loss.txt'))
    assert.equal(r.reachable, true)
    assert.equal(r.sent, 4)
    assert.equal(r.received, 2)
    assert.equal(r.lost, 2)
    assert.equal(r.lossPercent, 50)
    assert.equal(r.replies.length, 2, 'the two that came back are still usable')
  })

  test('TTL reveals the distance without running traceroute', () => {
    // Senders start at 64, 128 or 255; every router subtracts one.
    assert.equal(hopsFromTtl(59), 5, '64 - 59 = 5 hops away')
    assert.equal(hopsFromTtl(115), 13, '128 - 115 = 13 hops away')
    assert.equal(hopsFromTtl(250), 5, '255 - 250 = 5 hops away')
    assert.equal(hopsFromTtl(64), 0, 'a direct neighbour')
    assert.equal(hopsFromTtl(null), null)
    assert.equal(hopsFromTtl(0), null)

    assert.equal(ttlOrigin(59), 64)
    assert.equal(ttlOrigin(115), 128)

    assert.equal(parsePing(fx('ping-win.txt')).hopsAway, 5)
    assert.equal(parsePing(fx('ping-win-loss.txt')).hopsAway, 13, '8.8.8.8 is further away')
  })

  test('empty or garbage output does not throw', () => {
    for (const input of ['', 'command not found', 'ping: unknown host zzz']) {
      const r = parsePing(input)
      assert.equal(r.reachable, false)
      assert.equal(r.replies.length, 0)
    }
  })
})

// ── command construction ────────────────────────────────────────────────────

describe('sys · commands are built safely', () => {
  test('each operation resolves to a real binary on each platform', () => {
    for (const name of Object.keys(OPERATIONS)) {
      for (const os of ['win32', 'linux', 'darwin']) {
        const cmd = resolveCommand(name, { host: 'example.com' }, os)
        assert.ok(cmd.binary, `${name} on ${os}`)
        assert.ok(Array.isArray(cmd.args))
        assert.ok(cmd.args.every((a) => typeof a === 'string'))
      }
    }
  })

  test('a host reaches argv only after passing validation', () => {
    const cmd = resolveCommand('ping', { host: 'example.com' }, 'win32')
    assert.deepEqual(cmd.args, ['-n', '4', 'example.com'])
    assert.equal(cmd.args[cmd.args.length - 1], 'example.com', 'the host is the final argument')
  })

  test('anything that is not a host is refused before it becomes a process', () => {
    for (const bad of [
      'example.com; rm -rf /',      // shell metacharacters
      'a b',                        // a second argument in disguise
      '-oProxyCommand=x',           // a flag wearing a host's name
      '--help',
      '',
      'x'.repeat(300),
      'host|whoami',
      '$(whoami)',
      '`id`',
    ]) {
      assert.throws(() => validateHost(bad), /valid host|host is required/, `"${bad}" must be refused`)
      assert.throws(() => resolveCommand('ping', { host: bad }, 'linux'))
    }
  })

  test('legitimate hosts are accepted', () => {
    for (const good of ['example.com', '1.1.1.1', 'a.b.c.d.example.co.uk', 'localhost', '2606:4700::1111']) {
      assert.equal(validateHost(good), good)
    }
  })

  test('counts are clamped, so no argument can be huge', () => {
    assert.deepEqual(resolveCommand('ping', { host: 'a.com', count: 9999 }, 'linux').args, ['-c', '10', 'a.com'])
    assert.deepEqual(resolveCommand('ping', { host: 'a.com', count: -5 }, 'linux').args, ['-c', '1', 'a.com'])
    assert.deepEqual(resolveCommand('ping', { host: 'a.com', count: 'abc' }, 'linux').args, ['-c', '4', 'a.com'])
    assert.deepEqual(resolveCommand('trace', { host: 'a.com', maxHops: 999 }, 'linux').args,
      ['-n', '-m', '30', '-w', '2', 'a.com'])
  })

  test('an unknown operation is refused rather than guessed at', () => {
    assert.throws(() => resolveCommand('rm', {}, 'linux'), /unknown operation/)
  })
})
