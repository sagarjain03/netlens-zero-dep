# netlens

**Learn computer networking with real packets you can open, edit, break, and re-send.**

Zero dependencies. Not one npm package, at runtime or in development.

```bash
node run.js
```

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

## Try it in ninety seconds

```bash
node run.js          # opens http://127.0.0.1:7777
```

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

---

## The chapters

| # | Chapter | Data | What you do |
|:--:|---|:--:|---|
| 01 | `YOUR_OWN_NETWORK` | REAL | See your address, subnet, gateway, and the neighbours your machine has met |
| 02 | `NAMES_TO_NUMBERS` | REAL | Send a DNS query, then edit it and send it again |
| 03 | `FINDING_THE_PATH` | REAL | Watch every router appear, including the ones that refuse to answer |
| 04 | `RELIABLE_OR_FAST` | SIM | *not yet built* |
| 05 | `THE_LOCK` | REAL | Build a ClientHello by hand; read a certificate out of raw DER |
| 06 | `ASKING_FOR_A_PAGE` | REAL | Discover the request is a few lines of ASCII |
| 07 | `THE_FULL_JOURNEY` | REAL | One URL, four protocols, and where the time actually goes |
| 08 | `IT_WAS_LAYERS` | SIM | *not yet built* |

---

## Zero dependencies, and we prove it

```
$ node verify-zero-dep.js

  ┌─ ZERO DEPENDENCY VERIFICATION ─────────────────────────┐

    files scanned..........  113
    imports found..........  201
      ├─ relative..........  119  OK
      ├─ node: builtins....   82  OK
      └─ third-party.......  000  OK

    node: modules used
      assert  child_process  crypto  dgram  dns  fs  http
      net  os  path  test  tls  url  util  zlib

    package.json  dependencies........ {}         OK
    package.json  devDependencies..... {}         OK
    node_modules/..................... absent     OK

  └────────────────────────────────────────────────────────┘

  🏆 ZERO DEPENDENCY VERIFIED
```

The verifier was the first file written, before any product code, and it runs on
every `npm test`. It reads every `import` and `require` in `src/`, `web/`,
`test/` and the root scripts, and it also scans HTML and CSS for CDN links and
remote fonts, because those are runtime dependencies too.

**Turn off your Wi-Fi and run `npm test`.** All 246 pass. Every test runs against
real packets captured to `test/fixtures/`, not a live network.

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
| `jest`, `mocha`, `chai` | `node:test` and `node:assert` | [`test/`](test/) |
| `tailwindcss`, `bootstrap` | CSS custom properties and grid | [`web/css/`](web/css/) |

Around **25 packages**, together carrying several hundred million weekly
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
                                          sys/  ── child_process ─▶ your OS
```

Every endpoint returns the same envelope — a list of timeline events and a list
of packets — so the canvas, the timeline and the inspector are written once and
every chapter reuses them. Adding a protocol means adding a codec, not a view.

The codecs are pure: bytes in, structure out, no sockets. That is what lets the
whole suite run offline, and it is also what makes the byte editor work, since
re-parsing edited bytes is just calling the decoder again.

Full detail in [`docs/01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md).

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

6. **Chapters 4 and 8 are not built yet.** The interface lists them; selecting
   one shows no lesson.

---

## Deploying it (Vercel)

The app is a Node server, not a static site, so a deploy needs both halves:
`web/` goes to the CDN and one serverless function runs the router. `vercel.json`
and `api/index.js` do exactly that and nothing more — the function borrows the
request listener `createApp()` already builds, so routes are declared in one
place and adding an endpoint to `src/server/server.js` lights it up in both.

    vercel deploy

Set `GROQ_API_KEY` in the project's environment variables if you want the doubt
box to answer beyond the built-in glossary; without it the box still works.

Two chapters lose a feature there, for a reason worth knowing: a serverless
container has no `ping` and no `traceroute` binary, and no way to run one. The
ICMP parts of Chapters 1 and 3 report the tool as unavailable. Everything that
speaks a protocol from a socket — DNS, TLS, HTTP, the full journey — runs on
Vercel exactly as it runs locally. `node run.js` on a real machine remains the
complete experience.

---

## Requirements

Node **20 or newer**. Nothing else. No install step, because there is nothing to
install.

Works on Windows, macOS and Linux — the OS-tool parsers cover all three and are
tested against captured output from each.

---

## Commands

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
tracert <host>          every router, live

tls <host>              handshake and certificate
tls <host> --no-sni     watch a server refuse
tls <host> --sni <name> one IP, another site's certificate

curl <url>              fetch with a request we wrote
journey <url>           all four protocols, in order

replay [speed]          watch the last exchange again, slower
lang [en|hi]            narration language
clear                   clear the screen
```

`↑`/`↓` history · `Tab` completion · `Ctrl+L` clear · drag the bar above the
terminal to resize it.

---

## Development

```bash
node run.js                # start (add --port 7900 if 7777 is taken)
node --test                # 246 tests, all offline
node verify-zero-dep.js    # prove the dependency claim
npm test                   # both of the above
```

New to the code? [`TUTORIAL.md`](TUTORIAL.md) explains how to operate it, and
[`docs/`](docs/) explains why it is built the way it is.

---

## Size

```
src/          4,509 lines    26 files    server, codecs, OS parsers
web/js/       3,246 lines    18 files    terminal, canvas, inspector
web/css/        861 lines                theme and layout
test/         2,334 lines    11 files    246 tests, 48 fixtures
─────────────────────────────────────
              ~9,000 lines of hand-written code
                   0 dependencies
```

---

## Licence

MIT.
