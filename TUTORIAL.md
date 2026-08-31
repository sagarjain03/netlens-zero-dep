# 📘 netlens — Tutorial

**This document is for you.** It makes no assumptions. Everything is explained step by step, in simple English, and the expected output of every command is included so you can tell whether everything is working correctly.

---

## Part 1 · First: How to run it

### Step 1 — Open the terminal

Press ``Ctrl+` `` in VS Code, or open `cmd` / PowerShell on Windows.

### Step 2 — Go to the project folder

```bash
cd C:\Users\HP\OneDrive\Desktop\zero-dep
```

### Step 3 — Run it

```bash
node run.js
```

**You should see:**

```text
  ▄▄▄   netlens  v1.0.0
  ▀▀▀   see every byte

  ● running   http://127.0.0.1:7777
  mode      dev (serving web/ from disk)
  node      v22.15.1 · win32
  deps      0 — run `node verify-zero-dep.js` to prove it

  ctrl+c to stop
```

The browser should open automatically. If it does not, manually enter `http://127.0.0.1:7777`.

**To stop it:** Press `Ctrl+C` in that terminal.

> 🔴 **What if you get "port 7777 busy"?** An old server is probably still running. Run:
>
> ```bash
> node run.js --port 7900
> ```
>
> Or stop all Node processes (in PowerShell):
>
> ```powershell
> Get-Process node | Stop-Process -Force
> ```

---

## Part 2 · What is on the screen

```text
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
│ DEPTH           │ PACKET_TIMELINE               │──────────────────────│
│▐▪ STORY    read │  0.0ms DNS query →1.1.1.1 <-4 │ [edit bar]           │ <- 7
│ ▪ DO_IT     run │  9.4ms DNS resp  ←1.1.1.1     │
├─────────────────┴────────────────────────────────┴─────────────────────┤
│ $ dig facebook.com                                                     │ <- 8
│   → 30 bytes to 1.1.1.1:53 (Cloudflare)                                │
│   facebook.com.  44  IN  A  57.144.150.1                               │
│ $ ▊                                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

| # | What it is      | What it does                                                     |
| - | --------------- | ---------------------------------------------------------------- |
| 1 | **Header**      | Shows which chapter is open, progress dots, and the theme toggle |
| 2 | **Canvas**      | Packets are animated here                                        |
| 3 | **Narration**   | Explains what just happened in one plain line                    |
| 4 | **Timeline**    | One row for every packet. Click it → it opens in the inspector   |
| 5 | **Packet tabs** | `Sent` / `Received` — which packet you are viewing               |
| 6 | **Hex**         | The actual bytes                                                 |
| 7 | **Edit bar**    | Controls for changing bytes                                      |
| 8 | **Terminal**    | Where you type commands                                          |

The breadcrumb at the top always tells you where you are:

`ROOT / CH_02 / NAMES_TO_NUMBERS / DO_IT`

---

## Part 3 · Three "Depth" levels (in the left sidebar)

This is the **most important design feature of the project**. Under `DEPTH` in the sidebar, there are three options:

| Level             | Keyboard | What you see                              | For whom |
| ----------------- | -------- | ----------------------------------------- | -------- |
| 🟢 **STORY**      | `1`      | Canvas + terminal                         | Beginner |
| 🟡 **DO_IT**      | `2`      | Above + timeline + narration              | Beginner |
| 🔴 **REAL_BYTES** | `3`      | Above + **inspector** (hex, bits, editor) | Student  |

**The terminal is visible at every tier.** It is the input device for the entire app.

**A beginner never needs to go to tier 3.** They will never see the hex bytes.

To go to tier 3, press **`3`** on the keyboard (or click it in the sidebar).

> ⚠️ **Important:** The byte editor **only works on tier 3**. If something is not working, first check that you are on tier 3.

---

## Part 4 · All commands

Type `help` in the terminal, or refer to this list:

### Chapter 1 — Your own network

| Command       | What it does                                                |
| ------------- | ----------------------------------------------------------- |
| `ifconfig`    | Shows your IP, subnet, gateway, MAC, and DNS                |
| `arp`         | Shows what other devices are on your network                |
| `route`       | Shows your routing table                                    |
| `netstat`     | Shows how many connections are currently open               |
| `ping <host>` | Checks whether the host is reachable and how far away it is |

### Chapter 2 — DNS

| Command                 | What it does                                             |
| ----------------------- | -------------------------------------------------------- |
| `dig <domain>`          | Gets an IP address from a name — **sends a real packet** |
| `dig <domain> AAAA`     | Requests an IPv6 address                                 |
| `dig @8.8.8.8 <domain>` | Asks Google instead of Cloudflare                        |
| `resolvers`             | Compares the speed of three resolvers                    |

### Chapter 3 — Routing

| Command             | What it does                             |
| ------------------- | ---------------------------------------- |
| `tracert <host>`    | Shows every router in between — **live** |
| `traceroute <host>` | Same thing (Linux/Mac name)              |

### Chapter 5 — TLS / certificates

| Command                   | What it does                                                |
| ------------------------- | ----------------------------------------------------------- |
| `tls <host>`              | Sends its own ClientHello and parses the certificate itself |
| `tls <host> --no-sni`     | Sends no hostname — see how the server rejects it           |
| `tls <host> --sni <name>` | 🔥 Request another site's name and receive its certificate  |

### Utility

| Command          | What it does                                       |
| ---------------- | -------------------------------------------------- |
| `doctor`         | Checks what is allowed on this machine             |
| `replay [speed]` | Replays the last animation. `replay 8` = 8x slower |
| `lang hi`        | Switches narration to Hinglish                     |
| `clear`          | Clears the screen                                  |
| `help <command>` | Shows details about a specific command             |

### Terminal shortcuts

| Key      | What it does            |
| -------- | ----------------------- |
| `↑` `↓`  | Previous commands       |
| `Tab`    | Auto-complete           |
| `Ctrl+L` | Clear                   |
| `Ctrl+C` | Cancel the current line |

### Resizing the terminal

There is a **thin line at the top of the terminal** (the grip handle). Use it like this:

| Action                  | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| **Drag** up/down        | Makes the terminal smaller/larger                         |
| **Double-click**        | Toggles between default (248px) ↔ large (55% of screen)   |
| Click and press `↑` `↓` | Changes size in 16px steps. With `Shift`, changes by 64px |

The size is **remembered** — you will get the same size next time.

> 💡 Before running `tracert`, make the terminal larger (double-click) — its output is usually 12+ lines long.

---

## Part 5 · First day: See everything in 10 minutes

Type these commands **exactly in this order**.

### 1️⃣ See your network (30 sec)

```text
ifconfig
```

```text
  Interface   Wi-Fi  (Realtek RTL8822CE 802.11ac PCIe Adapter)
  Your IP     192.168.1.35/24
  Subnet      255.255.255.0      who counts as your neighbour
  Gateway     192.168.1.1        the door out to the internet
  MAC         60:e9:aa:b9:ca:27  burned into the hardware
  DNS         103.127.130.13, 103.127.130.50
```

**This is your actual laptop.** There is no fake data.

### 2️⃣ See the other devices at home (30 sec)

```text
arp
```

```text
  192.168.1.1     30:3d:51:a3:10:30   your router
  192.168.1.36    44:5c:e9:33:bd:e8   another device on this network
  2 device(s). 7 multicast/broadcast rows hidden — those are not devices.
```

That other device? **It is someone's phone connected to your Wi-Fi.**

Your actual LAN should now appear on the canvas.

### 3️⃣ Your first real packet (30 sec)

```text
dig facebook.com
```

```text
  → 30 bytes to 1.1.1.1:53 (Cloudflare)
  ← 46 bytes in 8.3 ms
  facebook.com.  44  IN  A  57.144.150.1
```

Look at the canvas — a dot flies out and comes back.

**Those 30 bytes were actually sent.**

### 4️⃣ Watch it in slow motion (30 sec)

```text
replay 8
```

Now watch carefully: the dot leaves, reaches its destination, and the response comes back.

### 5️⃣ Request IPv6 (30 sec)

```text
dig facebook.com AAAA
```

```text
  facebook.com.  25  IN  AAAA  2a03:2880:f34b:1:face:b00c:0:25de
                                                ^^^^^^^^^
```

👀 **See `face:b00c`?** Facebook has written "facebook" into its IPv6 address using hexadecimal.

This is real. It is not fake.

### 6️⃣ See the route (1 min)

```text
tracert 1.1.1.1 8
```

The hops will appear one by one. One hop will show `* * *` — that router **is refusing to respond**, but it is still forwarding the packet.

On the canvas, it will appear as a **dashed box with `?`**.

### 7️⃣ Check the machine (30 sec)

```text
doctor
```

```text
  ok   DNS over UDP 53      10 ms via Cloudflare
  ok   Your interface       Wi-Fi 192.168.1.35/24
  ok   LAN neighbours       2 device(s)
  ok   Routing table        default via 192.168.1.1
  ok   ICMP ping            4 ms, TTL 59
```

Everything showing `ok` = everything is working.

---

## Part 6 · 🔥 THE BIG ONE — Byte editor

**This is the most important feature of the project.** This is the climax of the demo.

Follow it carefully, step by step.

### Setup

**Step 1:** In the terminal:

```text
dig facebook.com
```

**Step 2:** Press **`3`** on the keyboard (go to tier 3).

The inspector will open on the right side.

> If the inspector does not open — click **Real bytes** in the sidebar.

**Step 3:** In the inspector, click the `→ Sent 30 B ✎` tab at the top.

(`✎` means: **this packet can be edited**)

---

### Edit 1 · IPv4 → IPv6

**Step 4:** In the field tree, click `▾` next to `Header` to **collapse it**.

Now you should see the `Question` section.

**Step 5:** Click:

`QTYPE   1 (A)`

Three things should happen at the same time:

* Two bytes in the hex view should be **highlighted** (`00 01`)
* An **explanation box** should appear below: *"Which kind of record you want. 1 = A (IPv4), 28 = AAAA (IPv6)..."*
* The **edit bar** below should show `byte 26`

**Step 6:** Now type using the **keyboard** (there is no input box; type directly):

```text
0  0        ← change the first byte to 00
→           ← ArrowRight (move to the next byte)
1  c        ← change the second byte to 1c
```

**What should happen:**

* The tree should immediately show `QTYPE` as **`28 (AAAA)`** — nothing has been sent yet
* The `1c` byte should turn **red** in the hex view
* The edit bar should show `1 byte changed` + a `Re-send for real` button

**Step 7:** Now press **`r`** (or click the `Re-send for real` button).

**In the terminal:**

```text
re-sending 30 edited bytes
  facebook.com.  25  IN  AAAA  2a03:2880:f34b:1:face:b00c:0:25de
```

🎉 **You changed one byte. The internet gave you a different answer.**

---

### Edit 2 · Change the Transaction ID

**Step 1:** Start fresh:

```text
dig facebook.com
```

**Step 2:** Stay on tier 3 and stay on the `Sent` tab.

**Step 3:** In the tree, click:

`Header` → `ID`

**Step 4:** Type:

```text
7  f
→
3  e
```

**Step 5:** Press `r`.

**In the terminal:**

```text
re-sending 30 edited bytes
reply REJECTED — waiting for 0x8b62, got 0x7f3e
```

**In the timeline:** `DNS response · REJECTED`

**In the narration:**

*"A reply arrived and was thrown away... That mismatch is exactly how a forged DNS reply gets rejected."*

**What did this teach?**

Every DNS query has a random ID. If the response ID does not match, the response is rejected.

**This is why an attacker cannot simply send a fake DNS answer** — they would have to guess that random number.

---

### All byte editor keys

⚠️ These only work on **tier 3**, and the **Sent packet** must be selected.

| Key         | What it does                       |
| ----------- | ---------------------------------- |
| `0-9` `a-f` | Type two digits = the byte changes |
| `←` `→`     | Move to the previous/next byte     |
| `r`         | **Re-send** — send it for real     |
| `u`         | **Undo** — revert everything       |
| `Esc`       | Cancel the edit                    |

**Other things you can try:**

| Field                      | Change it to       | What happens                                      |
| -------------------------- | ------------------ | ------------------------------------------------- |
| `QTYPE`                    | `00 0f`            | MX records — mail servers                         |
| `QTYPE`                    | `00 02`            | NS records — who owns this domain                 |
| `QTYPE`                    | `00 10`            | TXT records                                       |
| Any length byte in `QNAME` | Anything incorrect | Parse failure — we will show you where it stopped |

---

## Part 7 · Bit ruler (fourth zoom level)

On tier 3, in the tree, click:

`Header` → **`RD`**

Below the hex view, you will see:

```text
byte 2   0x01   1

  0  0  0  0  0  0  0  1
                       ▲

  bit 0     QR       0 (query)
  bits 1-4  Opcode   0 (QUERY)
  bit 5     AA       0
  bit 6     TC       0
  bit 7     RD       1
```

**This is the important concept:** one **byte** (`0x01`) contains **five different fields**.

Every bit has its own meaning.

This is why simply showing `0x01` does not teach much, while showing eight labelled bits teaches everything.

---

## Part 8 · Other useful commands

### Race between three DNS servers

```text
resolvers github.com
```

```text
  Cloudflare  1.1.1.1     8.9 ms   20.207.73.82
  Google      8.8.8.8    11.7 ms   20.207.73.82
  Quad9       9.9.9.9     8.9 ms   20.207.73.82
  Same answer, different speeds. The distance to the resolver is real.
```

### Calculate distance using TTL

```text
ping 1.1.1.1
```

```text
  32 bytes from 1.1.1.1  time=4ms  TTL=59
  TTL 59 means about 5 routers between you and 1.1.1.1.
```

**How?**

The sender starts with TTL 64, and every router decreases it by 1.

`64 − 59 = 5 hops`

So you can determine the approximate distance without running traceroute.

### Narration in Hinglish

```text
lang hi
dig facebook.com
```

---

## Part 9 · Development commands

These are for **you as the developer**, not for users.

| Command                                 | What it does                    | When to run it                    |
| --------------------------------------- | ------------------------------- | --------------------------------- |
| `node run.js`                           | Runs the app                    | Every time                        |
| `node --test`                           | Runs all 174 tests              | **After every change**            |
| `node verify-zero-dep.js`               | Proves zero dependencies        | Runs automatically with the tests |
| `npm test`                              | Runs both of the above together | Before committing                 |
| `node tools/preflight/network-check.js` | Checks network capabilities     | On a new machine                  |

**Tests should look like this:**

```text
# tests 174
# pass 174
# fail 0
```

**Zero-dependency check should look like this:**

```text
    files scanned.........   88
      └─ third-party......  000  OK
  🏆 ZERO DEPENDENCY VERIFIED
```

---

## Part 10 · If something does not work

| Problem                         | Reason                                 | Fix                                         |
| ------------------------------- | -------------------------------------- | ------------------------------------------- |
| Browser shows the old version   | Browser cached the JavaScript          | **`Ctrl+Shift+R`** (hard refresh)           |
| Byte editor keys do not work    | You are not on tier 3                  | Press `3`                                   |
| Byte editor still does not work | `Received` tab is selected             | Click the `→ Sent` tab                      |
| Typing changes the tier         | No byte is selected                    | First click a field in the tree or hex view |
| `port busy`                     | An old server is running               | `node run.js --port 7900`                   |
| `dig` times out                 | Network is blocking UDP 53             | Run `doctor` — it will tell you             |
| `tracert` is very slow          | This is normal; it can take 30 seconds | `tracert 1.1.1.1 8` (fewer hops)            |
| Canvas is empty                 | No command has been run yet            | `dig facebook.com`                          |
| Terminal is too small           | It was resized earlier                 | **Double-click** the grip                   |
| Output has scrolled upward      | Terminal is too small                  | Drag the grip to make it larger             |

> 🔑 **Most common problem: browser cache.** Whenever you change the code, you need to press **`Ctrl+Shift+R`** for the changes to appear. A normal refresh (`F5`) is not enough.

---

## Part 11 · Project structure — what each file does

```text
zero-dep/
├── run.js                    ← FILE USED TO RUN THE APP
├── verify-zero-dep.js        ← zero-dependency proof
├── package.json              ← "dependencies": {} (empty)
│
├── src/                      ═══ SERVER (Node) ═══
│   ├── server/               HTTP server, routes, SSE
│   ├── proto/
│   │   ├── dns.js            ⭐ DNS codec — bytes ↔ object
│   │   └── dns-client.js     Sends real packets over UDP
│   ├── sys/
│   │   ├── exec.js           🛡️ Safely runs OS commands
│   │   ├── netinfo.js        Parses ipconfig/arp/route
│   │   ├── ping.js           Parses ping (3 platforms)
│   │   └── trace.js          Parses traceroute
│   ├── api/                  Handler for every endpoint
│   └── shared/
│       ├── bytes.js          Reader/Writer, hex helpers
│       ├── explain.js        ⭐ Meaning of every field (edit text here)
│       └── narrate.js        ⭐ Narration lines (here too)
│
├── web/                      ═══ BROWSER ═══
│   ├── index.html            Page structure
│   ├── css/                  theme.css (colors) + app.css (layout)
│   └── js/
│       ├── main.js           Connects everything
│       ├── state.js          60-line store (instead of React)
│       ├── term/             ⭐ Terminal + COMMANDS (add new commands here)
│       ├── viz/              Canvas, animation
│       └── inspect/          Tree, hex, bits, ⭐ editor
│
├── test/                     174 tests + fixtures
└── docs/                     Complete plan (00 through 07)
```

**If you want to change text, you only need two files:**

* `src/shared/explain.js` — field explanations
* `src/shared/narrate.js` — timeline narration

**If you want to add a new command:**

* `web/js/term/commands.js` — add an entry to the `COMMANDS` object

---

## Part 12 · What has been built so far

| Chapter                | Status      | Commands                                  |
| ---------------------- | ----------- | ----------------------------------------- |
| 01 · YOUR_OWN_NETWORK  | ✅ **Done**  | `ifconfig` `arp` `route` `netstat` `ping` |
| 02 · NAMES_TO_NUMBERS  | ✅ **Done**  | `dig` `resolvers` + **byte editor**       |
| 03 · FINDING_THE_PATH  | ✅ **Done**  | `tracert` (live)                          |
| 04 · RELIABLE_OR_FAST  | ⬜ Remaining | —                                         |
| 05 · THE_LOCK          | ✅ **Done**  | `tls` + SNI swap                          |
| 06 · ASKING_FOR_A_PAGE | ⬜ Remaining | —                                         |
| 07 · THE_FULL_JOURNEY  | ⬜ Remaining | —                                         |
| 08 · IT_WAS_LAYERS     | ⬜ Remaining | —                                         |

**Already built:** 174 tests, 0 dependencies, byte editor, live traceroute, 4 zoom levels, terminal, and canvas.

**Still remaining:** Chapters 4–8, lesson engine (actual Story/Do It/Real Bytes content), `build.js` (single-file bonus), README, STDLIB.md, and demo video.

> ⚠️ **Note:** Chapters 4–8 are visible in the sidebar, but their content does not exist yet.
> If you click them, the layout will change, but there will be no lesson. They will be built in the next blocks.

---

## Part 13 · Cheat sheet for the demo

Use this exact sequence when recording the video:

```text
1.  ifconfig                    "this is my actual laptop"
2.  arp                         "this is someone's phone on my Wi-Fi"
3.  dig facebook.com            "28 bytes just went out"
4.  [press 3]                   tier 3 — show the hex
5.  Click QTYPE                show the explanation box
6.  0 0 → 1 c                  "QTYPE changed, but it hasn't been sent yet"
7.  r                           🔥 face:b00c IPv6
8.  dig facebook.com            fresh request
9.  Click ID, 7f 3e, r          🔥 REJECTED
10. tracert 1.1.1.1 8           live hops + silent router
11. tls medium.com --no-sni     server rejects it
12. tls medium.com --sni discord.com    🔥 Discord certificate
13. node verify-zero-dep.js     🏆 ZERO DEPENDENCY VERIFIED
```

**For recording:** Do not make the browser window smaller than **1440px** — below 1100px, the sidebar gets hidden.

---

## Part 14 · What's next

Tell me:

| Say             | I will do                             |
| --------------- | ------------------------------------- |
| `block 9`       | HTTP + full journey (Ch 6 + Ch 7)     |
| `block 10`      | Ch 4 (TCP/UDP) + Ch 8 (layers)        |
| `lesson engine` | Actual Story/Do It/Real Bytes content |
| `readme`        | README + STDLIB.md + dependency proof |
| `build`         | Single-file build (+10 bonus)         |

---


