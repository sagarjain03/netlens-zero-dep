# 08 · Project State

**Living document. Update it at the end of every block.**
Docs 00–07 say what we planned. This one says where we actually are.

*Last updated: after Block 26 — the doubt box, working.*

---

## Where we are

```
Blocks done      1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26
Chapters live    01 02 03 04 05 06 07 08      (8 of 8; 4 and 8 run on labs)
Lessons          8 chapters x 3 tiers, EN + Hinglish, every step runnable
Labs             CRC, Hamming, bit stuffing, 2-D parity, sliding windows,
                 subnetting, the IPv4 header, topologies,
                 comparisons, encapsulation
Glossary         88 terms, auto-linked, nothing on screen unexplained
Syllabus         36 topics over 7 modules, all written
Tests            428, all offline, 102 suites
Dependencies     0, verified
Fresh clone      verified passing
```

| Block | What it delivered | Commit |
|:--:|---|---|
| 1 | Skeleton, `verify-zero-dep.js`, server, client "framework" | `777cd69` |
| 2 | DNS wire codec, dgram client, byte-editor API path | `107ffc6` |
| 3 | Terminal emulator, command registry, timeline | `1c35a62` |
| 4 | Canvas, tween engine, packet playback — **GATE 1** | `b18ff54` |
| 5 | Inspector: field tree, hex, bits, **byte editor** | `8ac0ddf` |
| 6 | OS tools, Chapter 1, `doctor` | `d182d8f` |
| 7 | Chapter 3, live traceroute over SSE | `a53c795` |
| — | Terminal-collapse fix (first-screen bug) | `027d47f` |
| 8 | TLS handshake, hand-written X.509 parser | `fe2b115` |
| — | Terminal-aesthetic restyle | `a5f58f4` |
| 9 | HTTP/1.1 codec, full journey (Ch 7) | `b8a525f` |
| — | CRLF fixture fix + fresh-clone proof | `212c2ec`, `8cf6d5a` |
| 10 | Lesson engine: chapter data files, the card over the canvas, EN/HI toggle | — |
| 11 | Hamburger rail, viewport-dragged card, honest step outcomes, glossary | — |
| 12 | Bit lab: CRC, Hamming, bit stuffing, 2-D parity — pure algorithms, 17 tests | — |
| 13 | Sliding-window lab: stop-and-wait, Go-Back-N, Selective Repeat, SVG ladder | — |
| 14 | Addressing lab: subnetting and the IPv4 header; a DOM stub so the labs are render-tested | — |
| 15 | Topology lab: bus, star, ring and mesh as real graphs — cut a cable, read the consequence | — |
| 16 | Comparison and encapsulation labs — the widget set is complete | — |
| 17 | TOPICS mode: syllabus rail, topic routes, lazy module loading, Data Link written | — |
| 18 | Application module written — six topics, all driven by live commands | — |
| 19 | Network module written — eight topics, each opening the lab that does its arithmetic | — |
| 20 | Transport and Session modules — eight topics; syllabus now 29 of 36 | — |
| 21 | Basics and Physical modules — the syllabus is complete at 36 of 36 | — |
| 22 | Challenge verifiers: four settled by the network, four left as questions | — |
| 23 | `build.js` — hand-written ESM bundler, single file, reproducible hash | — |
| 24 | Chapters 4 and 8 hand over to their labs; the optional doubt box | — |
| 25 | First-run tour over all 15 features; `.env` support | — |
| 26 | The doubt box against a live key — four bugs only a real call could show | — |

---

## Decisions that are settled — do not reopen

| Decision | Why |
|---|---|
| **Browser UI, not TUI** | A beginner does not open a terminal. TUI was chosen then reversed when the goal became "learning environment". |
| **Real over simulated** | 6 of 8 chapters run on live traffic. Anything simulated is labelled `SIM` in the interface. |
| **Zoom levels are difficulty levels** | One dataset, four depths. No separate beginner mode. |
| **OSI layers are Chapter 8, not Chapter 1** | Seven abstract names up front is where beginners quit. This inversion is the innovation angle. |
| **TLS 1.2, deliberately** | 1.3 encrypts the certificate. Offering 1.2 makes it readable, and the interface says why. |
| **`_spans` on every field** | One parse drives the field tree, hex grid and bit ruler. Retrofitting would mean rewriting every parser. |
| **Chapter files are data, never logic** | Otherwise eight chapters become eight divergent copies. Held: `web/js/lesson/chapters/*.js` are data, `lesson.js` is the only renderer. |
| **The tour drives the app, it does not describe it** | A step about the byte inspector switches to the depth where the inspector exists, so what is highlighted is genuinely on screen. Steps are data: `route` is a state patch applied before the step is shown. |
| **The glossary answers definitions, not everything** | It used to answer any question containing a known word, so "why is the AA bit zero here?" returned the definition of "bit". True, instant, and worse than the question deserved. Definition-shaped questions get the glossary; specific ones reach the model, which falls back to a definition if it cannot be reached. |
| **"What is this site?" is answered by netlens itself** | The most common first question, and no wording of the prompt fixed it: with a packet on screen the model read "this site" as the host being looked up. It is now a deterministic, offline answer. |
| **The doubt box asks the glossary first** | A question is matched against the 88 terms before anything leaves the machine, and most beginner questions stop there. With no key the box still works. A model’s answer is labelled as one, in a different colour, and is never presented as something netlens knows. |
| **The client is inlined, not bundled** | `createStaticHandler` already took an asset map, so the browser fetches the same module graph out of memory. No client bundler, and the topics’ dynamic `import()` keeps working unchanged. |
| **Only four challenges are checkable, and the card says which** | Four ask the learner to make the network do something and are settled by the envelope. Four ask for an explanation and carry no verifier — they read "answer this yourself" rather than ticking for having run a command. A mark earned without understanding is worth less than no mark. |
| **The Physical module measures time, not cables** | No process can see a voltage, so that module would have been prose. It measures the one mark the medium leaves everywhere — delay — and lets the numbers say what the medium is doing. |
| **A lesson may not predict what the network will do** | Two claims were written as predictions and both were wrong when run: differing resolver answers, and a longer non-CDN trace. Content states what to measure and what each outcome means. |
| **JOURNEY and TOPICS are separate, and cross-linked** | A story taken once and a reference entered anywhere are different jobs; merging them would kill the narrative arc. Each topic names the chapter where the thing is visible on a live packet. |
| **The rail lists the whole syllabus, including what is unwritten** | A rail that hid the gaps would misrepresent how far along this is. Unwritten topics are dimmed, still open, and land on a page that says so. `WRITTEN` is explicit and a test asserts it matches the files. |
| **A comparison earns its place by being runnable** | Every "X vs Y" table carries a command that demonstrates the difference and a situation to judge. A table alone is a thing a textbook already does better. |
| **Topology is a graph, not a table of adjectives** | Cable counts, reachability and single points of failure are computed from the graph. "Reliable" and "expensive" cannot be checked; `cableCount('mesh', 12) === 66` can. |
| **A render test must make the call the app makes** | The DOM stub catches throws and logic, and missed a crash on load because it passed arguments the command never sends. `sim-render.test.js` now dispatches every lab through the same shape main.js uses. |
| **Widgets are render-tested against a DOM stub** | `test/sim-render.test.js` brings forty lines of DOM rather than a headless browser, so "every mode builds a tree and clicking the thing changes the verdict" runs in the same offline suite. |
| **A simulated channel is a lookup, not a dice roll** | Loss is a pure function of (seed, frame, attempt), so "same losses, switch protocol" is true. A stream of random numbers consumed in order silently compared two different channels. |
| **Lab arithmetic lives outside the widget** | `web/js/sim/algo.js` is pure and unit-tested, so "CRC catches this and parity does not" is real detection rather than a scripted animation. |
| **A step is only done when a packet came back** | The first version ticked on click and showed green over a failed command. Envelope identity before/after is what decides it. |
| **Terms are linked by the glossary, never tagged by hand** | Eight chapters of hand-tagging drifts within a day. One TreeWalker pass, first occurrence only, never inside code or diagrams. |
| **Theory arrives in beats, not paragraphs** | The three-line law and "explain it properly" are not in conflict — a beat, an action, a beat. Tier 1 reveals one beat per click for exactly this reason. |
| **One envelope for every endpoint** | `{events, packets}`. The renderer is written once; a new chapter is a codec, not a view. |
| **Codecs are pure** | No sockets in `proto/*.js`. That is what makes the suite offline and the byte editor possible. |
| **`decode()` degrades, never throws** | The byte editor exists to produce malformed packets. |
| **Terminal never collapses** | It is the input device for the whole app. Learned the hard way — see below. |

### Dropped, and staying dropped

World/country/city map · bit-level electrical signals · a virtual network
builder · full TLS 1.3 handshake · libpcap packet sniffing · a TCP state machine
· accounts and cloud sync.

---

## Demo hosts — verified, not guessed

Each of these was chosen by running it, and the obvious choice was wrong twice.

| Experiment | Host | Why not the obvious one |
|---|---|---|
| DNS → IPv6 (`QTYPE` edit) | **`facebook.com`** | `github.com` publishes **no AAAA record**. Checked eight majors; it is the only one without. Facebook's address also contains `face:b00c`. |
| Transaction-id rejection | any | Needs `expectId` — editing the id alone cannot mismatch, since the server echoes what it receives. |
| SNI removal → refusal | **`medium.com`** | Cloudflare-fronted, returns a reliable `alert 2/40`. `github.com` has a dedicated IP, so nothing happens. |
| SNI swap → wrong certificate | **`medium.com` + `--sni discord.com`** | Verified: `CN=discord.com` comes back from Medium's server. |
| Journey cost breakdown | **`example.com`** | `github.com`'s 580 KB body makes Transfer 57% and buries the lesson. On `example.com`, TLS is 37% and setup is 74%. |

---

## Bugs that only appeared on real hardware

Every one of these was found by driving the actual UI or a fresh clone. None
would have been caught by unit tests alone.

1. **The terminal was collapsed on the default screen.** Tier 1 pinned it to
   46px, and tier 1 is the landing route — so the first thing anyone saw said
   "type a command below" above a sliver with nowhere to read the answer.

2. **`el()` threw on a space-separated class list.** `classList.add` rejects a
   token containing a space; the exception blanked the entire edit bar with no
   error near the cause.

3. **Hex digits collided with the tier shortcuts.** Typing `1c` into a byte
   navigated away mid-edit. Fixed with capture-phase priority, and only when a
   byte of an editable packet is selected.

4. **macOS drops leading zeros in MAC addresses.** The same router counted as
   two devices. Caught by a cross-platform fixture.

5. **The theme toggle announced the change before making it.** The canvas caches
   the palette it reads, so it stayed dark over a white page.

6. **Git stripped CR from the HTTP fixtures.** Tests passed locally and would
   have failed on any fresh clone. The `.gitattributes` LF rule is right for the
   build hash and wrong for six files.

7. **The SNI swap was compared against the wrong name.** Comparing to the
   requested name always matches — it has to be the host actually dialled.

13. **Three global shortcut handlers could be killed by one stray event.**
    Each began `if (e.target.matches(...))`, and a keydown whose target is
    `window` or `document` has no `matches`. The handler throws, and every
    shortcut it owns stops working for the rest of the session with the cause
    nowhere near the symptom. Now one guarded helper, `typingInto` in dom.js.

10. **`resolvers` always printed "same answer, different speeds".** It was
    written for chapter 2, where the point is timing, and hard-coded a
    conclusion instead of reading one. On a CDN-hosted name the answers often
    differ, and the summary said otherwise. It now compares what came back.

11. **`setResult` silently dropped `meta`.** The canvas, timeline and
    inspector only ever read `events` and `packets`, so the endpoint's own
    summary — record types, TLS name match, HTTP status — was thrown away at
    the door. Challenge verification read `undefined` and never fired, with no
    error anywhere. Found only by earning a challenge in the browser.

12. **The CDN topic promised a contrast that did not exist.** It claimed a
    non-CDN host would take more hops; measured from here, `example.com` took
    exactly as many, because it is anycast too. The topic now states the
    measurement and treats "they are the same" as the finding it actually is
    — almost everything popular sits behind a CDN now.

8. **The subnet bit ruler rendered vertically.** `el('span.addr__octet',
   bits.map(...))` spreads eight siblings, not one wrapper child, so the
   octet's `flex-direction: column` stacked the bits instead of the row of
   bits and its label. Every assertion about the ruler passed — there were
   32 bits with the right classes, in the wrong direction.

9. **`lab topology` threw on load, and the render tests could not see it.**
   main.js calls `load(kind, state.lab)` where `state.lab` is `{ kind }`, so
   the mode name "topology" was spread over the model's `kind` field, which
   held the shape. Every test passed an explicit valid shape and sailed past
   it. The field is now `shape`, and a suite dispatches every lab exactly the
   way the app does — the general lesson being that a test which calls the
   unit differently from production is testing a different program.

---

## What is left

| Work | Value | Effort |
|---|---|---|
| **Demo video** | Judged separately; H60 freeze applies | ~3 h |

Done: README, STDLIB.md, DEPENDENCY-PROOF.md, TUTORIAL.md.

---

## Repository map

```
run.js                  the one command
verify-zero-dep.js      the guardrail, written first
build.js                the single-file build; `npm run build`

src/server/             http, routes, static, sse
src/proto/              dns, tls, x509, http  ← pure codecs, no I/O
src/sys/                exec (allowlisted), netinfo, ping, trace
src/api/                one handler per endpoint, all returning the envelope
src/shared/             bytes (Reader/Writer), explain, narrate

web/js/state.js         60-line store
web/js/term/            terminal, commands, autocomplete, resize
web/js/viz/             canvas, anim, scene, draw
web/js/inspect/         tree, hex, bits, editor, timeline
web/js/lesson/          chapter data, the card, glossary, measured facts
web/js/sim/             algo.js (pure) + the labs that render it

test/fixtures/          48 captured files — DNS, TLS, HTTP, OS output ×3 platforms
tools/preflight/        the network capability probes
```

**To change teaching text:** `web/js/lesson/chapters/ch0N.js` (the lesson itself),
`src/shared/explain.js` (field meanings), `src/shared/narrate.js` (timeline narration).
**To add a command:** `web/js/term/commands.js`.
**To add a protocol:** a codec in `src/proto/`, a handler in `src/api/`. No view
changes — the envelope handles it.

---

## Working rules that have held up

- **Drive the real UI at the end of every block.** Seven of the bugs above came
  from that and nowhere else.
- **Capture a fixture the first time something works.** Then every test after it
  is offline and deterministic.
- **Write the honest limitation down** rather than hoping nobody asks.
- **`Ctrl+Shift+R`.** The browser caches ES modules aggressively; a normal
  refresh will show stale code and waste ten minutes.
