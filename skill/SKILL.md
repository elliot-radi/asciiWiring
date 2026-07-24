---
name: ascii-wiring
description: Generates clean ASCII-art wiring diagrams from a signal-first connectivity table. Use when a user wants to draw a circuit block diagram showing connections between electronic modules (MCUs, sensors, displays, buttons, passives) with box-drawing characters.
---

# ASCII Wiring Diagram Skill

## Overview

LLMs struggle with ASCII art because character alignment is hard and small
changes cascade. This skill solves the problem with a **two-phase pipeline**:

1. **Signal-first wiring table** — the LLM proposes a connectivity matrix
   as a Markdown table, and the user iterates on it. The table becomes
   documentation.
2. **Renderer** — a Node.js script reads the table and produces clean
   ASCII art with box-drawing characters, auto-sized components, and
   auto-routed wires.

## The Wiring Table Format

The table is the single source of truth. It is a **connascence matrix**:
each row is an electrical net (one node), each column is a component,
and each cell is a pin name or connection marker.

### Columns

```
| Signal     | ESP32-C3 | OLED | R1 | BUTTON |
```

- First column: **Signal / net name**. Each row is one electrical node.
- Remaining columns: **Component names**. These become box labels in the
  diagram. Passives: short **`TYPENUM`** (`R1`, `C2`); put value/tolerance
  in footnotes, not the header.

### Rows

Each row is one net (electrical node). Every cell in the row is connected
to the same node.

```
| Signal     | ESP32-C3 | OLED | R1 | BUTTON |
|------------|----------|------|----|--------|
| I2C DATA   | GPIO8    | SDA  |    |        |
| I2C CLOCK  | GPIO9    | SCK  |    |        |
| BUTTON     | GPIO5    |      | x  | (NO)   |
| °3.3V      | 3V3      | VCC  | x  |        |
| °GND       | GND      | GND  |    | GND    |
```

### Cell Values

| Value | Meaning |
|-------|---------|
| `GPIO8` | Named pin on this component for this net |
| `x` | Anonymous terminal (no pin label) on this net — typical ends of a two-terminal passive. A resistor pullup has `x` on **BUTTON** and `x` on **°3.3V**; those are two ports on two nets, not a wire splice. |
| *(empty)* | Component is not connected to this net |

### Net Types

| Prefix | Type | Rendering |
|--------|------|-----------|
| *(none)* | **Fixed net** | Must be drawn as an explicit wire connecting all component pins. |
| `°` | **Floating net** | May be drawn as a label at the pin without tracing the wire back to the source. Typically power/ground rails (3.3V, GND, 5V). |

### Abbreviation Footnotes

When component names are abbreviated for diagram compactness, use a
footnote section below the table:

```
| Signal     | ESP32-C3 | OLED | ... |
|------------|----------|------|-----|
| ...        | ...      | ...  | ... |

Abbreviations:
  ESP32-C3 ≝ "ESP32-C3 SuperMini Zero rev1.41"
  OLED     ≝ "0.96\" SSD1306 OLED module"
```

## Workflow

### Step 1: User describes the circuit

> "I want to connect an ESP32-C3 to an SSD1306 OLED via I2C, with a
> pushbutton on GPIO5."

### Step 2: LLM proposes a wiring table

The LLM produces a Markdown table with the connectivity matrix, using
pin names from the component datasheets / pinout diagrams.

### Step 3: User and LLM iterate

The user reviews the table, suggests changes (add missing connections,
fix pin assignments, abbreviate long names, change net types).

### Step 4: Render to ASCII art

Run the renderer on the table:

```bash
node src/render.js table.md
node src/render.js table.md > diagram.txt
node src/render.js < table.md
```

The renderer:
1. Parses the table into an electrical model (netlist IR)
2. Auto-sizes component boxes (width from widest text, height from pin count)
3. Classifies components as bus, branch, or passive
4. Lays out the bus backbone horizontally, branches and passives off stems
5. Auto-routes wires (joins vs crossings — see below)
6. Draws floating nets as labels where wire tracing would be inconvenient

Dev path (until packaged as a skill):

```bash
node src/render.js examples/table01.md
```

### Step 5: Embed in documentation

The table and the ASCII art go into `HARDWARE.md` or similar.

## Rendering Rules

### Component Classification

The renderer classifies each component from the table:

| Type | Condition | Layout |
|------|-----------|--------|
| **Bus** | Has named pins in ≥2 fixed nets | Side-by-side horizontally (the backbone) |
| **Branch** | Has named pins in exactly 1 net | Vertical branch from that net's row |
| **Passive** | Has `x` in ≥2 *distinct* nets | Small body with a lead into **each** net (e.g. pullup). Not series-on-stem. |

### Row Ordering

The renderer may reorder table rows for routing convenience:
- Fixed nets first, grouped by shared components
- Floating nets last

The original table is preserved as-is in documentation.

### Box Sizing

- **Width**: widest string in the column (label + pin names + 4 chars padding)
- **Height**: number of pins (across all nets) + 2 rows for title + 1 row
  padding + 2 rows for borders
- Auto-sizing prevents the LLM from needing to count characters

### Wire Routing

1. **Fixed nets** between bus components: horizontal wires between facing
   pins at the same row → `●───●`
2. **Fixed nets** to branch components: horizontal wire from bus to a
   vertical drop, then down to the branch component
3. **Passives** (multi-net `x`): tee-join into net A, body, lead into net B
   (pullup between BUTTON and 3.3V proposes a tee on BUTTON, not R in series)
4. **Floating nets**: label placed at the pin (e.g., GND below the button)
   without a wire back to the source when a full home-run is awkward

### Joins vs hops

| | Meaning | Glyph |
|-|---------|-------|
| **Join** | Same electrical net branches / meets | `├┤┬┴`; rare 4-way `┼` |
| **Hop** | Different nets pass through one cell **without** connecting | `\\` |

`┼` always means a join. If nets differ, use a hop — never `┼`.

Same-net three-port join (MCU · resistor terminal · button):

```
●───┬───·     left–right and down are ONE net
    │
    ●
```

Insulated hop — branch stem drops past other nets on the backbone:

```
│                     GPIO5   ●───┐     │
│                     GND     ●───\─────● GND
│                     3V3     ●───\─────● VCC
└─────────────────────────────┘   │     └─────
                                  │
```

Wrong (looks like GND/3V3 short to the stem):

```
│                     GND     ●───┼─────● GND
│                     3V3     ●───┼─────● VCC
```

Pullup (two nets + passive body) — preferred topology
(BUTTON stem stays continuous; `R1` tees off toward 3.3V):

```
  GPIO5  ●───┐
             │            3.3V
             │             │
             │          ┌──┴──┐
             ├──────────┤ R1  │
             │          └─────┘
             │
        ┌────┴───┐
        │ BUTTON │
        │  (NO)  │
        └────┬───┘
             │
            GND
```

## Renderer Usage

```bash
# Read from stdin
node src/render.js < wiring.md

# Read from file
node src/render.js wiring.md

# Save / debug
node src/render.js wiring.md > diagram.txt
node src/render.js --debug wiring.md
```

## Example

### Input (`examples/table01.md` shape)

```
| Signal     | ESP32-C3 | SSD1306 OLED | BUTTON | R1   |
|------------|----------|--------------|--------|------|
| I2C DATA   | GPIO8    | SDA          |        |      |
| I2C CLOCK  | GPIO9    | SCK          |        |      |
| BUTTON     | GPIO5    |              | (NO)   |  x   |
| °3.3V      | 3V3      | VCC          |        |  x   |
| °GND       | GND      | GND          | GND    |      |

Abbreviations:
  ESP32-C3     ≝ "ESP32-C3 SuperMini Zero rev1.41"
  SSD1306 OLED ≝ "0.96\" SSD1306 OLED module"
  R1           ≝ "10kΩ 1/8W 5%"
```

### Output

Illustrative (see `examples/art01.md` for the checked-in reference):

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
                      ├──────────┤ R1  │
                      │          └─────┘
                      │
                 ┌────┴───┐
                 │ BUTTON │
                 │  (NO)  │
                 └────┬───┘
                      │
                     GND
```