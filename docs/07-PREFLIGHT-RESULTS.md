# 07 · Pre-Flight Test Results ✅

> Run on the **actual build machine** before writing a single line of product code.
> Every network capability the project depends on has been verified for real.
>
> **Machine:** Windows 11 (10.0.26200) · Node v22.15.1 · IP `192.168.1.38`

---

## 🏆 Verdict: GREEN. Build with confidence.

```
  ✅ Ch1  LAN info (arp/ipconfig/route)  WORKS
  ✅ Ch2  DNS over raw UDP 53            WORKS   ← mission critical
  ✅ Ch3  traceroute + ICMP ping         WORKS
  ✅ Ch5  Raw TLS ClientHello + cert     WORKS   ← better than expected
  ✅ Ch6  TCP 443 / 80                   WORKS
```

**The firewall risk is closed.** No hotspot needed. No TCP-DNS fallback needed.

---

## 1️⃣ DNS over UDP 53 — Chapter 2 ✅

Hand-built DNS query packet, sent via `node:dgram`. **Three resolvers, all answered.**

| Resolver | Result | Latency |
|---|---|---|
| `8.8.8.8` Google | 44 B, 1 answer | **13.1 ms** |
| `1.1.1.1` Cloudflare | 44 B, 1 answer | **6.5 ms** ⚡ |
| `9.9.9.9` Quad9 | 44 B, 1 answer | 8.1 ms |

> 💡 **Decision: default resolver = `1.1.1.1`.** Half the latency of 8.8.8.8 on this
> connection — the demo animation will feel snappier. Keep `--resolver` as a flag so all
> three can be compared live (that's a nice Tier-3 exercise: *"why is one faster?"*).

**Chapter 2 is confirmed feasible. The entire project rests on this and it works.**

---

## 2️⃣ TCP — Chapters 4, 5, 6 ✅

| Target | Result |
|---|---|
| `1.1.1.1:443` | connected in **10.0 ms** — local port `62028` |
| `140.82.113.4:443` (github) | connected in 262.8 ms |
| `1.1.1.1:80` | connected in 6.6 ms |

> Note the local ephemeral port (`62028`, `62029`, `62030` — incrementing).
> **Free teaching moment for Ch 4:** *"Your OS picks a random high port for every
> connection. Watch it count up."* Add this to the Ch4 Tier-3 content.

---

## 3️⃣ Raw TLS ClientHello — Chapter 5 ✅ **BETTER THAN PLANNED**

We hand-built a 132-byte ClientHello (record header + version + random + cipher list +
SNI, supported_groups, ec_point_formats, signature_algorithms extensions) and wrote it
onto a bare `node:net` socket.

**github.com replied with 2935 bytes:**

```
    Handshake → ServerHello        (57 B)     negotiated TLS 1.2, cipher 0xc02b
    Handshake → Certificate        (2731 B)   🎉 PLAINTEXT DER
    Handshake → ServerKeyExchange  (111 B)
    Handshake → ServerHelloDone    (0 B)

    first cert bytes:  30 82 03 ee 30 82 03 94 a0 03 02 01 02 02 10 72
    subject : CN=github.com
    issuer  : CN=Sectigo Public Server Authentication CA DV E36
    valid   : Jul 3 2026  →  Sep 30 2026
    SANs    : DNS:github.com, DNS:www.github.com
```

### 🔑 The critical discovery: **offer TLS 1.2, not 1.3**

```
  TLS 1.3  →  the Certificate message is ENCRYPTED.  We would see nothing. ❌
  TLS 1.2  →  the Certificate message is PLAINTEXT.  We parse it ourselves. ✅
```

By offering only TLS 1.2 cipher suites in our ClientHello, **every server hands us its
certificate in the clear** — 1010 bytes of raw DER, ready for our own ASN.1 parser.

> ⚠️ **This is a project-defining decision. Write it in `proto/tls.js` as a comment.**
> It is also a genuinely interesting `STDLIB.md` entry: *"we deliberately negotiate down
> to TLS 1.2 so the certificate is observable — this is exactly why TLS 1.3 encrypts it."*
>
> It even becomes a **Tier-3 lesson**: *"Why can we see this certificate? Because we asked
> for old crypto. TLS 1.3 fixed this. Here's what a 1.3 handshake looks like instead —
> nothing."*

### ✅ De-risks the biggest scheduled risk
The H36–H41 block listed ASN.1/DER as **highest risk** with a `node:crypto` fallback.
Confirmed: the DER arrives cleanly and `crypto.X509Certificate` parses it. So we can build
our own parser **with a working cross-check available at all times** — write our parser,
assert its output equals `X509Certificate`'s. That's both a safety net *and* a test.

---

## 4️⃣ SNI experiments — Chapter 5's demo climax 🔥 **CONFIRMED SPECTACULAR**

### ❌ What did NOT work
Removing SNI from a github.com connection still returned the **correct** github cert —
GitHub has a dedicated IP, so there is only one possible answer. **Do not use github.com
for the SNI demo.**

### ✅ Experiment A — remove SNI on a shared CDN host

| Host | with SNI | without SNI |
|---|---|---|
| `example.com` (Cloudflare) | `CN=example.com` | 🔴 **fatal alert 2/40 — handshake_failure** |
| `blog.cloudflare.com` | `CN=blog.cloudflare.com` | 🔴 **fatal alert 2/40** |
| `medium.com` | `CN=medium.com` | 🔴 **fatal alert 2/40** |
| `www.wikipedia.org` | `CN=*.wikipedia.org` | same (dedicated IP) |
| `discord.com` | `CN=discord.com` | same |

> **Demo line:** *"Main SNI hata deta hoon... aur Cloudflare connection hi refuse kar deta
> hai. `handshake_failure`. Kyunki ek IP pe hazaaron sites hain — bina naam bataye server
> ko pata hi nahi chalega konsa certificate bheje. **Yahi SNI hai.**"*

### ✅ Experiment B — the SWAP 🏆 **THIS IS THE BEST MOMENT IN THE WHOLE PROJECT**

Connect to **medium.com's IP address**, but put a *different* hostname in the SNI field:

```
  medium IP + SNI medium.com          (control)  →  CN=medium.com
  medium IP + SNI blog.cloudflare.com   ← SWAP   →  CN=blog.cloudflare.com   🤯
  medium IP + SNI discord.com           ← SWAP   →  CN=discord.com           🤯
  cloudflare IP + SNI medium.com        ← SWAP   →  CN=medium.com            🤯
```

**We never changed the IP address. We changed one string inside the ClientHello — and got
a completely different company's certificate back from the same server.**

> **Demo line:** *"Main medium.com ke server se baat kar raha hoon. IP wahi hai. Maine sirf
> ClientHello ke andar ek naam badla — `discord.com`. Aur dekho — medium ke server ne mujhe
> **Discord ka certificate** de diya.*
>
> *Ek IP. Hazaaron websites. SNI hi wo naam hai jo batata hai kise chahiye. Aur ye handshake
> ka **ekmatra hissa hai jo encrypted nahi hota** — isliye tumhara ISP aaj bhi dekh sakta
> hai tum konsi site khol rahe ho, chahe HTTPS ho."*

This teaches SNI, virtual hosting, CDNs, and the privacy limits of HTTPS — **in fifteen
seconds, by editing one field.** No textbook does this.

### 📌 Locked demo hosts
| Purpose | Host | Why |
|---|---|---|
| Normal cert inspection | `github.com` | Clean, recognisable, fast |
| SNI removal → failure | `medium.com` or `blog.cloudflare.com` | Shared Cloudflare IP, reliable `alert 2/40` |
| **SNI swap → wrong cert** | `medium.com` IP + SNI `discord.com` | Confirmed working, maximum shock value |

---

## 5️⃣ OS tools via `child_process` — Chapters 1 & 3 ✅

| Tool | Result | Chapter use |
|---|---|---|
| `ping -n 2 8.8.8.8` | **TTL=119** — ICMP allowed | Ch3 · TTL is a real teaching hook |
| `tracert -h 5 8.8.8.8` | **5 hops parsed**, 2 timeouts (`* * *`) | Ch3 · live hop animation ✅ |
| `ipconfig /all` | 71 lines | Ch1 · your IP, gateway, MAC |
| `arp -a` | **10 entries** | Ch1 · your real LAN, other devices visible 🎉 |
| `route print` | 40 lines | Ch3 · your real routing table |
| `netstat -n` | **29 established connections** | Ch4 · real live sockets |

> 💡 **`TTL=119` is a free lesson.** Most OSes start TTL at 128. `128 − 119 = 9 hops away`.
> Add to Ch3 Tier 3: *"You can count the hops without running traceroute — just look at
> the TTL that came back."*

> 💡 **10 ARP entries** means Chapter 1's "here is your actual home network" visual will be
> populated and impressive on this machine. Confirmed, not hoped.

> ⚠️ **`tracert` showed 2 `* * *` timeouts in 5 hops.** Expected — some routers refuse to
> reply. The Ch3 UI must render these as ghost nodes labelled *"this router chose not to
> answer"*, not as errors. **Design for this from the start.**

---

## 🛠️ Ship the pre-flight test as a product feature

The test script becomes `tools/doctor.js` → the `doctor` terminal command.

```
$ doctor
  ✅ DNS over UDP 53 ......... 6.5 ms via 1.1.1.1
  ✅ TCP 443 ................. ok
  ✅ ICMP ping ............... ok
  ⚠️  traceroute ............. 2 hops not responding
  ✅ LAN visible ............. 10 devices
```

**Why this is worth 30 minutes:**
- A judge on a locked-down corporate network runs `doctor` and instantly sees *why* something
  doesn't work — instead of thinking the app is broken 🎯
- It is itself a networking lesson (*"here's how you diagnose a network"*)
- It proves the app degrades gracefully — a Code Quality signal
- It is the perfect first-run experience

**Add to the plan: Block 6, +30 min.**

---

## 📋 Changes to make in the other docs

| Doc | Change |
|---|---|
| [04-72-HOUR-PLAN](04-72-HOUR-PLAN.md) | Firewall risk → **CLOSED**. ASN.1 risk → **downgraded** (cross-check available). Add `doctor` to Block 6. |
| [03-CHAPTERS](03-CHAPTERS.md) | Ch5: lock TLS 1.2, use the SNI **swap** as the challenge. Ch3: handle `* * *` ghost hops. Ch4: ephemeral port counting. |
| [06-DEMO-SCRIPT](06-DEMO-SCRIPT.md) | Replace the SNI-removal beat with the **SNI swap** — it is far stronger. |
| `proto/tls.js` | Comment at the top explaining the deliberate TLS 1.2 downgrade. |

---

## 🎬 Insurance footage — record these NOW

You have working code for all of it already. Record before anything can break:

- [ ] Three resolvers answering with different latencies
- [ ] The 2935-byte TLS response decomposing into ServerHello / Certificate / SKE / Done
- [ ] `CN=github.com` extracted from raw DER bytes
- [ ] 🔥 **The SNI swap producing `CN=discord.com` from medium's server**
- [ ] `tracert` output with the `* * *` gaps
- [ ] `arp -a` showing the real LAN

---

**⬅️ Back to:** [docs/README.md](README.md)

---

# 🔧 Block 2 corrections

> Found while building the DNS codec. Two scripted demo beats did not survive
> contact with the real internet. Both are fixed; recording either one as
> originally written would have failed on camera.

## ❌ `github.com` has no AAAA record

The QTYPE `A → AAAA` edit is the demo's opening move. On `github.com` it returns
**nothing** — not an error, just zero answers, because GitHub genuinely publishes
no IPv6 address.

Checked across eight major domains:

| Domain | A | AAAA |
|---|---|---|
| `facebook.com` | 57.144.160.1 | `2a03:2880:f312:1:face:b00c:0:25de` 🥚 |
| `cloudflare.com` | 104.16.132.229 | `2606:4700::6810:85e5` |
| `google.com` | 142.250.193.14 | `2404:6800:4002:829::200e` |
| `wikipedia.org` | 103.102.166.224 | `2001:df2:e500:ed1a::1` |
| `youtube.com` | 172.217.160.14 | `2404:6800:4000:100c::5d` |
| `example.com` | 172.66.147.243 | `2606:4700:10::ac42:93f3` |
| `netflix.com` | 54.155.178.5 | `2a05:d018:76c:b684:b233:ac1f:be1f:7` |
| **`github.com`** | 20.207.73.82 | ❌ **none** |

> **Demo domain locked: `facebook.com`.**
> Its IPv6 address contains **`face:b00c`** — Facebook spelled "facebook" in hex.
> A real easter egg, visible on screen, and completely impossible to fake. It
> proves the data is live better than any amount of narration.
>
> `cloudflare.com` is the clean fallback if a shorter address reads better.

## ❌ The transaction-id mismatch could not happen naturally

Editing the id in the outgoing packet does **not** produce a mismatch — the
server echoes whatever id you sent, so it always matches. The original demo beat
was impossible as written.

**Fix — an `expectId` parameter, and it is more honest than the original idea:**

The byte editor sends the id of the packet the learner *started from*. Edit the
id field and the reply comes back carrying the new id, which no longer matches
the one we are waiting for. That is precisely the check a resolver performs
against a forged answer.

Verified output:

```
$ POST /api/dns  {"rawOverride":"7f3e…","expectId":6699}

  waiting for: 0x1a2b | reply carried: 0x7f3e | idMatch: false
  label: DNS response · REJECTED
  "A reply arrived and was thrown away. We asked with id 0x1a2b; this answer
   carried 0x7f3e. That mismatch is exactly how a forged DNS reply gets rejected."
```

## ⚠️ Clearing the RD bit is unreliable

`RD = 0` is supposed to make the resolver refuse to chase the answer. In practice
`1.1.1.1` answers from cache anyway, so the demo shows nothing. **Keep it as a
tier-3 experiment, never as a scripted demo beat.**

## ✅ Everything else held up

| Check | Result |
|---|---|
| Name compression (`0xC0`) | Present in **every** real response with records |
| A, AAAA, CNAME, MX, NS, SOA | All decode correctly from captured fixtures |
| NXDOMAIN | rcode 3, zero answers, SOA in authority ✅ |
| "name exists, wrong type" | rcode 0 with zero answers — a distinct case, narrated differently ✅ |
| `1.1.1.1` vs `8.8.8.8` | 6.5–13 ms vs 13–26 ms. Default stays Cloudflare. |

---

# 🔧 Block 9 correction — which host to demo the journey on

`journey` renders where the time went. Which host you pick decides whether that
chart teaches anything.

| Host | Body | Largest slice | What a viewer learns |
|---|---:|---|---|
| **`example.com`** | 868 B | **TLS 37%**, setup **74%** | ✅ The handshake costs more than the content |
| `github.com` | 580 KB | Transfer 57%, setup 29% | ❌ "Big pages take time to download" |

A large page buries the lesson: transfer dominates and the handshake looks
cheap. On a small page the shape is unmistakable — three quarters of the time
is spent before a single byte of content moves, which is exactly why keep-alive,
HTTP/2 and session resumption exist.

> **Demo host locked: `example.com`.** `wikipedia.org` also works.
> Do **not** use `github.com` for chapter 7.

Verified output:

```
$ journey https://example.com
      0.0 ms  -> DNS query                  29 B  UDP
      7.4 ms  <- DNS response               61 B  UDP
     16.3 ms  -> TCP connect                      TCP
     32.6 ms  <- TLS handshake                    TLS
     32.6 ms  -> GET /                     121 B  HTTPS
     44.4 ms  <- 200 OK                    868 B  HTTPS

  48.6 ms total - 4 protocols - 1.1 KB

  WHERE THE TIME WENT
  DNS          7.4 ms   17%  #########
  TCP          8.9 ms   20%  ##########
  TLS         16.3 ms   37%  ###################
  Request     11.8 ms   26%  #############
  Transfer     0.2 ms    0%  #

  74% of that went on setup before one byte of content moved.
```
