# RFC 002: Table01 rendering rationale

**Date:** 2026-04 (retroactive)
**Status:** Accepted

## Context

The first fixture (`examples/table01.md`) — ESP32-C3 + OLED + button +
pullup resistor — was the test case for the entire pipeline. This RFC
records the algorithmic and placement reasoning that produced the first
output, so later fixtures can be evaluated against the same principles
without re-litigating them in code comments.

## Fixture

**Table:**

| Signal | ESP32-C3 | OLED | BUTTON | 10kΩ |
|--------|----------|------|--------|------|
| I2C DATA | GPIO8 | SDA | — | — |
| I2C CLOCK | GPIO9 | SCK | — | — |
| BUTTON | GPIO5 | — | (NO) | x |
| °3.3V | 3V3 | VCC | — | x |
| °GND | GND | GND | GND | — |

**Components:** `ESP32-C3`, `OLED`, `BUTTON`, `10kΩ`

## Classification evidence

| Component | Role | Evidence |
|-----------|------|----------|
| ESP32-C3 | **Bus** | Named pins on multiple fixed nets (I2C + BUTTON) |
| OLED | **Bus** | Named pins on multiple nets (I2C fixed; power floating) |
| BUTTON | **Branch** | Primary named signal pin `(NO)` on BUTTON net; GND floating leaf |
| 10kΩ | **Passive** | `x` on two **different** nets (BUTTON and 3.3V); no pin labels |

The 10kΩ passive is **not** a series insert on the BUTTON wire. It is a
two-terminal component: one anonymous terminal on net BUTTON, one on net
3.3V. The BUTTON net stays continuous from MCU → tee → button. The
resistor hangs off a tee on BUTTON with its other end landing on 3.3V.

## Channel order rationale

Table order need not be drawing order. A compact spine-friendly order was
chosen:

1. `3.3V` (floating) — upper power for OLED run + pullup far end
2. `GND` (floating) — near power
3. `I2C DATA` (fixed)
4. `I2C CLOCK` (fixed)
5. `BUTTON` (fixed) — edge channel for vertical branch drop

Rationale: shared backbone nets contiguous; branch stem low on the MCU
box so the drop does not cross I2C.

## Placement geometry rules applied

- Bus boxes share vertical pitch for common nets (aligned `●────●`).
- Gap between buses is horizontal wire run only (no component).
- GPIO5 opens an eastbound stem; the **vertical stem is net BUTTON** and
  stays continuous MCU → button.
- At a tee-join (`├`) on BUTTON, a horizontal lead goes to the 10kΩ
  terminal on BUTTON; the other 10kΩ terminal goes up to 3.3V.
- The 10kΩ box sits **beside** the stem (not in series on it).
- BUTTON box centered on the stem; south exit to GND label.

## Wiring obligations

| Net | Must show |
|-----|-----------|
| I2C DATA | Continuity MCU GPIO8 ↔ OLED SDA |
| I2C CLOCK | Continuity MCU GPIO9 ↔ OLED SCK |
| BUTTON | Continuity MCU GPIO5 ↔ BUTTON (NO), plus tee to 10kΩ terminal on BUTTON |
| 3.3V | OLED VCC tied visibly, plus other 10kΩ terminal on 3.3V |
| GND | OLED GND tied; BUTTON south GND label acceptable |

## Joins vs hops in this fixture

`art01` routes the BUTTON stem off the east face *below* the power runs,
so no hop appears. If a layout wants GPIO5 between power pins with the
stem dropping through GND/3.3V rows, paint hops (`\`) are required.
`┼` must never be used for different-net crossings (looks like a short).

## Implementation order (historical)

1. Parse + dump electrical model (IR) for table01
2. Classify + assert roles above (10kΩ → passive)
3. Place two bus boxes + aligned I2C ports + H wires only
4. Add GPIO5 stem + BUTTON box + V wire on BUTTON net
5. Add 10kΩ **beside** the stem with tee into BUTTON + lead to 3.3V
6. Add GND free label / power H wires
7. Freeze `golden01.md`

A correct backbone alone (step 3) is already valuable. The full fixture
was built incrementally with IR acceptance checks at each step.

## Related

- rfc/000-electrical-model-and-pipeline.md — founding electrical rules
- docs/SPEC.md — normative table language and paint rules
- docs/GLYPHS.md — drawing conventions for ports and passives
