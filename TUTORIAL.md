# 📘 netlens — Tutorial

**Ye doc tumhare liye hai.** Isme koi assumption nahi hai. Har cheez step by step,
Hinglish me, aur har command ka output bhi diya hai taaki pata chale ki sahi chal raha hai.

---

## Part 1 · Sabse pehle: ise chalao kaise

### Step 1 — Terminal kholo

VS Code me `` Ctrl+` `` dabao, ya Windows me `cmd` / PowerShell kholo.

### Step 2 — Project folder me jao

```bash
cd C:\Users\HP\OneDrive\Desktop\zero-dep
```

### Step 3 — Chalao

```bash
node run.js
```

**Ye dikhna chahiye:**

```
  ▄▄▄   netlens  v1.0.0
  ▀▀▀   see every byte

  ● running   http://127.0.0.1:7777
  mode      dev (serving web/ from disk)
  node      v22.15.1 · win32
  deps      0 — run `node verify-zero-dep.js` to prove it

  ctrl+c to stop
```

Browser apne aap khul jaayega. Nahi khula to khud `http://127.0.0.1:7777` type karo.

**Band karne ke liye:** us terminal me `Ctrl+C`.

> 🔴 **"port 7777 busy" aaye to?** Koi purana server chal raha hai. Ye chalao:
> ```bash
> node run.js --port 7900
> ```
> Ya sab band karo (PowerShell me):
> ```powershell
> Get-Process node | Stop-Process -Force
> ```

---

## Part 2 · Screen pe kya-kya hai

```
┌────────────────────────────────────────────────────────────────────────┐
│ NETLENS_ v1.0.0//ZERO_DEP  ROOT / CH_02 / NAMES_TO_NUMBERS / DO_IT     │ <- 1
│                                        [NET: OK] [DEPS: 0]   ▬▬▭▭▭  ◐ ?│
├─────────────────┬────────────────────────────────┬─────────────────────┤
│ CHAPTERS        │                           02   │ ->SENT 30B ←RECV 46B│ <- 5
│ 01 YOUR_OWN_NET │                               │──────────────────────│
│▐02 NAMES_TO_NUM │     ┌──────┐      ┌─────────┐ │ HEADER         12 B  │
│ 03 FINDING_PATH │     │ You  │──────│ 1.1.1.1 │ │   ID     0x1a2b      │
│ 04 RELIABLE_OR  │     └──────┘      └─────────┘ │   QTYPE  1 (A)       │
│ 05 THE_LOCK     │                        <- 2   │──────────────────────│
│ 06 ASKING_PAGE  │                               │ [explanation]        │
│ 07 FULL_JOURNEY ├────────────────────────────────┤ HEX_DUMP      30 B  │ <- 6
│ 08 IT_WAS_LAYER │ narration line here     <- 3  │ 0000 1a 2b 01 00 ..  │
│                 ├────────────────────────────────┤ BYTE 27  0x1c       │
│ DEPTH           │ PACKET_TIMELINE               │ 0 0 0 1 1 1 0 0      │
│▐▪ STORY    read │  0.0ms DNS query →1.1.1.1 <-4 │──────────────────────│
│ ▪ DO_IT     run │  9.4ms DNS resp  ←1.1.1.1     │ [edit bar]           │ <- 7
├─────────────────┴────────────────────────────────┴─────────────────────┤
│ $ dig facebook.com                                                     │ <- 8
│   → 30 bytes to 1.1.1.1:53 (Cloudflare)                                │
│   facebook.com.  44  IN  A  57.144.150.1                               │
│ $ ▊                                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

| # | Kya hai | Kaam |
|---|---|---|
| 1 | **Header** | Kaunsa chapter khula hai, progress dots, theme toggle |
| 2 | **Canvas** | Packet yahan animate hota hai |
| 3 | **Narration** | Abhi kya hua, ek plain line me |
| 4 | **Timeline** | Har packet ki ek row. Click karo → inspector me khulega |
| 5 | **Packet tabs** | `Sent` / `Received` — kaunsa packet dekh rahe ho |
| 6 | **Hex** | Asli bytes |
| 7 | **Edit bar** | Byte badalne ke controls |
| 8 | **Terminal** | Yahan commands type karte ho |

Upar wala breadcrumb hamesha batata hai tum kahan ho:
`ROOT / CH_02 / NAMES_TO_NUMBERS / DO_IT`

---

## Part 3 · Teen "Depth" levels (left sidebar me)

Ye project ka **sabse important design** hai. Sidebar me `DEPTH` ke neeche teen options hain:

| Level | Keyboard | Kya dikhta hai | Kiske liye |
|---|---|---|---|
| 🟢 **STORY** | `1` | Canvas + terminal | Beginner |
| 🟡 **DO_IT** | `2` | Upar wala + timeline + narration | Beginner |
| 🔴 **REAL_BYTES** | `3` | Upar wala + **inspector** (hex, bits, editor) | Student |

**Terminal har tier pe dikhta hai.** Wo poore app ka input device hai.

**Beginner kabhi tier 3 pe jaata hi nahi.** Usko hex byte dikhta hi nahi.
**Tier 3 pe jaane ke liye keyboard pe `3` dabao** (ya sidebar me click karo).

> ⚠️ **Zaroori:** Byte editor **sirf tier 3 pe** kaam karta hai. Agar kuch kaam
> nahi kar raha, pehle check karo ki tum tier 3 pe ho.

---

## Part 4 · Saare commands

Terminal me `help` type karo, ya ye list dekho:

### Chapter 1 — Tumhara apna network

| Command | Kya karta hai |
|---|---|
| `ifconfig` | Tumhara IP, subnet, gateway, MAC, DNS |
| `arp` | Tumhare network pe aur kaun-kaun se devices hain |
| `route` | Tumhari routing table |
| `netstat` | Abhi kitne connections khule hain |
| `ping <host>` | Wo host reachable hai? Kitni door hai? |

### Chapter 2 — DNS

| Command | Kya karta hai |
|---|---|
| `dig <domain>` | Naam se IP nikalta hai — **asli packet bhejta hai** |
| `dig <domain> AAAA` | IPv6 address maangta hai |
| `dig @8.8.8.8 <domain>` | Google se poochta hai, Cloudflare se nahi |
| `resolvers` | Teen resolvers ki speed compare karta hai |

### Chapter 3 — Routing

| Command | Kya karta hai |
|---|---|
| `tracert <host>` | Har router jo beech me aata hai — **live** |
| `traceroute <host>` | Wahi cheez (Linux/Mac wala naam) |

### Chapter 5 — TLS / certificates

| Command | Kya karta hai |
|---|---|
| `tls <host>` | Apna ClientHello bhejta hai, certificate khud parse karta hai |
| `tls <host> --no-sni` | Bina naam ke — dekho server kaise mana kar deta hai |
| `tls <host> --sni <naam>` | 🔥 Doosri site ka naam maango, uska certificate milega |

### Utility

| Command | Kya karta hai |
|---|---|
| `doctor` | Check karta hai ki is machine pe kya-kya allowed hai |
| `replay [speed]` | Last animation dobara. `replay 8` = 8x slow |
| `lang hi` | Narration Hinglish me |
| `clear` | Screen saaf |
| `help <command>` | Kisi ek command ki detail |

### Terminal shortcuts

| Key | Kaam |
|---|---|
| `↑` `↓` | Purane commands |
| `Tab` | Auto-complete |
| `Ctrl+L` | Clear |
| `Ctrl+C` | Line cancel |

### Terminal ka size badalna

Terminal ke **upar ek patli line** hai (grip handle). Uspe:

| Action | Kaam |
|---|---|
| **Drag** upar/neeche | Terminal chhota/bada |
| **Double-click** | Default (248px) ↔ bada (55% screen) toggle |
| Click karke `↑` `↓` | 16px step. `Shift` ke saath 64px |

Size **yaad rakha jaata hai** — agli baar wahi milega.

> 💡 `tracert` chalane se pehle terminal bada kar lo (double-click) — uska output
> 12+ lines ka hota hai.

---

## Part 5 · Pehla din: 10 minute me sab dekho

Ye exactly type karo, isi order me.

### 1️⃣ Apna network dekho (30 sec)

```
ifconfig
```
```
  Interface   Wi-Fi  (Realtek RTL8822CE 802.11ac PCIe Adapter)
  Your IP     192.168.1.35/24
  Subnet      255.255.255.0      who counts as your neighbour
  Gateway     192.168.1.1        the door out to the internet
  MAC         60:e9:aa:b9:ca:27  burned into the hardware
  DNS         103.127.130.13, 103.127.130.50
```
**Ye tumhara asli laptop hai.** Koi fake data nahi.

### 2️⃣ Ghar ke doosre devices (30 sec)

```
arp
```
```
  192.168.1.1     30:3d:51:a3:10:30   your router
  192.168.1.36    44:5c:e9:33:bd:e8   another device on this network
  2 device(s). 7 multicast/broadcast rows hidden — those are not devices.
```
Wo doosra device? **Kisi ka phone hai jo tumhare Wi-Fi pe hai.**
Canvas pe tumhari asli LAN ban gayi hogi.

### 3️⃣ Pehla asli packet (30 sec)

```
dig facebook.com
```
```
  → 30 bytes to 1.1.1.1:53 (Cloudflare)
  ← 46 bytes in 8.3 ms
  facebook.com.  44  IN  A  57.144.150.1
```
Canvas dekho — ek dot ud ke gaya aur wapas aaya. **Wo 30 bytes asli me gaye the.**

### 4️⃣ Slow motion me dekho (30 sec)

```
replay 8
```
Ab dhyan se dekho: dot nikalta hai, pahunchta hai, jawab wapas aata hai.

### 5️⃣ IPv6 maango (30 sec)

```
dig facebook.com AAAA
```
```
  facebook.com.  25  IN  AAAA  2a03:2880:f34b:1:face:b00c:0:25de
                                                ^^^^^^^^^
```
👀 **`face:b00c`** dekha? Facebook ne apne IPv6 address me hex me "facebook" likha hai.
Ye asli hai. Ye fake nahi ho sakta.

### 6️⃣ Raasta dekho (1 min)

```
tracert 1.1.1.1 8
```
Hops ek-ek karke aayenge. Ek hop `* * *` dikhayega — wo router **jawab dene se
mana kar raha hai**, par packet phir bhi aage bhej raha hai. Canvas pe wo
**dashed box with `?`** ban jaayega.

### 7️⃣ Machine check (30 sec)

```
doctor
```
```
  ok   DNS over UDP 53      10 ms via Cloudflare
  ok   Your interface       Wi-Fi 192.168.1.35/24
  ok   LAN neighbours       2 device(s)
  ok   Routing table        default via 192.168.1.1
  ok   ICMP ping            4 ms, TTL 59
```
Sab `ok` = sab kaam kar raha hai.

---

## Part 6 · 🔥 THE BIG ONE — Byte editor

**Ye project ka sabse important feature hai.** Demo ka climax yahi hai.
Dhyan se, step by step.

### Setup

**Step 1:** Terminal me:
```
dig facebook.com
```

**Step 2:** Keyboard pe **`3`** dabao (tier 3 pe jao).
Right side me inspector khul jaayega.

> Agar inspector nahi khula — sidebar me `Real bytes` pe click karo.

**Step 3:** Inspector me upar `→ Sent 30 B ✎` tab pe click karo.
(✎ ka matlab: **ye packet edit ho sakta hai**)

---

### Edit 1 · IPv4 → IPv6

**Step 4:** Field tree me `Header` ke `▾` pe click karke usko **band** karo.
Ab `Question` section dikhega.

**Step 5:** `QTYPE   1 (A)` pe click karo.

Ab teen cheezein ek saath honi chahiye:
- Hex me do bytes **highlight** ho gaye (`00 01`)
- Neeche **explanation box** aa gaya: *"Which kind of record you want. 1 = A (IPv4), 28 = AAAA (IPv6)..."*
- Neeche **edit bar** me `byte 26` dikh raha hai

**Step 6:** Ab **keyboard se type karo** (koi box nahi hai, seedha type karo):

```
0  0        ← pehla byte 00 kar diya
→           ← ArrowRight (agle byte pe jao)
1  c        ← doosra byte 1c kar diya
```

**Kya hona chahiye:**
- Tree me `QTYPE` **turant** `28 (AAAA)` ban gaya — **abhi kuch bheja nahi**
- Hex me `1c` byte **laal** ho gaya
- Edit bar me `1 byte changed` + `Re-send for real` button

**Step 7:** Ab **`r`** dabao (ya `Re-send for real` button click karo).

**Terminal me:**
```
re-sending 30 edited bytes
  facebook.com.  25  IN  AAAA  2a03:2880:f34b:1:face:b00c:0:25de
```

🎉 **Tumne ek byte badla. Internet ne alag jawab diya.**

---

### Edit 2 · Transaction ID todo

**Step 1:** Fresh start:
```
dig facebook.com
```

**Step 2:** Tier 3 pe raho, `Sent` tab pe raho.

**Step 3:** Tree me `Header` → `ID` pe click karo.

**Step 4:** Type karo:
```
7  f
→
3  e
```

**Step 5:** `r` dabao.

**Terminal me:**
```
re-sending 30 edited bytes
reply REJECTED — waiting for 0x8b62, got 0x7f3e
```

**Timeline me:** `DNS response · REJECTED`

**Narration me:** *"A reply arrived and was thrown away... That mismatch is
exactly how a forged DNS reply gets rejected."*

**Ye kya sikhaya?** Har DNS query me ek random ID hoti hai. Reply ki ID match
nahi kari to reject. **Isliye koi attacker fake DNS answer nahi bhej sakta** —
usse wo random number guess karna padega.

---

### Byte editor ke saare keys

⚠️ Ye sirf **tier 3** pe kaam karte hain, aur **Sent packet** select hona chahiye.

| Key | Kaam |
|---|---|
| `0-9` `a-f` | Do digit type karo = byte badal gaya |
| `←` `→` | Agla/pichla byte |
| `r` | **Re-send** — asli me bhejo |
| `u` | **Undo** — sab wapas |
| `Esc` | Edit cancel |

**Aur kya try kar sakte ho:**

| Field | Isse badlo | Kya hoga |
|---|---|---|
| `QTYPE` | `00 0f` | MX records — mail servers |
| `QTYPE` | `00 02` | NS records — kaun is domain ka maalik hai |
| `QTYPE` | `00 10` | TXT records |
| `QNAME` ka koi length byte | kuch bhi galat | Parse fail — hum batayenge kahan ruka |

---

## Part 7 · Bit ruler (chauthi zoom level)

Tier 3 pe, tree me `Header` → **`RD`** pe click karo.

Hex ke neeche ye dikhega:

```
byte 2   0x01   1

  0  0  0  0  0  0  0  1
                       ▲

  bit 0     QR       0 (query)
  bits 1-4  Opcode   0 (QUERY)
  bit 5     AA       0
  bit 6     TC       0
  bit 7     RD       1
```

**Ye samajhne wali cheez hai:** ye **ek byte** (`0x01`) me **paanch alag fields**
hain. Har bit ka apna matlab hai. Isiliye "0x01" dikhana kuch nahi sikhata, par
aath labelled bits dikhana sab kuch sikha deta hai.

---

## Part 8 · Doosre useful commands

### Teen DNS servers ki race
```
resolvers github.com
```
```
  Cloudflare  1.1.1.1     8.9 ms   20.207.73.82
  Google      8.8.8.8    11.7 ms   20.207.73.82
  Quad9       9.9.9.9     8.9 ms   20.207.73.82
  Same answer, different speeds. The distance to the resolver is real.
```

### TTL se distance nikalo
```
ping 1.1.1.1
```
```
  32 bytes from 1.1.1.1  time=4ms  TTL=59
  TTL 59 means about 5 routers between you and 1.1.1.1.
```
**Kaise?** Sender TTL 64 se shuru karta hai, har router 1 ghatata hai.
`64 − 59 = 5 hops`. Traceroute chalaye bina distance pata chal gayi.

### Narration Hinglish me
```
lang hi
dig facebook.com
```

---

## Part 9 · Development commands

Ye tumhare liye, users ke liye nahi.

| Command | Kya karta hai | Kab chalana hai |
|---|---|---|
| `node run.js` | App chalao | Har baar |
| `node --test` | Saare 174 tests | **Har change ke baad** |
| `node verify-zero-dep.js` | Zero-dependency proof | Test ke saath auto chalta hai |
| `npm test` | Upar ke dono ek saath | Commit se pehle |
| `node tools/preflight/network-check.js` | Network capabilities check | Nayi machine pe |

**Tests aise dikhne chahiye:**
```
# tests 174
# pass 174
# fail 0
```

**Zero-dep check aisa:**
```
    files scanned.........   88
      └─ third-party......  000  OK
  🏆 ZERO DEPENDENCY VERIFIED
```

---

## Part 10 · Kuch kaam na kare to

| Problem | Wajah | Fix |
|---|---|---|
| Browser me purana version dikh raha hai | Browser ne JS cache kar liya | **`Ctrl+Shift+R`** (hard refresh) |
| Byte editor keys kaam nahi kar rahe | Tier 3 pe nahi ho | `3` dabao |
| Byte editor phir bhi nahi | `Received` tab select hai | `→ Sent` tab pe click karo |
| Typing se tier badal jaata hai | Koi byte selected nahi hai | Pehle tree ya hex me kisi field pe click karo |
| `port busy` | Purana server chal raha hai | `node run.js --port 7900` |
| `dig` timeout | Network UDP 53 block kar raha hai | `doctor` chalao — wo batayega |
| `tracert` bahut slow | Normal hai, 30 sec lagte hain | `tracert 1.1.1.1 8` (kam hops) |
| Canvas khaali | Abhi koi command nahi chalayi | `dig facebook.com` |
| Terminal bahut chhota | Pehle drag kar diya tha | Grip pe **double-click** |
| Output upar scroll ho gaya | Terminal chhota hai | Grip drag karke bada karo |

> 🔑 **Sabse common problem: browser cache.** Maine jo bhi code badla, wo dikhne
> ke liye **`Ctrl+Shift+R`** dabana padta hai. Normal refresh (`F5`) kaafi nahi hai.

---

## Part 11 · Project ka structure — kaunsi file kya karti hai

```
zero-dep/
├── run.js                    ← APP CHALANE KI FILE
├── verify-zero-dep.js        ← zero-dependency proof
├── package.json              ← "dependencies": {} (khaali)
│
├── src/                      ═══ SERVER (Node) ═══
│   ├── server/               HTTP server, routes, SSE
│   ├── proto/
│   │   ├── dns.js            ⭐ DNS codec — bytes ↔ object
│   │   └── dns-client.js     UDP se asli packet bhejta hai
│   ├── sys/
│   │   ├── exec.js           🛡️ OS commands safely chalata hai
│   │   ├── netinfo.js        ipconfig/arp/route parse
│   │   ├── ping.js           ping parse (3 platforms)
│   │   └── trace.js          traceroute parse
│   ├── api/                  har endpoint ka handler
│   └── shared/
│       ├── bytes.js          Reader/Writer, hex helpers
│       ├── explain.js        ⭐ har field ka matlab (yahan text edit karo)
│       └── narrate.js        ⭐ narration lines (yahan bhi)
│
├── web/                      ═══ BROWSER ═══
│   ├── index.html            page ka structure
│   ├── css/                  theme.css (colors) + app.css (layout)
│   └── js/
│       ├── main.js           sab wire karta hai
│       ├── state.js          60-line store (React ki jagah)
│       ├── term/             ⭐ terminal + COMMANDS (nayi command yahan)
│       ├── viz/              canvas, animation
│       └── inspect/          tree, hex, bits, ⭐ editor
│
├── test/                     174 tests + fixtures
└── docs/                     poora plan (00 se 07 tak)
```

**Text badalna hai to sirf do files:**
- `src/shared/explain.js` — field explanations
- `src/shared/narrate.js` — timeline narration

**Nayi command add karni hai:**
- `web/js/term/commands.js` — `COMMANDS` object me ek entry

---

## Part 12 · Abhi kya ban chuka hai

| Chapter | Status | Commands |
|---|---|---|
| 01 · YOUR_OWN_NETWORK | ✅ **Done** | `ifconfig` `arp` `route` `netstat` `ping` |
| 02 · NAMES_TO_NUMBERS | ✅ **Done** | `dig` `resolvers` + **byte editor** |
| 03 · FINDING_THE_PATH | ✅ **Done** | `tracert` (live) |
| 04 · RELIABLE_OR_FAST | ⬜ Baaki | — |
| 05 · THE_LOCK | ✅ **Done** | `tls` + SNI swap |
| 06 · ASKING_FOR_A_PAGE | ⬜ Baaki | — |
| 07 · THE_FULL_JOURNEY | ⬜ Baaki | — |
| 08 · IT_WAS_LAYERS | ⬜ Baaki | — |

**Ban chuka:** 174 tests, 0 dependencies, byte editor, live traceroute,
4 zoom levels, terminal, canvas.

**Abhi baaki:** Chapter 4–8, lesson engine (Story/Do it/Real bytes ka actual
content), `build.js` (single file bonus), README, STDLIB.md, demo video.

> ⚠️ **Note:** Sidebar me chapters 4-8 dikhte hain par unka content abhi nahi hai.
> Wo click karoge to layout to badlega, par koi lesson nahi milega. Wo agle
> blocks me banega.

---

## Part 13 · Demo ke liye cheat sheet

Video record karte waqt yahi sequence:

```
1.  ifconfig                    "ye mera asli laptop hai"
2.  arp                         "ye kisi ka phone hai mere Wi-Fi pe"
3.  dig facebook.com            "28 bytes abhi gaye"
4.  [3 dabao]                   tier 3 — hex dikhao
5.  QTYPE pe click              explanation box dikhao
6.  0 0 → 1 c                   "QTYPE badal gaya, abhi bheja nahi"
7.  r                           🔥 face:b00c wala IPv6
8.  dig facebook.com            fresh
9.  ID pe click, 7f 3e, r       🔥 REJECTED
10. tracert 1.1.1.1 8           live hops + silent router
11. tls medium.com --no-sni     server mana kar deta hai
12. tls medium.com --sni discord.com    🔥 Discord ka certificate
13. node verify-zero-dep.js     🏆 ZERO DEPENDENCY VERIFIED
```

**Recording ke liye:** browser window **1440px se choti mat karo** — 1100px se
neeche sidebar hide ho jaata hai.

---

## Part 14 · Aage kya

Mujhe bolo:

| Bolo | Main karunga |
|---|---|
| `block 9` | HTTP + full journey (Ch 6 + Ch 7) |
| `block 10` | Ch 4 (TCP/UDP) + Ch 8 (layers) |
| `lesson engine` | Story/Do it/Real bytes ka actual content |
| `readme` | README + STDLIB.md + dependency proof |
| `build` | Single-file build (+10 bonus) |

---

**Kuch samajh na aaye to seedha poochho.** Ye tutorial tumhare liye hai —
jo hissa confusing lage, bolo, main usko phir se likh dunga.
