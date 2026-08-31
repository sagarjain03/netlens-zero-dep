
import { spec, isEndDevice } from './devices.js'
import { sameSubnet, broadcastDomain, ipValid, maskToPrefix } from './net.js'

// ── little helpers the checks are written in ────────────────────────────────

const ends = (s) => s.nodes.filter((n) => isEndDevice(n.kind))
const kindsIn = (s, cat) => s.nodes.filter((n) => spec(n.kind)?.cat === cat)
const routers = (s) => s.nodes.filter((n) => spec(n.kind)?.forwards === 'route' && !spec(n.kind)?.wan)
const named = (s, name) => s.nodes.find((n) => n.name === name)
const wired = (s, a, b) => s.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))
const degree = (s, id) => s.links.filter((l) => l.a === id || l.b === id).length
const withIp = (s, ip) => s.nodes.find((n) => n.ip === ip)

/** Did the learner run this command, and did it succeed / fail as required? */
const ran = (s, cmd, { ok = true, match } = {}) =>
  (s.log ?? []).some((e) => e.cmd === cmd && e.ok === ok && (!match || match(e)))

// ── topologies a lesson can start you from ──────────────────────────────────

const mk = (id, kind, name, x, y, ip = '', mask = '', gw = '') =>
  ({ id, kind, name, x, y, ports: spec(kind).ports, ip, mask, gw })

const TOPO = {
  twoPcs: () => ({
    nodes: [
      mk('n1', 'pc', 'PC0', 120, 140, '192.168.1.10', '255.255.255.0'),
      mk('n2', 'pc', 'PC1', 400, 140, '192.168.1.11', '255.255.255.0'),
    ],
    links: [{ id: 'l1', a: 'n1', b: 'n2', kind: 'crossover' }],
  }),

  twoLans: () => ({
    nodes: [
      mk('n1', 'pc', 'PC0', 90, 90, '192.168.1.10', '255.255.255.0'),
      mk('n2', 'pc', 'PC1', 90, 230, '192.168.1.11', '255.255.255.0'),
      mk('n3', 'switch8', 'SWITCH_8P0', 300, 160),
      mk('n4', 'server', 'SERVER0', 700, 160, '10.0.0.100', '255.255.255.0'),
      mk('n5', 'switch8', 'SWITCH_8P1', 520, 160),
    ],
    links: [
      { id: 'l1', a: 'n1', b: 'n3', kind: 'straight' },
      { id: 'l2', a: 'n2', b: 'n3', kind: 'straight' },
      { id: 'l3', a: 'n4', b: 'n5', kind: 'straight' },
    ],
  }),

  officeNoCloud: () => ({
    nodes: [
      mk('n1', 'pc', 'PC0', 90, 100, '192.168.1.10', '255.255.255.0', '192.168.1.1'),
      mk('n2', 'laptop', 'LAPTOP0', 90, 250, '192.168.1.11', '255.255.255.0', '192.168.1.1'),
      mk('n3', 'switch8', 'SWITCH_8P0', 320, 175),
      mk('n4', 'homerouter', 'HOME_ROUTER0', 550, 175, '192.168.1.1', '255.255.255.0'),
    ],
    links: [
      { id: 'l1', a: 'n1', b: 'n3', kind: 'straight' },
      { id: 'l2', a: 'n2', b: 'n3', kind: 'straight' },
      { id: 'l3', a: 'n3', b: 'n4', kind: 'straight' },
    ],
  }),

  // Four planted faults. This is the exam.
  broken: () => ({
    nodes: [
      mk('n1', 'pc', 'PC0', 80, 80, '192.168.1.10', '255.255.255.0', '192.168.0.1'), // gw outside subnet
      mk('n2', 'pc', 'PC1', 80, 210, '192.168.1.10', '255.255.255.0', '192.168.1.1'), // duplicate IP
      mk('n3', 'printer', 'PRINTER0', 80, 340, '192.168.1.50', '255.255.255.0', '192.168.1.1'), // unplugged
      mk('n4', 'switch8', 'SWITCH_8P0', 300, 210),
      mk('n5', 'router4p', 'ROUTER_4P0', 520, 210, '192.168.1.1', '255.255.255.0'),
      mk('n6', 'cloud', 'INTERNET0', 740, 210), // no cable to the router
    ],
    links: [
      { id: 'l1', a: 'n1', b: 'n4', kind: 'straight' },
      { id: 'l2', a: 'n2', b: 'n4', kind: 'straight' },
      { id: 'l3', a: 'n4', b: 'n5', kind: 'straight' },
    ],
  }),
}

// ── the curriculum ──────────────────────────────────────────────────────────

export const LESSONS = [

  {
    id: 'first-contact',
    title: 'Two machines and one wire',
    minutes: 5,
    goal: 'Build the smallest network that exists, and make one machine answer the other.',
    intro: 'A network does not need a router, a switch, or the internet. It needs two machines, a cable, and two addresses that agree. Everything else in networking is an answer to a problem this tiny network does not have yet.',
    steps: [
      {
        text: 'Drag two PCs from END_DEVICES onto the grid.',
        hint: 'The parts bin is on the far left. Drag, or just click the part.',
        check: (s) => ends(s).length >= 2,
      },
      {
        text: 'Press C for the cable tool, then click one PC and then the other.',
        hint: 'A PC has one port. Two PCs, one cable — that is all the ports you have.',
        check: (s) => {
          const e = ends(s)
          return e.length >= 2 && e.some((a) => e.some((b) => a.id !== b.id && wired(s, a.id, b.id)))
        },
      },
      {
        text: 'Click the first PC. Set its IP_ADDRESS to 192.168.1.10 and its SUBNET_MASK to 255.255.255.0.',
        hint: 'Properties are on the right. Press Enter or click away to commit.',
        check: (s) => ends(s).some((n) => n.ip === '192.168.1.10' && n.mask === '255.255.255.0'),
      },
      {
        text: 'Click the other PC. Give it 192.168.1.11 with the same mask.',
        hint: 'Same first three numbers, different last number. That is what makes them neighbours.',
        check: (s) => ends(s).some((n) => n.ip === '192.168.1.11' && n.mask === '255.255.255.0'),
      },
      {
        text: 'Press P for SEND PACKET, click the .10 machine, then click the other one. Watch the envelope cross the wire.',
        hint: 'The trace panel under the grid fills in as it travels, one device at a time.',
        check: (s) => ran(s, 'send') || ran(s, 'ping'),
      },
    ],
    outro: 'You saw the whole journey: PC0 decided the destination was a neighbour, put the frame on the wire, PC1 accepted it, and then the reply made the same trip backwards. No router was involved and none was needed. The two machines share one wire and their masks agree that they are in the same neighbourhood, so the frame goes straight across. Notice what you never had to configure: no gateway, no DNS, no route.',
  },

  {
    id: 'the-mask',
    title: 'The mask decides who is near',
    minutes: 6,
    goal: 'Break the link without touching a cable, then fix it without touching an address.',
    intro: 'Everyone learns "192.168.1.x is one network". That is a habit, not a rule. The mask is the rule, and this lesson proves it by breaking and repairing the same network twice.',
    setup: TOPO.twoPcs,
    steps: [
      {
        text: 'Change PC1\'s IP to 192.168.2.11. Leave both masks at 255.255.255.0.',
        hint: 'Only the third number changes. Physically nothing moved.',
        check: (s) => named(s, 'PC1')?.ip === '192.168.2.11',
      },
      {
        text: 'Press P and send a packet from PC0 to PC1. The envelope turns red on PC0 itself — read why in the trace.',
        hint: 'It is meant to fail. The tutor is waiting for the failure, not the success.',
        check: (s) => ran(s, 'send', { ok: false }) || ran(s, 'ping', { ok: false }),
      },
      {
        text: 'Now change BOTH masks to 255.255.0.0. Do not touch either address.',
        hint: 'Set it on PC0, then on PC1. The addresses stay 192.168.1.10 and 192.168.2.11.',
        check: (s) => named(s, 'PC0')?.mask === '255.255.0.0' && named(s, 'PC1')?.mask === '255.255.0.0',
      },
      {
        text: 'Send the packet from PC0 to PC1 again.',
        hint: 'Same cable, same addresses, different answer.',
        check: (s) => ran(s, 'send', { ok: true }) || ran(s, 'ping', { ok: true, match: (e) => e.args?.[0] === '192.168.2.11' }),
      },
    ],
    outro: 'The cable never moved and neither address changed. With a /24 mask the machines compared the first three numbers and disagreed; with /16 they compare only the first two and agree. "Same network" is a claim the mask makes, and two machines that disagree about their masks will disagree about reality.',
  },

  {
    id: 'why-a-switch',
    title: 'Why a third machine changes everything',
    minutes: 7,
    goal: 'Discover the limit of direct cabling, then remove it.',
    intro: 'Two machines need one cable. Three machines would need three, four would need six, and ten would need forty-five. Cabling everything to everything stops working almost immediately, and the box that fixes it is the switch.',
    setup: TOPO.twoPcs,
    steps: [
      {
        text: 'Add a third end device — a PRINTER is a good one.',
        hint: 'END_DEVICES, first group in the parts bin.',
        check: (s) => ends(s).length >= 3,
      },
      {
        text: 'Try to cable it to PC0. You cannot: PC0\'s one port is already used. Delete the PC0–PC1 cable instead (press X, click the cable).',
        hint: 'The status bar tells you when a port is full. X is the delete tool; press V to go back.',
        check: (s) => !s.links.some((l) => {
          const a = s.nodes.find((n) => n.id === l.a); const b = s.nodes.find((n) => n.id === l.b)
          return a && b && isEndDevice(a.kind) && isEndDevice(b.kind)
        }),
      },
      {
        text: 'Place a SWITCH_8P from the SWITCHES group.',
        hint: 'Eight ports means eight machines, not eight cables between machines.',
        check: (s) => kindsIn(s, 'switches').length >= 1,
      },
      {
        text: 'Cable all three end devices to the switch.',
        hint: 'Press C, click a PC, click the switch. Repeat three times.',
        check: (s) => {
          const sw = kindsIn(s, 'switches')[0]
          if (!sw) return false
          return ends(s).filter((n) => wired(s, n.id, sw.id)).length >= 3
        },
      },
      {
        text: 'Give the printer an address in the same subnet, then select a PC and run  arp',
        hint: 'The printer needs the same first three numbers as the PCs, and a different last one.',
        check: (s) => ran(s, 'arp'),
      },
    ],
    outro: 'Three cables instead of three, but ten machines is ten cables instead of forty-five, and that is why every wall socket in every office runs back to a switch. Look at what the switch does NOT have: no IP address, no gateway, nothing to configure. It has no idea the internet exists. It moves frames between ports by MAC address and that is the whole job. A hub would have worked here too — the difference is that a hub copies every frame to every port, so all three machines hear all three conversations.',
  },

  {
    id: 'the-gateway',
    title: 'Leaving your own subnet',
    minutes: 8,
    goal: 'Join two separate networks with a router, and see why both ends need configuring.',
    intro: 'So far everything has been neighbours shouting across one wire. Now there are two networks that cannot hear each other at all, and the only box that can join them is a router — because it is the only box that reads IP addresses.',
    setup: TOPO.twoLans,
    steps: [
      {
        text: 'Look at what you have: 192.168.1.x on the left, 10.0.0.x on the right, and nothing joining them. Press P and send a packet from PC0 to 10.0.0.100. Read why it dies.',
        hint: 'It is supposed to fail. The trace names exactly what is missing.',
        check: (s) => ran(s, 'send', { ok: false }) || ran(s, 'ping', { ok: false }),
      },
      {
        text: 'Place a ROUTER_2P from the ROUTERS group, between the two switches.',
        hint: 'Two ports is exactly right: one for each network.',
        check: (s) => routers(s).length >= 1,
      },
      {
        text: 'Cable the router to BOTH switches.',
        hint: 'One cable to SWITCH_8P0, one to SWITCH_8P1.',
        check: (s) => {
          const r = routers(s)[0]
          if (!r) return false
          return kindsIn(s, 'switches').filter((sw) => wired(s, r.id, sw.id)).length >= 2
        },
      },
      {
        text: 'Give the router the address 192.168.1.1 with mask 255.255.255.0.',
        hint: 'A router sits inside the subnet it serves. .1 is the customary address for it.',
        check: (s) => routers(s).some((r) => r.ip === '192.168.1.1' && r.mask === '255.255.255.0'),
      },
      {
        text: 'Set DEFAULT_GATEWAY to 192.168.1.1 on both PC0 and PC1, then send a packet from PC0 to 10.0.0.100. It dies ON THE ROUTER — read the trace.',
        hint: 'The router has one address, in one subnet. It cannot forward into a network it does not stand inside.',
        check: (s) => ['PC0', 'PC1'].every((n) => named(s, n)?.gw === '192.168.1.1')
          && (ran(s, 'send', { ok: false }) || ran(s, 'ping', { ok: false })),
      },
      {
        text: 'Select the router and click "+ add interface". Give the new interface 10.0.0.1 with mask 255.255.255.0.',
        hint: 'A router stands inside every subnet it serves. One address per side — that is the whole job.',
        check: (s) => routers(s).some((r) => (r.ifaces ?? []).some((f) => f.ip === '10.0.0.1')),
      },
      {
        text: 'Send from PC0 to 10.0.0.100 again. It reaches SERVER0 — and then the REPLY dies. Give SERVER0 a default gateway of 10.0.0.1 and send once more.',
        hint: 'A reply is a packet travelling the other way, and it needs a gateway exactly as much as the request did.',
        check: (s) => ran(s, 'send', { ok: true }) || ran(s, 'ping', { ok: true, match: (e) => e.args?.[0] === '10.0.0.100' }),
      },
    ],
    outro: 'The step everyone skips is the last one. A packet that arrives but cannot be answered looks identical, from the sender\'s side, to a packet that never arrived — and half of all "the network is down" tickets are really a missing return path. Notice too that you configured the router with an address, which no switch in this course has ever needed. That is the difference between layer 2 and layer 3 in one observation.',
  },

  {
    id: 'the-way-out',
    title: 'The moment the simulation stops',
    minutes: 6,
    goal: 'Wire your network to the real internet and send genuine packets from it.',
    intro: 'Everything so far has been a drawing, checked by a program in your browser. This lesson connects the drawing to the actual network card in this machine. Once the path is valid, nothing is simulated any more.',
    setup: TOPO.officeNoCloud,
    steps: [
      {
        text: 'From PC0, run  dig github.com  — it refuses, because there is nowhere to go.',
        hint: 'Read the refusal. It names the missing piece.',
        check: (s) => ran(s, 'dig', { ok: false }),
      },
      {
        text: 'Place an INTERNET device from WAN_EMULATION.',
        hint: 'It is the cloud, last group in the parts bin.',
        check: (s) => s.nodes.some((n) => spec(n.kind)?.wan),
      },
      {
        text: 'Cable the router to the INTERNET device.',
        hint: 'Fiber is the honest choice for a link to your ISP, but any cable works here.',
        check: (s) => {
          const cloud = s.nodes.find((n) => spec(n.kind)?.wan)
          return Boolean(cloud) && routers(s).some((r) => wired(s, r.id, cloud.id))
        },
      },
      {
        text: 'From PC0, run  dig github.com  again.',
        hint: 'Same command, valid path. Watch the byte count.',
        check: (s) => ran(s, 'dig', { ok: true }),
      },
      {
        text: 'Now run  tls github.com  and read the certificate that comes back.',
        hint: 'Subject, issuer and dates are printed. That certificate was signed by a real authority.',
        check: (s) => ran(s, 'tls', { ok: true }),
      },
      {
        text: 'Finally run  tracert 1.1.1.1  and watch the hops arrive one at a time.',
        hint: 'Some rows will be stars. Those are routers that decline to answer, which is normal.',
        check: (s) => ran(s, 'tracert', { ok: true }) || ran(s, 'traceroute', { ok: true }),
      },
    ],
    outro: 'Those bytes were real. The DNS query was built one byte at a time and sent over UDP to a public resolver; the certificate came off a live TLS handshake; the traceroute hops are routers that physically exist between this building and Cloudflare. The drawing did not send them — the drawing decided whether they were allowed to be sent.',
  },

  {
    id: 'fault-finder',
    title: 'Fix a broken network',
    minutes: 12,
    goal: 'Four faults, no hints about where they are. Repair the network until every device reports OK.',
    intro: 'This is the exam. A small office network has been handed to you and it does not work. Nobody will tell you what is wrong. Select devices, read the PROBLEMS list, run commands, and repair it. The command  check  tests every end device at once — start there.',
    setup: TOPO.broken,
    steps: [
      {
        text: 'Run  check  from any device to see the damage. Then press P and send packets around to watch where they die.',
        hint: 'Select PC0 first — the console needs a device with an address.',
        check: (s) => ran(s, 'check'),
      },
      {
        text: 'Fault 1: two machines are claiming the same address. Give one of them a different one.',
        hint: 'Select each PC and compare. A duplicate address is flagged in red in PROBLEMS.',
        check: (s) => {
          const ips = ends(s).map((n) => n.ip).filter(Boolean)
          return new Set(ips).size === ips.length
        },
      },
      {
        text: 'Fault 2: one machine\'s gateway is not an address on its own wire. Correct it.',
        hint: 'A gateway must be inside the same subnet as the device. Check PC0 against the router.',
        check: (s) => ends(s).every((n) => !n.gw || (ipValid(n.gw) && sameSubnet(n.ip, n.gw, n.mask) && Boolean(withIp(s, n.gw)))),
      },
      {
        text: 'Fault 3: one device is not plugged into anything. Cable it to the switch.',
        hint: 'The unplugged device shows 0/1 in the corner of its box.',
        // The INTERNET box is meant to be unplugged at this point — that is the
        // next fault, and failing this step for it would give away the answer.
        check: (s) => s.nodes.filter((n) => !spec(n.kind)?.wan).every((n) => degree(s, n.id) > 0),
      },
      {
        text: 'Fault 4: the router cannot reach the outside. Fix that.',
        hint: 'Everything inside works now. Trace the path outward and find where it stops.',
        check: (s) => {
          const cloud = s.nodes.find((n) => spec(n.kind)?.wan)
          return Boolean(cloud) && routers(s).some((r) => wired(s, r.id, cloud.id))
        },
      },
      {
        text: 'Run  check  again. Every end device must say internet OK.',
        hint: 'If one still fails, the console prints exactly which condition is unmet.',
        check: (s) => ran(s, 'check', { match: (e) => e.allOk === true }),
      },
    ],
    outro: 'Four faults, four different symptoms, and not one of them was a broken cable in the physical sense. Duplicate address, gateway outside the subnet, unplugged port, missing uplink: this is very close to the real distribution of causes behind "the internet is down". You now have a method — read the problems, test one thing, change one thing.',
  },
]

export const lessonById = (id) => LESSONS.find((l) => l.id === id) ?? null
export const totalSteps = (lesson) => lesson.steps.length
