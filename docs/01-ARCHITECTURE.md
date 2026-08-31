# 01 · Architecture

---

## 🏛️ 10,000-foot view

```mermaid
flowchart TB
    subgraph BROWSER["🌐 BROWSER — zero JS dependencies"]
        UI["index.html + CSS<br/>hand-written, no framework"]
        TERM["🖥️ Terminal Emulator<br/>(replaces xterm.js)"]
        VIZ["🎬 Canvas Visualizer<br/>(replaces d3 / pixi)"]
        INSP["🔬 Inspector<br/>tree + hex + byte editor"]
        LESSON["📖 Lesson Engine<br/>3 tiers, 8 chapter configs"]
        ANIM["⏱️ Tween Engine<br/>(replaces gsap / anime.js)"]
    end

    subgraph SERVER["⚙️ NODE 22 SERVER — stdlib only"]
        HTTP["node:http<br/>static + JSON API + SSE"]
        PROTO["📦 proto/<br/>dns · tls · x509 · http · hex"]
        SYS["🖧 sys/<br/>ping · trace · netinfo"]
        SIM["🎲 sim/<br/>loss · reorder (Ch 4)"]
        STORE["💾 store/<br/>progress JSON"]
    end

    subgraph OUTSIDE["🌍 THE REAL INTERNET"]
        DNS8["8.8.8.8 : 53"]
        WEB["example.com : 443"]
        OS["Your OS<br/>ping / tracert / route"]
    end

    TERM -->|"fetch POST /api/*"| HTTP
    LESSON --> TERM
    HTTP -->|"SSE /events"| VIZ
    HTTP --> PROTO
    HTTP --> SYS
    HTTP --> SIM
    HTTP --> STORE
    PROTO -->|"node:dgram UDP"| DNS8
    PROTO -->|"node:net / node:tls TCP"| WEB
    SYS -->|"node:child_process"| OS
    VIZ --> ANIM
    VIZ --> INSP

    style BROWSER fill:#0f172a,stroke:#38bdf8,color:#fff
    style SERVER fill:#1a1a2e,stroke:#a78bfa,color:#fff
    style OUTSIDE fill:#1c1917,stroke:#f59e0b,color:#fff
```

---

## 🔁 The core loop (memorise this)

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  1. User types  $ dig github.com                    [Terminal]        │
│                          │                                            │
│  2. POST /api/dns  {domain, type, rawOverride?}     [fetch]           │
│                          │                                            │
│  3. proto/dns.js  encode() → Uint8Array(28)         [pure function]   │
│                          │                                            │
│  4. dgram.send() ────────────────▶ 8.8.8.8:53       [REAL PACKET]     │
│     dgram.on('message') ◀────────                                     │
│                          │                                            │
│  5. proto/dns.js  decode(buf) → {header, question,  [pure function]   │
│                                  answers[], _spans} │                 │
│                          │                                            │
│  6. Response JSON:                                                    │
│     { events:[…timeline…], packets:[{dir,hex,tree,spans}] }           │
│                          │                                            │
│  7. Visualizer animates the packet flying 8.8.8.8   [Canvas]          │
│     Inspector fills with header tree + hex          [DOM]             │
│     Terminal prints dig-style output                [DOM]             │
│                          │                                            │
│  8. User presses [e] on a byte → edits → [re-send]                    │
│     → back to step 2 with rawOverride                                 │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**The magic is step 5's `_spans`.** Every decoded field carries `{offset, length, bitOffset?, bitLength?}`.
That single idea powers *all four zoom levels* with no extra work:

```
Field tree  ──click "QTYPE"──▶  span {offset:26, length:2}
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
       Hex view highlights      Bit view highlights       Canvas label
       bytes 26–27              bits 208–223              points at it
```

**One data structure → four synchronised views.** No duplication anywhere.

---

## 🧱 Layered module design

```mermaid
flowchart TD
    L4["🎨 LAYER 4 · PRESENTATION<br/>web/js/viz · web/js/inspect · web/js/term<br/><i>knows about pixels, never about sockets</i>"]
    L3["📖 LAYER 3 · LESSON<br/>web/js/lesson/*<br/><i>chapter configs = data, not code</i>"]
    L2["🔌 LAYER 2 · TRANSPORT<br/>src/server/*<br/><i>http routes, SSE, JSON contracts</i>"]
    L1["📦 LAYER 1 · PROTOCOL<br/>src/proto/* · src/sys/*<br/><i>real network I/O</i>"]
    L0["🧮 LAYER 0 · PURE CODECS<br/>encode() / decode() / parse()<br/><i>zero I/O · 100% unit-testable</i>"]

    L4 --> L3 --> L2 --> L1 --> L0

    style L0 fill:#14532d,stroke:#22c55e,color:#fff
    style L1 fill:#164e63,stroke:#22d3ee,color:#fff
    style L2 fill:#1e1b4b,stroke:#818cf8,color:#fff
    style L3 fill:#4c1d95,stroke:#a78bfa,color:#fff
    style L4 fill:#7c2d12,stroke:#fb923c,color:#fff
```

### 🔑 The single most important rule

> **Layer 0 does no I/O.**
> `dns.encode()` takes an object → returns bytes. `dns.decode()` takes bytes → returns an object.
> No sockets, no files, no `await`.

Why this matters for **Code Quality (25%)**:
- Every codec is unit-testable with **captured hex fixtures** — no network needed in CI
- Tests run in milliseconds, deterministically
- The byte editor works for free (it's just `decode(userEditedBytes)`)

---

## 🌐 API contract

All endpoints return the **same envelope**. One shape, one renderer.

```jsonc
// POST /api/dns   { "domain": "github.com", "type": "A" }
{
  "ok": true,
  "durationMs": 12.4,
  "events": [                              // → drives the TIMELINE + canvas
    { "t": 0.0,  "dir": "out", "from": "192.168.1.5", "to": "8.8.8.8:53",
      "proto": "UDP", "bytes": 28, "label": "DNS query",
      "narration": "Tumhare PC ko github.com ka IP nahi pata..." },
    { "t": 12.4, "dir": "in",  "from": "8.8.8.8:53", "to": "192.168.1.5",
      "proto": "UDP", "bytes": 44, "label": "DNS response",
      "narration": "Phonebook ne jawab bheja: 140.82.113.4" }
  ],
  "packets": [                             // → drives the INSPECTOR
    {
      "id": "p1",
      "hex": "1a2b010000010000000000000667697468756203636f6d0000010001",
      "tree": [                            // → drives the FIELD TREE
        { "name": "Header", "children": [
          { "name": "ID",      "value": "0x1a2b", "span": [0,2] },
          { "name": "QR",      "value": "0 (query)", "span": [2,1], "bits": [0,1] },
          { "name": "Opcode",  "value": "0 (QUERY)", "span": [2,1], "bits": [1,4] },
          { "name": "RD",      "value": "1", "span": [2,1], "bits": [7,1],
            "explain": "Recursion Desired — 'server, tum poora kaam karo, mujhe sirf answer do'" }
        ]},
        { "name": "Question", "children": [
          { "name": "QNAME",  "value": "github.com", "span": [12,16] },
          { "name": "QTYPE",  "value": "1 (A)",      "span": [28,2],
            "editHint": "0x001c kar do → IPv6 (AAAA) maangega" }
        ]}
      ]
    }
  ]
}
```

Every other endpoint (`/api/tls`, `/api/http`, `/api/ping`, `/api/trace`) returns **this exact shape**.
➡️ Write the renderer once. Ship 8 chapters.

---

## 📡 Endpoint map

| Method | Route | Module | Notes |
|---|---|---|---|
| `GET` | `/` , `/web/*` | `server/static.js` | Serves HTML/CSS/JS. In built mode, from memory. |
| `POST` | `/api/dns` | `proto/dns-client.js` | `rawOverride` field = the byte editor |
| `POST` | `/api/tls` | `proto/tls.js` | ClientHello probe + cert parse |
| `POST` | `/api/http` | `proto/http.js` | Handwritten request/response |
| `POST` | `/api/sys` | `sys/exec.js` | `{cmd:"ping"\|"trace"\|"route"\|"arp"\|"ifconfig"\|"netstat"}` |
| `GET` | `/events?id=` | `server/sse.js` | Live hop-by-hop stream for `traceroute` |
| `GET/POST` | `/api/progress` | `store/progress.js` | `node:fs` JSON, chapter completion |

**Security note (we build it in from hour 1):**
`sys/exec.js` uses `execFile` with a **fixed allowlist of binaries** and **regex-validated hostnames**.
No user string is ever concatenated into a shell command. This goes in the README — it's a Code Quality signal.

---

## 🎬 Why SSE (and only for traceroute)

```
dig / curl / tls      → fast (< 1s)  → plain JSON response, animate client-side  ✅ simple
traceroute            → 10–30s       → SSE stream, animate each hop as it lands  ✅ worth it
```

SSE in stdlib is ~30 lines:
```js
res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
res.write(`data: ${JSON.stringify(hop)}\n\n`)
```
**This replaces `socket.io` / `ws` / `eventsource`.** → Package Killer.

---

## 🎨 Client-side architecture

```mermaid
flowchart TD
    MAIN["main.js<br/>boot + wire everything"]
    RTR["router.js<br/>#/ch/2/tier/3 hash routing<br/><i>replaces react-router</i>"]
    STATE["state.js<br/>tiny pub/sub store<br/><i>replaces redux/zustand</i>"]

    MAIN --> RTR
    MAIN --> STATE
    STATE --> TERM["term/terminal.js<br/>+ commands.js registry"]
    STATE --> VIZ["viz/canvas.js<br/>scene.js · anim.js · layers.js"]
    STATE --> INSP["inspect/tree.js<br/>+ hex.js + editor.js"]
    STATE --> LES["lesson/engine.js<br/>+ chapters/ch01..ch08.js"]

    TERM -.->|"dispatch(result)"| STATE
    INSP -.->|"dispatch(hover span)"| STATE
    STATE -.->|"notify all views"| VIZ

    style STATE fill:#4c1d95,stroke:#a78bfa,color:#fff
    style MAIN fill:#1e3a5f,stroke:#38bdf8,color:#fff
```

**One store. Every view subscribes.** ~60 lines total:

```js
// state.js — the entire "framework"
const listeners = new Set()
let state = { chapter: 1, tier: 1, packets: [], selectedSpan: null, progress: {} }
export const get = () => state
export const set = (patch) => { state = { ...state, ...patch }; listeners.forEach(f => f(state)) }
export const sub = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
```

That's the whole state management layer. **React + Redux replaced in 6 lines.** Put this in `STDLIB.md`.

---

## ⏱️ The tween engine (`viz/anim.js`)

Replaces `gsap` / `anime.js` / `framer-motion`. ~80 lines.

```js
// requestAnimationFrame loop + easing functions
const easeOutCubic = t => 1 - Math.pow(1 - t, 3)

function tween({ from, to, ms, ease = easeOutCubic, onUpdate, onDone }) { /* rAF loop */ }
```

Packet animation = tween a dot along a path between two nodes. That's it.
**No physics engine. No particle library. Just `lerp` + `rAF`.**

---

## 🎯 Canvas scene model

```
scene = {
  nodes: [ {id:'you', x, y, label:'You (192.168.1.5)', icon:'device'},
           {id:'dns', x, y, label:'8.8.8.8', icon:'server'} ],
  links: [ {from:'you', to:'dns', state:'up'|'down'|'lossy'} ],
  packets:[ {id, from, to, progress:0..1, color, size, label} ]
}
```

Chapter 3 (routing) and Chapter 4 (TCP) reuse **the exact same scene model** with more nodes.
Chapter 8 (layers) uses a different renderer (`viz/layers.js`) but the same packet data.

> **Rule: ONE generic scene engine. Chapters are data (node/link lists), not new code.**
> The moment you write a second canvas renderer, you've lost 6 hours.

---

## 🔨 Build strategy (bonus: Single File + Reproducible)

```mermaid
flowchart LR
    SRC["src/**/*.js<br/>web/**/*<br/><i>modular, readable</i>"] -->|"node build.js"| BUNDLE["dist/netlens.js<br/><i>ONE file</i>"]
    BUNDLE -->|"node dist/netlens.js"| RUN["🚀 localhost:7777"]
    BUNDLE -->|"sha256"| HASH["BUILD-HASH.txt<br/><i>reproducible proof</i>"]

    style BUNDLE fill:#14532d,stroke:#22c55e,color:#fff
```

`build.js` (hand-written, ~120 lines, **replaces webpack/esbuild/rollup/vite**):
1. Topologically resolve relative `import`s in `src/`
2. Concatenate into one ESM file, rewriting imports to local scopes
3. Inline `web/index.html`, CSS and client JS as template-literal string constants
4. Emit `dist/netlens.js`
5. Print + write `sha256` → run twice, get the same hash → **Reproducible Build +5**

**Both entry points work:**
```bash
node run.js            # dev — reads from disk, edit + refresh
node dist/netlens.js    # single file — the bonus artifact
```

**Determinism checklist for reproducible builds:**
- ❌ no `Date.now()` in output · ❌ no random ids · ✅ sorted file traversal · ✅ `\n` line endings forced

---

## 🧪 Testing architecture

```
test/
├── fixtures/          real captured packets as .hex files ← the secret weapon
│   ├── dns-query-github.hex
│   ├── dns-resp-github.hex
│   ├── tls-serverhello.hex
│   └── ping-win.txt / ping-linux.txt / tracert-win.txt
├── dns.test.js        encode → hex matches fixture · decode(fixture) → expected object
├── tls.test.js        ClientHello bytes · ServerHello parse · X.509 fields
├── http.test.js       request build · chunked response parse · header folding
├── sysparse.test.js   ping/tracert/route parsers on BOTH win + linux fixtures
├── build.test.js      build twice → identical sha256 (reproducibility test!)
└── roundtrip.test.js  decode(encode(x)) === x  for every codec
```

Runner: `node --test` (stdlib, Node 18+). **No jest, no mocha, no chai.**

> **Fixture strategy:** on Day 1, run one real `dig`, dump the hex to `test/fixtures/`.
> From then on every test is offline, instant, and deterministic. No flaky network tests.

---

## 🗂️ Data flow for the Byte Editor (the demo climax)

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant H as Hex View
    participant S as State
    participant A as /api/dns
    participant N as 🌍 8.8.8.8

    U->>H: hovers byte 28, presses [e]
    H->>U: inline edit: 01 → 1c
    U->>H: presses [r] re-send
    H->>S: dispatch(rawOverride)
    S->>A: POST {rawOverride: "1a2b...001c0001"}
    A->>N: dgram.send(EXACT user bytes)
    N-->>A: real response
    A->>A: dns.decode(response)
    A-->>S: {events, packets}
    S-->>U: 🎉 canvas re-animates<br/>answer is now AAAA / IPv6
    Note over U,N: Nothing was simulated.<br/>The user changed one byte<br/>and the internet answered differently.
```

---

**➡️ Next:** [02-FILE-STRUCTURE.md](02-FILE-STRUCTURE.md)
