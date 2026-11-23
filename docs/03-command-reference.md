# Receiver command and file protocol

These reference tables come from the bridge used with the AVC-X3800H. Review
[src/bridge.c](../src/bridge.c) when adding a command so the request validator and
before-state/readback flow remain consistent. The receiver address is set locally
through FLEX_DENON_HOST.


### 5.4 Request format and validation

A request is a file `request` in the RAM folder with exactly two lines:

```
<id>\n
<operation>\n
```

- `<id>` is `<milliseconds since epoch>-<random>` (only digits and `-`, up to 39 characters). The launcher
  creates it with `Date.now()` and `Math.random()`.
- The file must be a regular file, owned by uid 10009, with a size of 1 to 254 bytes; it is opened with
  `O_NOFOLLOW|O_NONBLOCK`. Anything else is ignored.
- **Expiry:** the millisecond part of the id is compared with the TV clock. If it differs by more than
  25 s, the request is answered with "Auftrag abgelaufen" (request expired) and not executed. This protects
  against a request that sat in the folder while the bridge was down or the UI had already given up.

  Side effect found on 15 Nov: the TV clock was about 20 hours ahead, so requests from the PC tool were
  all rejected as expired. Requests from the TV itself were unaffected because they use the same clock.
- Same id as the last handled request: ignored.

Operations:

| Operation | Effect |
|---|---|
| `STATUS` | Snapshot of the receiver state over TCP 23; no write. |
| `SOURCES` | Snapshot plus the three HTTP XML documents (input assignment, names, current video). |
| `LABEL<n> <text>` | Store a display name for receiver HDMI input `n` (1..6) on the TV. Does not touch the receiver. |
| an allow-listed receiver command | Journal, send, wait, read back. |

### 5.5 Allowed receiver commands

Fixed strings:

| Group | Commands |
|---|---|
| Main zone power | `ZMON`, `ZMOFF` |
| Zone 2 | `Z2ON`, `Z2OFF`, `Z2GAME1` |
| Main input | `SIGAME1`, `SITV`, `SIBD`, `SIMPLAY`, `SISAT/CBL`, `SIAUX1`, `SIAUX2` |
| Mute | `MUON`, `MUOFF` |
| Sound mode | `MSSTEREO`, `MSDIRECT`, `MSPURE DIRECT`, `MSDOLBY AUDIO-DSUR`, `MSDTS NEURAL:X` |
| Tone control | `PSTONE CTRL ON`, `PSTONE CTRL OFF` |
| Audyssey | `PSDYNEQ ON/OFF`, `PSDYNVOL OFF/LIT/MED/HEV`, `PSMULTEQ:AUDYSSEY`, `PSMULTEQ:BYP.LR`, `PSMULTEQ:FLAT`, `PSMULTEQ:OFF` |

Parameterised commands, checked character by character:

| Pattern | Rule | Meaning |
|---|---|---|
| `MVxx` / `MVxx5` | 2 digits, or 3 digits ending in `5`; value ≤ 80.0 | Master volume in 0.5 steps (80 = 0 dB) |
| `PSBAS xx`, `PSTRE xx` | exactly 2 digits, 44..56 | Bass/treble, 50 = 0 dB, ±6 dB |
| `CV<ch> xx` / `CV<ch> xx5` | channel in `FL FR C SW SW2 SW3 SW4 SL SR SBL SBR FHL FHR TFL TFR TML TMR TRL TRR`; 38.0..62.0 in 0.5 steps; nothing after the value | Channel level, 50 = 0 dB, ±12 dB |

Extra rule for `CV`: the bridge only writes a channel level if the receiver reported that channel in the
before-snapshot ("Kanal nicht vom Receiver gemeldet" otherwise). The settings page likewise lists only
reported channels.

The command set is taken from the public "Denon CY2022 AVR Control Protocol Ver.02", which explicitly
covers the AVC-X3800H; the commands and replies were also read on the real receiver.

### 5.6 Snapshot

A snapshot sends these 13 queries over one TCP connection (each terminated with `\r`) and collects all
replies into one text block:

```
ZM?  Z2?  SI?  MV?  MU?  MS?  CV?  PSTONE CTRL ?  PSBAS ?  PSTRE ?  PSDYNEQ ?  PSDYNVOL ?  PSMULTEQ: ?
```

After each query the bridge reads until there has been no data for 220 ms (at most 20 rounds). A snapshot
is only valid if it contains a `ZM` and an `SI` line. One snapshot takes roughly 3 s, and one full write
(before-snapshot, command, 1.5 s wait, after-snapshot) about 8 s. That latency drives a lot of the UI
design: the user can press several keys while one command is in flight.

### 5.7 Write flow and before-state journal

```
connect TCP 23 (2 s timeout)
  └─ snapshot "before"                       fail → "Status konnte nicht gelesen werden"
       └─ CV only: channel present in before? fail → "Kanal nicht vom Receiver gemeldet"
            └─ write /APPS/flexdenon/history/<id>.txt = before (atomic)
                                             fail → "Sicherung fehlgeschlagen; nichts geaendert"
                 └─ send "<command>\r"       fail → "Senden fehlgeschlagen; Zustand pruefen"
                      └─ sleep 1.5 s
                           └─ snapshot "after"  fail → "Ruecklesen fehlgeschlagen; Zustand pruefen"
                                └─ verified = "after" contains a line exactly equal to <command>
                                     no → "Zielwert nicht bestaetigt (Modus/CEC pruefen)"
```

- Files are written atomically: `<path>.new` with `O_CREAT|O_EXCL|O_NOFOLLOW`, mode 0600, `write`,
  `fsync`, `rename`.
- The journal lives on persistent storage (`/APPS/flexdenon/history/`, 10009 0700). It holds the
  receiver's state for the implemented functions only; it is **not** a full receiver configuration backup.
- `LABEL` requests journal the old name as `history/<id>-label.txt` before writing
  `/APPS/flexdenon/labels/<n>`. Labels are limited to 64 bytes without control characters (the on-screen
  keyboard limits them to 18 characters).
- The settings page offers "undo last single change" for the current session (it re-sends the previous
  value). Multi-step profiles are not transactions: if step 2 fails, step 1 stays.

### 5.8 Reading the input metadata (HTTP, port 11080)

`SOURCES` reads three fixed endpoints with plain `HTTP/1.0` (`Connection: close`):

| Endpoint | Content used |
|---|---|
| `/ajax/inputs/get_config?type=2` | Input assignment: for each source its HDMI connector, plus a `SelectionList` that maps the HDMI enum values to connector numbers |
| `/ajax/inputs/get_config?type=3` | Names: per source the owner's `Rename` and the receiver's `Auto` name (learned via CEC/HDMI) |
| `/ajax/info/get_config?type=3` | Current video: `Resolution/Input`, e.g. `2160p60` or `---` |

A reply is accepted only with status 200, without chunked transfer encoding, with a body that contains
`<?xml` and fits the buffer. The bridge waits up to 20 × 250 ms for data. (The first version gave up
after a single empty 250 ms interval; this was found during a TV cold-start test, see section 17.)

### 5.9 Response format

The bridge writes `response` atomically as one JSON object:

```json
{
  "id": "<request id>",
  "ok": true,
  "verified": false,
  "error": "",
  "raw": "ZMON\rSITV\rMV445\r…",
  "assign": "<?xml …>",
  "names": "<?xml …>",
  "video": "<?xml …>",
  "labels": { "1": "", "2": "Xbox One", "3": "PS5", "4": "PC", "5": "", "6": "" }
}
```

- `ok` is true when `error` is empty. `verified` is true only for a write whose target line was read back.
- `raw` is the snapshot (the after-snapshot for writes), with line breaks escaped.
- `assign`, `names`, `video` are the last successfully read XML documents; they are cleared and re-read
  only by `SOURCES`, and repeated in every answer.
- `labels` are the six files from `/APPS/flexdenon/labels/`.

Error strings (German, shown to the user as they are):

| String | Meaning |
|---|---|
| `Auftrag abgelaufen` | Request id older/newer than 25 s against the TV clock |
| `Befehl nicht erlaubt` | Not on the allow-list |
| `Ungueltige Beschriftung` | Bad `LABEL` request |
| `Beschriftung nicht gespeichert` | Label or its journal entry could not be written |
| `Receiver nicht erreichbar` | TCP connect to port 23 failed within 2 s |
| `Status konnte nicht gelesen werden` | Before-snapshot incomplete |
| `Quellen-Metadaten nicht vollstaendig erreichbar` | One of the HTTP reads failed (status is still returned) |
| `Kanal nicht vom Receiver gemeldet` | `CV` for a channel the receiver does not report |
| `Sicherung fehlgeschlagen; nichts geaendert` | Journal write failed, nothing was sent |
| `Senden fehlgeschlagen; Zustand pruefen` | Send failed; state unknown |
| `Ruecklesen fehlgeschlagen; Zustand pruefen` | Command sent, read-back failed |
| `Zielwert nicht bestaetigt (Modus/CEC pruefen)` | Command sent, receiver does not report the target value (for example a setting that is locked in the current mode) |
