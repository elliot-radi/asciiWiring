# Walkthrough: `table01` → art (spine-v1 intent)

This freezes algorithm discussion against the first fixture so implementation
doesn’t re-litigate placement in code comments only.

**Inputs:** `examples/table01.md`  
**Visual reference:** `examples/art01.md`  
**Normative language:** [SPEC.md](SPEC.md)

---

## 1. Parsed nets & components

**Components (columns):** `ESP32-C3`, `OLED`, `BUTTON`, `10kΩ`

| Net | Floating | ESP32-C3 | OLED | BUTTON | 10kΩ |
|-----|----------|----------|------|--------|------|
| I2C DATA | no | GPIO8 | SDA | — | — |
| I2C CLOCK | no | GPIO9 | SCK | — | — |
| BUTTON | no | GPIO5 | — | (NO) | x |
| 3.3V | yes | 3V3 | VCC | — | x |
| GND | yes | GND | GND | GND | — |

Pin labels in art must match the table (`SCK`, not a synonym).

---

## 2. Classification (layout roles)

| Component | Role | Why |
|-----------|------|-----|
| ESP32-C3 | **bus** | Named pins on multiple fixed nets (I2C + BUTTON) |
| OLED | **bus** | Named pins on multiple nets (I2C fixed; power floating — still a spine module) |
| BUTTON | **branch** | Primary named signal pin `(NO)` on BUTTON net; GND floating leaf |
| 10kΩ | **passive** | `x` on two **different** nets (BUTTON and 3.3V); no pin labels |

### Passive electrical meaning (important)

`10kΩ` is **not** “part of the BUTTON wire.” It is a two-terminal component:

- one anonymous terminal on net **BUTTON**
- one anonymous terminal on net **3.3V**
- its **body** is the only path between those two nets through this part

So the BUTTON net must remain continuous from MCU → tee → button.
The resistor hangs **off a tee** (or sits beside a short stub) on BUTTON, and
its other end lands on 3.3V — not as a series splice on the stem.

Wrong mental model (series on BUTTON):

```
  GPIO5 ──┤10kΩ├── BUTTON (NO)    ← implies BUTTON net was cut and R inserted
```

Right mental model (pullup between two nets):

```
  GPIO5 ──────┬──────── BUTTON (NO)
              │
             10kΩ
              │
             3.3V
```

---

## 3. Suggested channel order (art rows)

Table order need not be drawing order. A compact spine-friendly order:

1. `3.3V` (floating) — upper power for OLED run + pullup far end
2. `GND` (floating) — near power
3. `I2C DATA` (fixed)
4. `I2C CLOCK` (fixed)
5. `BUTTON` (fixed) — edge channel for vertical branch drop

Rationale: shared backbone nets contiguous; branch stem low on the MCU box
so the drop doesn’t cross I2C.

---

## 4. Placement sketch

Canonical compact form (`examples/art01.md`):

```
 ┌────────────────┐         ┌────────────────┐
 │  ESP32-C3      │         │  SSD1306 OLED  │
 │                │         │                │
 │          3V3   ●─────────● VCC            │
 │          GND   ●─────────● GND            │
 │        GPIO8   ●─────────● SDA            │
 │        GPIO9   ●─────────● SCK            │
 │                │         └────────────────┘
 │        GPIO5   ●───┐
 └────────────────┘   │
                      │            3.3V
                      │             │
                      │          ┌──┴──┐
                      ├──────────┤ 10kΩ│
                      │          └─────┘
                      │
                 ┌────┴───┐
                 │ BUTTON │
                 │  (NO)  │
                 └────┬───┘
                      │
                     GND
```

### Geometry rules applied

- Bus boxes share vertical pitch for common nets (aligned `●────●`).
- Gap between buses is horizontal wire run only (no component).
- GPIO5 opens an eastbound stem; the **vertical stem is net BUTTON** and
  stays continuous MCU → button.
- At a **tee-join** (`├`) on BUTTON, a horizontal lead goes to the 10kΩ
  terminal on BUTTON; the other 10kΩ terminal goes up to 3.3V.
- The 10kΩ box sits **beside** the stem (not in series on it).
- BUTTON box centered on the stem; south exit to GND label.

---

## 5. Wiring obligations

| Net | Must show |
|-----|-----------|
| I2C DATA | Continuity MCU GPIO8 ↔ OLED SDA |
| I2C CLOCK | Continuity MCU GPIO9 ↔ OLED SCK |
| BUTTON | Continuity MCU GPIO5 ↔ BUTTON (NO), plus a tee to the 10kΩ terminal on BUTTON |
| 3.3V | OLED VCC tied to 3V3 visibly **or** free labels; **and** the other 10kΩ terminal on 3.3V |
| GND | OLED GND tied; BUTTON south GND label OK |

---

## 6. Joins vs hops (paint)

| Situation | Glyph idea | Same net? |
|-----------|------------|-----------|
| Stem splits toward button **and** toward 10kΩ | tee `├` `┤` `┬` `┴` | **yes** — electrical join |
| Four-way join of one net | `┼` (rare) | **yes** |
| BUTTON vertical must pass a *different* net’s horizontal run | insulated hop `\\` | **no** |

`art01` currently routes the BUTTON stem off the east face *below* the power
runs so no hop appears. That is still good. If a layout wants GPIO5 between
power pins with the stem dropping through GND/3V3 rows, paint hops:

```
│        GPIO5   ●───┐
│          GND   ●───\─────● GND
│          3V3   ●───\─────● VCC
└────────────────┘   │
```

Never use `┼` for that (looks like a short). See SPEC §9.2–9.3.

---

## 7. Paint notes

- Port glyph: `●` on box border cells for named module pins.
- Passive body: small box titled `10kΩ` with leads to each net’s terminal
  (no pin text inside for `x` ports).
- Do **not** invent “(optional)” in v1 unless a notes field exists later.

---

## 8. Implementation order recommendation

1. Parse + dump electrical model (IR) for `table01`
2. Classify + assert roles above (`10kΩ` → passive)
3. Place two bus boxes + aligned I2C ports + H wires only
4. Add GPIO5 stem + BUTTON box + V wire on BUTTON net
5. Add 10kΩ **beside** the stem with tee into BUTTON + lead to 3.3V
6. Add GND free label / power H wires
7. Freeze `golden01.md`

Stop after step 3 if needed — a correct backbone alone is already valuable.
