se# DEPENDENCY-PROOF.md

Five checks. Each one is a single command you can run yourself, and each catches
something the others would miss.

---

## 1. The manifest is empty

```bash
cat package.json
```

```jsonc
{
  "dependencies": {},
  "devDependencies": {}
}
```

Not "no dependencies in production" — no development ones either. There is no
bundler, no test runner, no linter, no type checker to install.

**What this alone does not prove:** a manifest says what you asked for, not what
the code imports. Hence checks 2 and 4.

---

## 2. There is no lockfile to install from, and no `node_modules`

```bash
ls package-lock.json     # No such file
ls node_modules          # No such file
node run.js              # starts anyway
```

There is nothing to install because there is nothing to install *from*. `npm i`
is not a step in these instructions; the app runs from a fresh clone.

---

## 3. Every import is verified, including in HTML and CSS

```bash
node verify-zero-dep.js
```

```
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

**This was the first file written**, before any product code, and it runs on
every `npm test`. Written on the last day it would find a violation there was no
time to fix; written first, it prevents one.

**What it refuses:**

| Rejected | Why |
|---|---|
| `import x from 'anything'` not starting `node:` or `./` | a third-party import |
| `require(someVariable)` | dynamic, so it cannot be verified — treated as a violation |
| `<script src="https://cdn…">` in HTML | a CDN script is a runtime dependency |
| `@import url(https://fonts.googleapis.com/…)` in CSS | so is a remote font |
| Any `//host` reference in markup | same |

The HTML and CSS scan matters. A project can have an empty `package.json` and
still pull React and a webfont off a CDN at runtime; this catches that.

**It also had to be honest about itself.** The verifier's own regex patterns
contain text that looks exactly like an import statement, and the first version
flagged its own source. It now strips comments and regex literals before
scanning, and anchors `import` to a statement position — otherwise the word
inside the string `'dynamic import'` matched too.

---

## 4. The tests pass with the network off

```bash
# disconnect Wi-Fi, then:
node --test
```

```
# tests 246
# suites 56
# pass 246
# fail 0
```

Every test runs against real packets captured to `test/fixtures/` — 48 files of
genuine DNS responses, TLS handshakes, certificate chains, HTTP replies and OS
tool output from three platforms. The network was used to *record* them, once.
It is never used to run them.

That makes the suite deterministic and fast, and it means the whole thing works
on a locked-down machine.

---

## 5. A fresh clone works

```bash
git clone <repo> /tmp/check && cd /tmp/check
node --test && node verify-zero-dep.js && node run.js
```

This is the check that caught a real bug.

`.gitattributes` normalises the repository to LF, which is correct for a
reproducible build hash and wrong for six files: HTTP/1.1 framing *is*
carriage-return-line-feed. The blank line ending the headers is `\r\n\r\n`, and
a chunk length is followed by `\r\n`. Stored as LF, those fixtures stop being
HTTP.

The failure mode was the nasty kind — the working tree that committed them still
had CRLF, so the tests kept passing locally while a fresh clone would fail all
35 HTTP tests. Exactly the bug that surfaces on someone else's machine and
nowhere else.

`test/fixtures/http-*.txt` is now marked `-text` so git stores those bytes
verbatim, and three tests assert the framing survives.

**Verified on an actual fresh clone:**

```
CR present in cloned fixture: YES

# tests 246
# pass 246
# fail 0

🏆 ZERO DEPENDENCY VERIFIED
```

---

## What the constraint actually cost

Not avoiding packages. Doing their work:

| Hard part | Where |
|---|---|
| DNS name compression, with pointer-loop protection | `src/proto/dns.js` |
| ASN.1/DER walking, and X.509 field extraction | `src/proto/x509.js` |
| TLS records holding several handshake messages | `src/proto/tls.js` |
| Chunked transfer decoding, and folded header lines | `src/proto/http.js` |
| A terminal: cursor, history, completion, scrollback | `web/js/term/terminal.js` |
| A tween engine with an externally supplied clock | `web/js/viz/anim.js` |
| Three platforms' worth of OS output parsing | `src/sys/` |

Each of those is why the corresponding package exists. Writing them is also why
the course has anything to show.

See [STDLIB.md](STDLIB.md) for the full log, including what bit us in each one.

---

## The one thing that talks to a third party

There is a single optional feature that reaches a service outside this
machine: the doubt box, in `src/api/ask.js`. Some clarity about it, since
"zero dependencies" and "calls an API" deserve to be separated:

- **It is not a dependency.** It installs nothing. It is `node:https` posting
  to an HTTPS endpoint — the same thing `curl` and `tls` in this app already
  do to `example.com` and `github.com`. `verify-zero-dep.js` covers the file
  like any other and the count is still zero.
- **It is off unless you turn it on.** With no `GROQ_API_KEY` in the
  environment — the default, and what a fresh clone gets — the endpoint
  answers `{ source: 'offline', reason: 'no-key' }` and the interface says so.
  Nothing about the app requires it.
- **The glossary answers first.** A question is matched against the 88-term
  glossary before anything leaves the machine, and most beginner questions
  stop there. The model handles the remainder.
- **A model's answer is labelled as one.** It renders under "from a model —
  worth checking", in a different colour from netlens's own explanations. It
  is never presented as something this project knows.
- **The key never reaches the browser.** The call is made server-side, which
  is the only reason it can be a key at all.

To turn it on:

```
GROQ_API_KEY=... node run.js
```

To confirm which state you are in, `GET /api/health` reports `ask: "ready"`
or `ask: "offline"`.
