# Lesson & lab screenshots

Captured from the running app at 1280×820, against live traffic — the DNS
timings in them are from real queries made during capture.

| File | Shows |
|---|---|
| `lesson-story-ch2.png` | Chapter 2 at the **Story** depth — beats revealed one at a time, the ASCII diagram, and the hand-off to the first real command |
| `lesson-doit-ch2.png` | Chapter 2 at the **Do it** depth — numbered steps, a ticked step, and the measured chips (`14.3 ms`, `30 B` out, `46 B` back) |
| `inspector-bytes-ch2.png` | Chapter 2 at the **Real bytes** depth — field tree, field explanation, hex dump, bit ruler and byte editor, all driven by one parse |
| `lab-parity.png` | The 2-D parity lab with four corners of a rectangle flipped: *every parity still passes — the damage is invisible* |
| `lab-arq.png` | The sliding-window lab — a Go-Back-N ladder, and all three protocols compared over identical losses |

To recapture, run the app (`node run.js`) and drive the UI; nothing here is
generated or mocked up.
