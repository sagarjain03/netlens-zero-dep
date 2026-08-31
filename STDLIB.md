# STDLIB.md — what we used instead of npm

Every import in this repository is one of three things: a `node:*` builtin, a
browser global, or a relative path to a file we wrote. There is no fourth
category, and [`verify-zero-dep.js`](verify-zero-dep.js) fails the build if one
appears.

This is a log rather than a list. For each module: what it replaced, what turned
out to be interesting about it, and what bit us.

---

## `node:dgram` — Chapter 2, DNS

**Replaced:** `dns-packet` (20M/wk) · `dns2` · `native-dns` · Node's own `dns`

**Why it mattered:** `socket.send(buffer, port, host)` transmits *exactly* the
bytes you hand it. That single property is the difference between a byte editor
that is real and one that is theatre — the learner's edited buffer goes on the
wire untouched, and the answer that comes back is the internet's answer to
*their* packet.

**What bit us:** DNS name compression. A byte pair whose top two bits are set
(`0xC0`) is a pointer to an earlier offset in the same message. It is not
optional and not rare: every real response with records uses it, so a parser
that ignores it fails on essentially everything. Following pointers also needs a
visited-offset set, because a malicious packet can point at itself and hang the
parser.

**Also surprising:** a name on the wire is not a dotted string. `github.com`
travels as `06 g i t h u b 03 c o m 00` — length-prefixed labels, terminated by
a zero byte.

**Lines:** ~220 in `proto/dns.js`, ~120 in `proto/dns-client.js`

---

## `node:net` — Chapter 5, the TLS handshake

**Replaced:** `get-ssl-certificate` · `tls-parser` · `sslcert`

**Why it mattered:** a bare TCP socket lets us write our own ClientHello. That
is what makes Chapter 5 possible at all: the handshake is not something the
library does for you, it is 132 bytes you can read.

**The decision that shaped everything:** we offer TLS **1.2**, not 1.3. In 1.3
the Certificate message is encrypted and a reader sees nothing. In 1.2 it
arrives in the clear. That is not a shortcut — it is the lesson, and the
interface says so: *you can read this certificate because you asked for older
crypto, and hiding it is exactly what 1.3 changed.*

**What bit us:** a minimal ClientHello is refused. Servers want
`signature_algorithms`, `supported_groups` and `ec_point_formats` before they
will answer at all; without them you get a fatal alert and no explanation.

**Lines:** ~330 in `proto/tls.js`, ~110 in `proto/tls-probe.js`

---

## `node:crypto` — Chapter 5, as a witness

**Replaced:** nothing. Used to check our own work.

**Why it mattered:** ASN.1 has a great deal of room to be subtly wrong. Rather
than assert that our DER parser is correct, every field it extracts is compared
against `crypto.X509Certificate` across three real chains and ten certificates.
The comparison is a test, so the claim has evidence.

`X509Certificate` is standard library and underrated — it was also the planned
fallback if the hand-written parser failed. It did not.

Also used for the build hash and for random ids.

---

## `node:tls` — Chapter 6, the encrypted transfer

**Replaced:** the transport half of `axios` and `node-fetch`

**Why it mattered:** completing a handshake means implementing the key schedule,
transcript hashing and AEAD, none of which teaches anything here. `node:tls`
carries the encryption; everything above it — the request line, the headers, the
chunked body — is ours. The README says this plainly rather than implying we
built more than we did.

`servername` is worth noticing: the certificate is checked against the *name*,
not the address dialled, which is the same distinction Chapter 5 is about.

---

## `node:http` — the server, and Server-Sent Events

**Replaced:** `express` (40M/wk) · `serve-static` · `ws` (60M/wk) · `socket.io`

**Why it mattered:** a route table is a `Map` and a static handler is a MIME
lookup plus a read. Neither needed a framework.

SSE turned out to be forty lines: set `Content-Type: text/event-stream`, then
write `data: <json>\n\n` down the open response. WebSockets would have needed a
library on both ends; `EventSource` is already in every browser, so neither end
needed one.

**What bit us:** proxies buffer. `X-Accel-Buffering: no` and an immediate
comment line are what make the browser fire `open` at once instead of waiting.

**Where it earns its place:** only traceroute. A DNS lookup finishes in 13 ms
and can simply return JSON. A traceroute takes half a minute, and showing
nothing for that long is the difference between watching a path being discovered
and staring at a blank screen.

---

## `node:child_process` — Chapters 1 and 3

**Replaced:** `ping` · `traceroute` · `nodejs-traceroute` · `default-gateway`
(8M/wk) · `netroute`

**Why it mattered:** Node has no raw sockets, so ICMP is unreachable from
JavaScript. The operating system already ships tools that can do it. We run
those and parse the output ourselves — no npm wrapper is involved, and the
README states it.

**Security, because this is the one place user input becomes a process:**
`execFile`, never `exec`, so there is no shell and no shell injection. The
binary comes from a fixed table; a caller names an operation, never a program.
The only user value reaching argv is a host, and it must match an anchored
pattern and may not begin with `-`, so it cannot arrive disguised as a flag.
Counts are clamped. Nine injection-shaped inputs are refused in the tests.

**What bit us:** macOS prints MAC addresses without leading zeros —
`aa:bb:cc:0:11:22` where Windows prints `aa-bb-cc-00-11-22`. The same router was
being counted as two different devices. Found by a cross-platform fixture, not
on stage.

**Also:** Windows prints traceroute timings first and the address last; Unix
does the opposite. Both orders are parsed and both are in fixtures.

---

## `node:zlib` — Chapter 6

**Replaced:** the decompression half of every HTTP client

**Why it mattered:** we ask for `Accept-Encoding: identity` so the body stays
readable, but servers ignore that, so `gunzipSync` / `inflateSync` /
`brotliDecompressSync` are there as a fallback. Kept out of `proto/http.js` on
purpose: that file is pure, and staying pure is what lets it be tested against
captured bytes with no I/O at all.

---

## `node:test` + `node:assert` — 246 tests

**Replaced:** `jest` · `mocha` · `chai` · `supertest` (60M/wk combined)

**Why it mattered:** zero test dependencies, not even development ones. `--test`
discovers files, `describe`/`test` are built in, and `assert/strict` is enough.
Nothing to install means nothing to keep updated.

**What bit us:** `node --test test/` treats the path oddly on Windows. Bare
`node --test` and letting it discover is what works everywhere.

---

## `node:util` — the CLI

**Replaced:** `yargs` · `commander` · `dotenv` (40M/wk)

`parseArgs` handles `--port 7900` and `--no-open` in one call. Three packages
gone for four lines.

---

## `node:fs` · `node:path` · `node:url` · `node:os` · `node:buffer`

The ordinary ones, but two things are worth recording.

`Buffer.readUInt16BE` and `writeUInt16BE` are essentially the entire DNS parser.
Every protocol here is big-endian integers and length-prefixed blobs, and the
Buffer API covers both directly.

`import.meta.url` with `fileURLToPath` gives module-relative paths without
`__dirname`, which does not exist in ESM. Every fixture path in the tests is
built this way.

---

## Browser globals

| Used | Instead of | Note |
|---|---|---|
| `Canvas2D` | `d3`, `pixi.js`, `konva` | Every visual is `fillRect`, `stroke` and `fillText` |
| `requestAnimationFrame` | `gsap`, `anime.js`, `framer-motion` | One loop drives everything; it parks itself when nothing moves |
| `fetch` | `axios` | — |
| `EventSource` | `socket.io-client`, `eventsource` | Native, which is why SSE beat WebSockets |
| `URL` | `url-parse`, `query-string` | Parses and validates in one step |
| `ResizeObserver` | `react-resize-detector` | The canvas re-lays-out from one observer |
| `localStorage` | `store`, `localforage` | Theme, history, terminal height |
| `PointerEvent` | `interact.js` | The resize handle |
| System font stacks | Google Fonts | A font `<link>` is a runtime dependency, and the verifier rejects it |

**What bit us:** `classList.add` throws on a token containing a space. Our `el()`
helper passed one through, the exception blanked an entire panel, and no error
appeared anywhere near the cause. `el()` now splits on whitespace, and a test
scans every call site for the old form.

---

## What we deliberately did not do

**We did not vendor anything.** No copied source, no bundled minified file. If
it is in this repository, it was written for this repository.

**We did not reimplement TLS.** Chapter 5 builds a ClientHello and reads the
reply. Completing a handshake is a different project and teaches nothing here.

**We did not write an ASN.1 library.** `x509.js` reads what a certificate
chapter needs — subject, issuer, validity, serial, SANs, key algorithm,
basicConstraints — and stops. It is a parser for one job, not a general one.

**We did not verify signatures.** That needs the full trust store. The parser
reports `verified: false` rather than implying otherwise.

---

## The count

```
15 node: builtins       assert  child_process  crypto  dgram  dns  fs  http
                        net  os  path  test  tls  url  util  zlib

 9 browser globals      Canvas2D  requestAnimationFrame  fetch  EventSource
                        URL  ResizeObserver  localStorage  PointerEvent  DOM

~25 packages replaced   several hundred million weekly downloads

 0 dependencies
```

The point was never to avoid the packages. It was to do their job — because
doing their job is what the course is about.
