
export const CATEGORIES = [
  { id: 'end', name: 'END_DEVICES', note: 'they originate traffic' },
  { id: 'routers', name: 'ROUTERS', note: 'layer 3 — they read IP' },
  { id: 'switches', name: 'SWITCHES', note: 'layer 2 — they read MAC' },
  { id: 'hubs', name: 'HUBS', note: 'layer 1 — they read nothing' },
  { id: 'wireless', name: 'WIRELESS', note: 'the cable is radio' },
  { id: 'security', name: 'SECURITY', note: 'routers with rules' },
  { id: 'wan', name: 'WAN_EMULATION', note: 'the way out' },
]

const LAN = { mask: '255.255.255.0', gw: '192.168.1.1' }

export const DEVICES = {

  // ── end devices ───────────────────────────────────────────────────────────
  pc: {
    id: 'pc', name: 'PC', cat: 'end', glyph: '🖥', layer: 7,
    ports: 1, hasIp: true, forwards: null,
    blurb: 'An ordinary desktop. One port, so it can hold exactly one cable — which is why three PCs need a switch between them.',
    defaults: { ip: '192.168.1.10', ...LAN },
  },
  laptop: {
    id: 'laptop', name: 'LAPTOP', cat: 'end', glyph: '💻', layer: 7,
    ports: 2, hasIp: true, forwards: null,
    blurb: 'A PC with a second port, so it can take a wired and a wireless link at once.',
    defaults: { ip: '192.168.1.11', ...LAN },
  },
  server: {
    id: 'server', name: 'SERVER', cat: 'end', glyph: '🗄', layer: 7,
    ports: 2, hasIp: true, forwards: null,
    blurb: 'A machine that answers instead of asking. Give it a fixed address — a server that moves is a server nobody can find.',
    defaults: { ip: '192.168.1.100', ...LAN },
  },
  printer: {
    id: 'printer', name: 'PRINTER', cat: 'end', glyph: '🖨', layer: 7,
    ports: 1, hasIp: true, forwards: null,
    blurb: 'An end device like any other. It has an IP, and that is the entire reason you can print from across the office.',
    defaults: { ip: '192.168.1.50', ...LAN },
  },
  ipphone: {
    id: 'ipphone', name: 'IP_PHONE', cat: 'end', glyph: '☎', layer: 7,
    ports: 2, hasIp: true, forwards: null,
    blurb: 'A desk phone that speaks IP. Its second port is a pass-through, so the PC on the desk shares one wall socket.',
    defaults: { ip: '192.168.1.60', ...LAN },
  },
  tablet: {
    id: 'tablet', name: 'TABLET', cat: 'end', glyph: '📋', layer: 7,
    ports: 1, hasIp: true, forwards: null,
    blurb: 'Wireless-only in real life. Wire it to an access point.',
    defaults: { ip: '192.168.1.21', ...LAN },
  },
  smartphone: {
    id: 'smartphone', name: 'SMARTPHONE', cat: 'end', glyph: '📱', layer: 7,
    ports: 1, hasIp: true, forwards: null,
    blurb: 'An end device with a radio instead of a socket. Everything else about it is a PC.',
    defaults: { ip: '192.168.1.20', ...LAN },
  },
  tv: {
    id: 'tv', name: 'SMART_TV', cat: 'end', glyph: '📺', layer: 7,
    ports: 1, hasIp: true, forwards: null,
    blurb: 'Proof that "end device" is about behaviour, not about being a computer.',
    defaults: { ip: '192.168.1.30', ...LAN },
  },

  // ── routers ───────────────────────────────────────────────────────────────
  router2p: {
    id: 'router2p', name: 'ROUTER_2P', cat: 'routers', glyph: '⇅', layer: 3,
    ports: 2, hasIp: true, forwards: 'route', perPortIp: true,
    blurb: 'The smallest useful router: one port on each of two subnets. This is the box that makes "two networks" possible at all.',
    defaults: { ip: '192.168.1.1', mask: '255.255.255.0', gw: '' },
  },
  router4p: {
    id: 'router4p', name: 'ROUTER_4P', cat: 'routers', glyph: '⇅', layer: 3,
    ports: 4, hasIp: true, forwards: 'route', perPortIp: true,
    blurb: 'A branch-office router. Four ports, so it can join a LAN, a WAN link and a spare.',
    defaults: { ip: '192.168.1.1', mask: '255.255.255.0', gw: '' },
  },
  router8p: {
    id: 'router8p', name: 'ROUTER_8P', cat: 'routers', glyph: '⇈', layer: 3,
    ports: 8, hasIp: true, forwards: 'route', perPortIp: true,
    blurb: 'A bigger chassis. Nothing new conceptually — a router with two ports and a router with eight do exactly the same job.',
    defaults: { ip: '10.0.0.1', mask: '255.255.255.0', gw: '' },
  },
  l3switch: {
    id: 'l3switch', name: 'L3_SWITCH', cat: 'routers', glyph: '⧉', layer: 3,
    ports: 12, hasIp: true, forwards: 'route', perPortIp: true,
    blurb: 'Switch ports with a router hidden inside. Common in real buildings, and the reason "is it a switch or a router" is sometimes a bad question.',
    defaults: { ip: '192.168.1.1', mask: '255.255.255.0', gw: '' },
  },

  // ── switches ──────────────────────────────────────────────────────────────
  switch8: {
    id: 'switch8', name: 'SWITCH_8P', cat: 'switches', glyph: '⇄', layer: 2,
    ports: 8, hasIp: false, forwards: 'flood',
    blurb: 'Learns which MAC address sits on which port, then sends each frame only there. It does not understand IP addresses at all.',
  },
  switch24: {
    id: 'switch24', name: 'SWITCH_24P', cat: 'switches', glyph: '⇄', layer: 2,
    ports: 24, hasIp: false, forwards: 'flood',
    blurb: 'The switch in the cupboard on your office floor. Same behaviour as the 8-port, more sockets.',
  },
  bridge: {
    id: 'bridge', name: 'BRIDGE', cat: 'switches', glyph: '⌗', layer: 2,
    ports: 2, hasIp: false, forwards: 'flood',
    blurb: 'A two-port switch. Joins two segments into one broadcast domain — a switch is really just a bridge with more ports.',
  },

  // ── hubs ──────────────────────────────────────────────────────────────────
  hub: {
    id: 'hub', name: 'HUB_8P', cat: 'hubs', glyph: '⬡', layer: 1,
    ports: 8, hasIp: false, forwards: 'flood',
    blurb: 'Repeats every signal out of every other port. It has no idea who anyone is, so everybody hears everything. This is why hubs are extinct.',
  },
  repeater: {
    id: 'repeater', name: 'REPEATER', cat: 'hubs', glyph: '↔', layer: 1,
    ports: 2, hasIp: false, forwards: 'flood',
    blurb: 'A two-port hub. Its only job is to make a weak signal strong again so the cable can be longer.',
  },
  splitter: {
    id: 'splitter', name: 'COAX_SPLITTER', cat: 'hubs', glyph: '⑂', layer: 1,
    ports: 3, hasIp: false, forwards: 'flood',
    blurb: 'Splits one coaxial run into two. Layer 1 in the purest sense: it copies electricity and understands nothing.',
  },

  // ── wireless ──────────────────────────────────────────────────────────────
  ap: {
    id: 'ap', name: 'ACCESS_POINT', cat: 'wireless', glyph: '📡', layer: 2,
    ports: 8, hasIp: false, forwards: 'flood',
    blurb: 'A switch whose cable is made of radio. Everything on it lands in the same broadcast domain as the wired side — an AP is not a router.',
  },
  apn: {
    id: 'apn', name: 'AP_DUAL_BAND', cat: 'wireless', glyph: '📶', layer: 2,
    ports: 16, hasIp: false, forwards: 'flood',
    blurb: 'Two radios instead of one. More clients, same layer-2 behaviour.',
  },
  homerouter: {
    id: 'homerouter', name: 'HOME_ROUTER', cat: 'wireless', glyph: '🛜', layer: 3,
    ports: 5, hasIp: true, forwards: 'route', perPortIp: true,
    blurb: 'The box on your wall. It is a router, a switch and an access point in one plastic shell, which is why the word "router" confuses everyone.',
    defaults: { ip: '192.168.1.1', mask: '255.255.255.0', gw: '' },
  },

  // ── security ──────────────────────────────────────────────────────────────
  firewall: {
    id: 'firewall', name: 'FIREWALL', cat: 'security', glyph: '🛡', layer: 3,
    ports: 4, hasIp: true, forwards: 'route', perPortIp: true,
    blurb: 'A router with opinions. It forwards like a router, then drops whatever its rules say to drop.',
    defaults: { ip: '10.0.0.1', mask: '255.255.255.0', gw: '' },
  },
  vpn: {
    id: 'vpn', name: 'VPN_GATEWAY', cat: 'security', glyph: '🔐', layer: 3,
    ports: 3, hasIp: true, forwards: 'route', perPortIp: true,
    blurb: 'A router that wraps traffic in encryption before sending it over somebody else\'s network.',
    defaults: { ip: '10.10.0.1', mask: '255.255.255.0', gw: '' },
  },

  // ── WAN emulation ─────────────────────────────────────────────────────────
  modem: {
    id: 'modem', name: 'DSL_MODEM', cat: 'wan', glyph: '⌗', layer: 1,
    ports: 2, hasIp: false, forwards: 'flood',
    blurb: 'Turns your ISP\'s signal into ethernet. It carries frames through and does not route, which is why it needs a router behind it.',
  },
  cablemodem: {
    id: 'cablemodem', name: 'CABLE_MODEM', cat: 'wan', glyph: '⌸', layer: 1,
    ports: 2, hasIp: false, forwards: 'flood',
    blurb: 'Same job as the DSL modem over a different physical medium.',
  },
  cloud: {
    id: 'cloud', name: 'INTERNET', cat: 'wan', glyph: '☁', layer: 3,
    ports: 6, hasIp: false, forwards: 'route', wan: true,
    blurb: 'Everything you do not own. Wire a router to this and the console stops pretending — commands go out on the real wire.',
  },
}

/** Packet Tracer calls these Connections. The kind changes the line, not the logic. */
export const CABLES = {
  straight: { id: 'straight', name: 'copper straight', dash: null, colorVar: '--out' },
  crossover: { id: 'crossover', name: 'copper crossover', dash: '10 3', colorVar: '--out' },
  fiber: { id: 'fiber', name: 'fiber', dash: null, colorVar: '--mag' },
  coax: { id: 'coax', name: 'coaxial', dash: '1 3', colorVar: '--fg-1' },
  serial: { id: 'serial', name: 'serial', dash: '6 4', colorVar: '--warn' },
  wireless: { id: 'wireless', name: 'wireless', dash: '2 6', colorVar: '--in' },
}

export const byCategory = (cat) => Object.values(DEVICES).filter((d) => d.cat === cat)
export const spec = (kind) => DEVICES[kind] ?? null

/** True for boxes that originate traffic — the ones a lesson can hand a console to. */
export const isEndDevice = (kind) => {
  const s = spec(kind)
  return Boolean(s?.hasIp && s.forwards !== 'route')
}
