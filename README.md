# netlens

**Learn computer networking with real packets you can open, edit, break, and re-send.**

`Node >= 20` · `0 dependencies` · `430 tests, all offline` · `MIT`

```bash
node run.js          # http://127.0.0.1:7777 — no install step
```

Not one npm package, at runtime or in development. The DNS codec, the X.509
parser, the terminal emulator, the tween engine, the bundler and the web server
are all in this repository, and [a verifier proves
it](#zero-dependencies-and-we-prove-it) on every test run.

---

## Contents

- [What it is](#what-it-is)
- [Quick start](#quick-start)
- [What makes it different](#what-makes-it-different)
- [Two ways in](#two-ways-in)
- [The network builder](#the-network-builder)
- [Zero dependencies, and we prove it](#zero-dependencies-and-we-prove-it)
- [What we wrote instead of installing](#what-we-wrote-instead-of-installing)
- [Our X.509 parser, checked against node's](#our-x509-parser-checked-against-nodes)
- [Architecture](#architecture)
- [Command reference](#command-reference)
- [Project layout](#project-layout)
- [Requirements](#requirements)
- [Development](#development)
- [Deployment](#deployment)
- [Honest limitations](#honest-limitations)
- [Size](#size)
- [Documentation](#documentation)
- [Licence](#licence)

---

## What it is

Networking is taught from diagrams. Packets are real, but almost nobody ever
sees one — and libraries like `fetch()` collapse DNS, TCP, TLS and HTTP into a
single line that hides all of it.

netlens is a course where every lesson runs on a packet that just left your
machine. You type a command, watch the bytes fly, open them, change one, and
send it again. The internet answers differently.

> Change byte 27 from `01` to `1c` and press re-send.
> `QTYPE` was `A`. Now it is `AAAA`, and an IPv6 address comes back.
> Nothing about that is simulated, which is why it cannot be faked.

---

## Quick start

```bash
git clone <this repo> && cd netlens
node run.js
```

There is no `npm install`, because there is nothing to install. The page opens
at `http://127.0.0.1:7777`.

Then, in the terminal at the bottom of the page:

```
ifconfig                              your real address, subnet, gateway, MAC
arp                                   the other devices on your network
dig facebook.com                      a real DNS packet leaves your machine
dig facebook.com AAAA                 IPv6 — look closely at the address
tracert 1.1.1.1                       every router in between, live
tls medium.com --sni discord.com      one IP, someone else's certificate
journey https://example.com           all four protocols, in order
```

Press `3` to open the inspector, click any field, and type over a byte.

| Key | Does |
|:--:|---|
| `1` `2` `3` | switch depth: story → do it → real bytes |
| `[` `]` | previous / next chapter |
| `L` | show or hide the lesson |
| `M` | show or hide the chapter rail |
| `↑` `↓` | command history |
| `Tab` | completion |
| `Ctrl+L` | clear the screen |

---

## What makes it different

**Everything is real.** Six of the eight chapters run on live network traffic —
your own ARP table, a DNS query built byte by byte, real traceroute hops, a
certificate parsed out of raw DER. Where something is simulated, the interface
says `SIM`.

**You can break it.** The outgoing packet is editable. Corrupt the DNS
transaction id and watch the reply get rejected — that mismatch is exactly what
stops a forged DNS answer, and reading it in a book is not the same as doing it.

**Four zoom levels, one source of truth.** Every field the codec parses carries
the byte range it came from, so the field tree, the hex grid and the bit ruler
all describe the same thing and stay in sync in both directions.

```
TIMELINE  →  PACKET  →  HEADER FIELDS  →  BITS
```

**Depth is a choice, not a wall.** A beginner reads the story and runs a
command. A student presses `3` and reads the bytes. Same chapter, same data.

**Layers come last.** Every course opens with the seven-layer OSI model — seven
abstract names for things you have never met, which is exactly where beginners
quit. Here they arrive in Chapter 8, after you already know every piece, as the
reveal that they were layers all along.

**It teaches in two languages.** Every narration line ships in English and
Hinglish (`lang hi`), because the students who most need this course are often
not reading in their first language.

**It answers questions.** The "not making sense?" box resolves 88 networking
terms from a built-in glossary, entirely on your machine. Setting `GROQ_API_KEY`
adds a model for the questions the glossary cannot cover, and answers from it
are labelled as such. Without a key the box still works, and that is not a
degraded mode.

---

## Two ways in

The same material, indexed two ways. Switch with the tabs at the top of the rail.

### JOURNEY — eight chapters, in order

| # | Chapter | Data | What you do |
|:--:|---|:--:|---|
| 01 | `YOUR_OWN_NETWORK` | REAL | See your address, subnet, gateway, and the neighbours your machine has met |
| 02 | `NAMES_TO_NUMBERS` | REAL | Send a DNS query, then edit it and send it again |
| 03 | `FINDING_THE_PATH` | REAL | Watch every router appear, including the ones that refuse to answer |
| 04 | `RELIABLE_OR_FAST` | SIM | Drop packets on a live ARQ timeline and see what TCP does that UDP will not |
| 05 | `THE_LOCK` | REAL | Build a ClientHello by hand; read a certificate out of raw DER |
| 06 | `ASKING_FOR_A_PAGE` | REAL | Discover the request is a few lines of ASCII |
| 07 | `THE_FULL_JOURNEY` | REAL | One URL, four protocols, and where the time actually goes |
| 08 | `IT_WAS_LAYERS` | SIM | Assemble the stack you have been using for seven chapters |

Six interactive labs back the chapters that cannot run on a socket: a bit ruler,
an ARQ timeline, an addressing calculator, a topology sandbox, a TCP/UDP
comparison, and the layer assembler. Open one with `lab`.

### TOPICS — the syllabus, 36 topics across 7 modules

Basics, physical, data link, network, transport, session and application — the
shape of a university networking course, each topic linked to the chapter and
the packet that demonstrates it.

---

## The network builder

`http://127.0.0.1:7777/builder` — also linked from the foot of the chapter rail.

A sandbox for the one part of networking a real socket cannot show you:
topology. Drag devices onto a grid, wire them together, and send a packet
through the network you built.

- **25 devices** — PCs, laptops, servers, printers, IP phones, tablets, phones
  and smart TVs; 2/4/8-port routers and an L3 switch; 8- and 24-port switches, a
  bridge, a hub, a repeater and a splitter; access points, a home router, a
  firewall, a VPN gateway, modems, and the internet cloud.
- **6 media types** — straight-through, crossover, fibre, coax, serial and
  wireless, each carrying the rules about what it may legally connect.
- **A console on every device** — select one and run `ping` or `dig` from *its*
  point of view, subject to *its* address, mask and gateway.
- **A packet trace** — fire a PDU and watch it hop through the topology, with
  the reason it was forwarded, flooded or dropped at each device.
- **6 guided labs** — from "two machines and one wire" through subnet masks, why
  a third machine changes everything, leaving your own subnet, the moment the
  simulation stops, and a broken network you have to fix.

The builder is a simulation and says so on screen. Its job is to let you make
the mistakes — a mask one bit wrong, a crossover cable where a straight-through
belongs — that a real network punishes silently.

---

## Zero dependencies, and we prove it

```
$ node verify-zero-dep.js

  ┌─ ZERO DEPENDENCY VERIFICATION ─────────────────────────┐

    files scanned.........  178
    imports found.........  371
      ├─ relative.........  255  OK
      ├─ node: builtins...  116  OK
      └─ third-party......  000  OK

    node: modules used
      assert        child_process crypto        dgram         dns           fs
      http          https         net           os            path          test
      tls           url           util          zlib

    package.json  dependencies........ {}         OK
    package.json  devDependencies..... {}         OK
    package-lock.json................. absent     OK
    node_modules/..................... absent     OK

  └────────────────────────────────────────────────────────┘

  🏆 ZERO DEPENDENCY VERIFIED
```

The verifier was the first file written, before any product code, and it runs on
every `npm test`. It reads every `import` and `require` in `src/`, `web/`,
`test/`, `tools/` and the root scripts, and it also scans HTML and CSS for CDN
links and remote fonts, because those are runtime dependencies too.

**Turn off your Wi-Fi and run `npm test`.** All 430 pass. Every test runs against
real packets captured to `test/fixtures/` — 48 of them, including OS-tool output
from Windows, macOS and Linux — never a live network.

See [DEPENDENCY-PROOF.md](DEPENDENCY-PROOF.md) for five independent checks you
can run yourself, and [STDLIB.md](STDLIB.md) for what we built instead.

---

## What we wrote instead of installing

| Instead of | We wrote | Where |
|---|---|---|
| `dns-packet`, `dns2`, node's `dns` | A DNS wire codec, including name compression | [`src/proto/dns.js`](src/proto/dns.js) |
| `node-forge`, `asn1.js`, `x509`, `pem` | An ASN.1/DER parser and X.509 reader | [`src/proto/x509.js`](src/proto/x509.js) |
| `axios`, `node-fetch`, `got`, `http-parser-js` | An HTTP/1.1 codec with chunked decoding | [`src/proto/http.js`](src/proto/http.js) |
| `get-ssl-certificate`, `tls-parser` | A TLS record and handshake walker | [`src/proto/tls.js`](src/proto/tls.js) |
| `xterm.js` | A terminal emulator | [`web/js/term/terminal.js`](web/js/term/terminal.js) |
| `gsap`, `anime.js`, `framer-motion` | A tween engine | [`web/js/viz/anim.js`](web/js/viz/anim.js) |
| `d3`, `pixi.js`, `konva` | Canvas drawing | [`web/js/viz/draw.js`](web/js/viz/draw.js) |
| `react`, `redux`, `react-router` | A 60-line store, an `el()` helper, hash routing | [`web/js/state.js`](web/js/state.js) |
| `express`, `serve-static` | A route table and a static handler | [`src/server/`](src/server/) |
| `ws`, `socket.io` | Server-Sent Events, in forty lines | [`src/server/sse.js`](src/server/sse.js) |
| `traceroute`, `ping`, `default-gateway` | Output parsers for three platforms | [`src/sys/`](src/sys/) |
| `yargs`, `commander`, `dotenv`, `chalk` | `parseArgs`, `process.loadEnvFile`, raw ANSI | [`run.js`](run.js) |
| `esbuild`, `webpack`, `rollup` | A bundler that inlines the app into one file | [`build.js`](build.js) |
| `jest`, `mocha`, `chai`, `supertest` | `node:test` and `node:assert` | [`test/`](test/) |
| `tailwindcss`, `bootstrap` | CSS custom properties and grid | [`web/css/`](web/css/) |

Around **30 packages**, together carrying several hundred million weekly
downloads. The point was never to avoid them — it was to do their job, because
doing their job is the lesson.

---

## Our X.509 parser, checked against node's

ASN.1 is a format with a great deal of room to be subtly wrong, so every field
our parser extracts is compared with `node:crypto`'s `X509Certificate` across
three real certificate chains and ten certificates:

```
cert 0:
  OK   subject CN  ours=github.com                    node=github.com
  OK   issuer CN   ours=Sectigo Public Server Auth…   node=Sectigo Public Server Auth…
  OK   notBefore   ours=2026-07-03                    node=2026-07-03
  OK   notAfter    ours=2026-09-30                    node=2026-09-30
  OK   serial      ours=72010e03f4a067fe4e7962664…    node=72010e03f4a067fe4e7962664…
  OK   SAN count   ours=2                             node=2
  OK   isCA        ours=false                         node=false
```

That comparison is a test, so "we wrote our own parser" is a claim with evidence
behind it. See [`test/tls.test.js`](test/tls.test.js).

---

## Architecture

```
BROWSER                          NODE (stdlib only)              THE INTERNET
─────────────────────────        ──────────────────────          ──────────────
terminal   ─── fetch ──────────▶ node:http
canvas     ◀── SSE ────────────  routes ──▶ proto/ ── dgram ───▶ 1.1.1.1:53
inspector                                        └── net/tls ──▶ example.com:443
builder                                   sys/  ── child_process ─▶ your OS
```

Every endpoint returns the same envelope — a list of timeline events and a list
of packets — so the canvas, the timeline and the inspector are written once and
every chapter reuses them. Adding a protocol means adding a codec, not a view.

The codecs are pure: bytes in, structure out, no sockets. That is what lets the
whole suite run offline, and it is also what makes the byte editor work, since
re-parsing edited bytes is just calling the decoder again.

| Endpoint | Chapter | Does |
|---|:--:|---|
| `GET /api/health` | — | version, platform, route table, whether the doubt box has a key |
| `POST /api/dns` | 2 | build a query, send it over UDP, parse the answer |
| `POST /api/decode` | 2 | re-parse edited bytes without transmitting them |
| `POST /api/sys` | 1, 3 | run an OS network tool and parse its output |
| `GET /api/trace/stream` | 3 | traceroute hops, streamed over SSE as they are discovered |
| `POST /api/tls` | 5 | a hand-built ClientHello on a bare socket, and the certificate |
| `POST /api/http` | 6 | our own request bytes, our own response parser |
| `POST /api/journey` | 7 | all of the above, chained against one URL |
| `POST /api/ask` | — | the doubt box: glossary first, a model only if one is configured |

Full detail in [`docs/01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md).

---

## Command reference

```
help                    what you can run
doctor                  what this machine actually permits

ifconfig                your interface, address, subnet, gateway, MAC
arp                     the devices your machine has spoken to
route                   your routing table
netstat                 connections open right now
ping <host>             reachable? and how far away?

dig <domain> [type]     a real DNS query      dig @8.8.8.8 example.com MX
resolvers [domain]      compare three public resolvers
tracert <host>          every router, live    (traceroute also works)

tls <host>              handshake and certificate
tls <host> --no-sni     watch a server refuse
tls <host> --sni <name> one IP, another site's certificate

curl <url>              fetch with a request we wrote
journey <url>           all four protocols, in order

lab [name]              open an interactive lab
tour                    replay the guided tour
replay [speed]          watch the last exchange again, slower
lang [en|hi]            narration language
clear                   clear the screen
```

`doctor` is the first thing to run when something does not work: it reports
which of UDP 53, TCP 443, ICMP and the OS tools this machine and this network
actually permit.

---

## Project layout

```
run.js                  the one command — dev server, port retry, browser open
build.js                bundles everything into dist/netlens.js
verify-zero-dep.js      the dependency proof
vercel.json, api/       the deploy target: static web/ plus one function

src/
  server/               node:http, a route table, a static handler, SSE
  api/                  one handler per endpoint
  proto/                the codecs: dns, http, tls, x509 — pure, no sockets
  sys/                  OS network tools, and parsers for three platforms
  shared/               byte helpers, explanations, narration

web/
  index.html            the course
  builder.html          the network builder
  js/term/              terminal emulator, command table, completion
  js/viz/               canvas, tween engine, scene layout
  js/inspect/           field tree, hex grid, bit ruler, byte editor
  js/lesson/            8 chapters, 36 topics, 88-term glossary
  js/sim/               the six interactive labs
  js/builder/           devices, cables, forwarding simulation, guided labs
  css/                  theme tokens and layout

test/                   21 files, 430 tests, 48 captured fixtures
tools/preflight/        network capability check
docs/                   architecture and design notes
```

---

## Requirements

Node **20 or newer**. Nothing else.

Works on Windows, macOS and Linux — the OS-tool parsers cover all three and are
tested against captured output from each.

Optional: copy [`.env.example`](.env.example) to `.env` and set `GROQ_API_KEY` to
extend the doubt box beyond the built-in glossary. Everything works without it.

---

## Development

```bash
node run.js                # start (add --port 7900 if 7777 is taken)
node --test                # 430 tests, all offline
node verify-zero-dep.js    # prove the dependency claim
npm test                   # both of the above
```

| Script | Does |
|---|---|
| `npm start` | run the app |
| `npm run dev` | run in watch-friendly dev mode |
| `npm test` | verify zero dependencies, then run all 430 tests |
| `npm run verify` | the dependency proof on its own |
| `npm run build` | inline the whole app into `dist/netlens.js` |
| `npm run build:check` | rebuild and assert the bundle hash has not moved |
| `npm run preflight` | check what UDP, TCP, ICMP and OS tools this network permits |

`npm run build` produces a single ~920 KB file with all 27 modules and 75 web
assets inlined. `node dist/netlens.js` is then the entire application, with
nothing beside it.

New to the code? [`TUTORIAL.md`](TUTORIAL.md) explains how to operate it, and
[`docs/`](docs/) explains why it is built the way it is.

---

## Deployment

The app is a Node server, not a static site, so a deploy needs both halves:
`web/` goes to the CDN and one serverless function runs the router.
[`vercel.json`](vercel.json) and [`api/index.js`](api/index.js) do exactly that
and nothing more — the function borrows the request listener `createApp()`
already builds, so routes are declared in one place and adding an endpoint to
`src/server/server.js` lights it up locally and deployed.

```bash
vercel deploy
```

Set `GROQ_API_KEY` in the project's environment variables if you want the doubt
box to answer beyond the built-in glossary.

**One capability does not survive the move.** A serverless container ships
neither `ping` nor `traceroute`, and has no way to run one, so the ICMP parts of
Chapters 1 and 3 report the tool as unavailable there. Everything that speaks a
protocol from a socket — DNS, TLS, HTTP, the full journey, the builder — runs
exactly as it does locally. For the complete experience, including ICMP, run it
on a real machine or a container host.

---

## Honest limitations

We would rather say these plainly than have you discover them.

1. **Raw TCP headers are not visible.** Node's standard library hands us a
   connected socket; the kernel performs the three-way handshake. We show what
   is genuinely observable — connect time, local and remote ports — and nothing
   we cannot see.

2. **`ping` and `traceroute` run the OS's own tools** through
   `node:child_process`, which is standard library. There are no raw sockets in
   Node, so ICMP is otherwise unreachable from JavaScript. We parse the output
   ourselves; no npm wrapper is involved.

3. **We negotiate TLS 1.2 on purpose.** In TLS 1.3 the certificate is encrypted
   and a reader sees nothing. Offering 1.2 is what makes it readable, and
   Chapter 5 says so on screen rather than quietly benefiting from it.

4. **We read certificates; we do not verify them.** Checking a signature needs
   the full trust store, which is a different subject. The parser reports
   `verified: false` rather than implying otherwise.

5. **`node:tls` carries the encrypted transfer** in Chapter 6. Chapter 5 builds
   a ClientHello by hand to show what a handshake contains; completing one means
   implementing the key schedule, which teaches nothing here. Everything above
   the encryption is ours.

6. **Chapters 4 and 8, and the builder, are simulations** and are labelled `SIM`
   on screen. Packet loss, the layer stack and a topology you own cannot be
   produced on demand from a real socket. Every other chapter is marked `REAL`
   and means it.

---

## Size

```
web/js/      14,788 lines    66 files    terminal, canvas, inspector, lessons, builder
src/          4,702 lines    27 files    server, codecs, OS parsers
test/         4,317 lines    21 files    430 tests, 48 fixtures
web/css/      3,013 lines     7 files    theme and layout
root scripts    586 lines     3 files    run, build, verify
tools/          422 lines     4 files    preflight network check
web/*.html      260 lines     2 files    the course, and the builder
──────────────────────────────────────
             ~28,000 lines of hand-written code
                   0 dependencies
```

---

## Documentation

| File | What it covers |
|---|---|
| [TUTORIAL.md](TUTORIAL.md) | How to operate the app, command by command |
| [STDLIB.md](STDLIB.md) | Every standard-library API used, and what it replaced |
| [DEPENDENCY-PROOF.md](DEPENDENCY-PROOF.md) | Five independent checks of the zero-dependency claim |
| [docs/](docs/) | Architecture, file structure, chapter design, project state |

---

## Licence

MIT.
