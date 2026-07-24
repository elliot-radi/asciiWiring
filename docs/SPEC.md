# Specification — wiring table language & v1 semantics

**Status:** draft, normative for **electrical** table language.  
**Companions:** [ARCHITECTURE.md](ARCHITECTURE.md), [GLYPHS.md](GLYPHS.md),
[STATUS.md](STATUS.md), [LAYOUT.md](LAYOUT.md),
[rfc/000-electrical-model-and-pipeline.md](rfc/000-electrical-model-and-pipeline.md),
[rfc/001-layout-sidecar-and-hitl.md](rfc/001-layout-sidecar-and-hitl.md)

This document defines the **author-facing electrical language** (the Markdown
connectivity table) and the **meaning** a correct tool must preserve when
drawing. It does **not** mandate character coordinates. Geometry lives outside
the table (bootstrap `spine-v1` today; nested layout sidecar next — see
[LAYOUT.md](LAYOUT.md) for the schema contract, rfc/001 for workflow, and
`examples/layout02.yaml` sketch; not CLI-loaded yet).

Art may vary so long as topology, labels, and diagram conventions are satisfied.

---

## 1. Goals

1. Represent module-level electrical connectivity without geometry.
2. Stay readable as documentation on its own (even without art).
3. Be easy for humans and LLMs to edit iteratively.
4. Give the **tool** enough structure to build glyphs and routes (bus / branch /
   multi-net passive diagrams).
5. Leave room for presentation and placement later **without** breaking table meaning.

## 2. Non-goals (language)

- Expressing pixel/column coordinates **in the connectivity table**
  (a separate layout document may hold placement; see rfc/001).
- Full schematic symbols (op-amps, transistor guts, etc.).
- Netlists for EDA import as a primary goal (export adapters are future).
- Suspending electrical meaning in favour of arbitrary drawing commands.

---

## 3. Document shape

A wiring document is Markdown. The renderer looks for:

1. **One primary connectivity table** (required).
2. Optional **abbreviation footnotes** after the table.
3. Optional prose before/after (ignored by the renderer except footnotes).

Future: optional YAML frontmatter, component-spec metadata, and/or a **sibling
layout file** for placement (nested glyph dossiers: box `x`/`y` and face-banked
pin lists; later passive axis, layout-only groups, boundary alignment,
presentation profiles). Layout must **not** change electrical meaning of the
table. Pin names in a layout dossier are the same tokens as table cells; census
must match. See ARCHITECTURE, HITL, GLYPHS, and the unwired
`examples/layout02.yaml` sketch.

### 3.1 Table geometry

```markdown
| Signal    | CompA | CompB | CompC |
|-----------|-------|-------|-------|
| NET_NAME  | pin   | pin   |       |
| °VCC      | 3V3   | VCC   | x     |
```

| Part | Role |
|------|------|
| Column 0 header | Signal / net name column (fixed label; exact header text may be `Signal` or synonym — v1 accepts `Signal`) |
| Other headers | **Component** display names → box titles |
| Each body row | Exactly one **net** (electrical node) |
| Cell | Incidence of that component on that net |

Separator rows (`|---|---|`) are required per normal GitHub-flavoured Markdown tables.

### 3.2 Multiple tables

**v1:** first table in the file wins (or the only table).  
**Later:** named tables / multi-page — see ROADMAP. Spec reserves the
right to select tables by heading or frontmatter without changing row
semantics.

---

## 4. Nets

### 4.1 Identity

- Each row defines one net.
- Net **display name** is the text in column 0, after stripping the floating marker.
- All non-empty cells on a row are **the same electrical node**.

### 4.2 Floating marker (`°`)

| Form | Kind | Meaning |
|------|------|---------|
| `BUTTON` | **Fixed** | Prefer explicit wire art between incidences |
| `°3.3V`, `°GND` | **Floating** | Renderer **may** use a free label instead of tracing a full home-run |

Rules:

- `°` is a **rendering hint + net kind**, not part of the electrical name.
- Canonical net id for IR: name without `°`, case-sensitive as authored.
- Floating does **not** mean “not connected”; it means “need not fully route.”
- A renderer **may** still draw fixed-style wires for floating nets when convenient (e.g. short OLED VCC–3V3 run).

### 4.3 Empty nets

Rows with no incidences are reserved / ignored. v1 may warn.

### 4.4 Duplicate net names

**v1:** illegal; renderer should error.  
Do not merge rows implicitly.

---

## 5. Components

- One column = one component instance.
- Header text = default box label (after abbreviation expansion for display if desired).
- A short refdes header such as `R1`, `NTC1`, or `TB1` is legal; it is still
  just the component instance identity in v1. The target refdes/spec metadata
  convention is documented in GLYPHS, but its side-table grammar is not yet
  normative or parsed.
- Column order is an **authoring** order; layout may reorder within policy limits (v1: try to respect bus column order left-to-right).

### 5.1 Abbreviations

Optional block after the table:

```text
Abbreviations:
  ESP32-C3 ≝ "ESP32-C3 SuperMini Zero rev1.41"
  OLED     ≝ "0.96\" SSD1306 OLED module"
```

| Concern | v1 behaviour |
|---------|----------------|
| Parsing | Lines `NAME ≝ "full name"` under an `Abbreviations:` header |
| Art labels | Prefer **short** header names in boxes (compact) |
| Docs | Full names remain in footnotes for humans |
| Future | Could tooltips / dual labels — presentation only |

---

## 6. Cells (incidences)

A cell describes how a component participates in a net.

| Cell value | Kind | Meaning |
|------------|------|---------|
| *(empty / whitespace)* | none | Not on this net |
| `x` or `X` | **anonymous terminal** | Port without a pin label (typical passive end) |
| any other non-empty text | **named pin** | Port label shown on the box (e.g. `GPIO8`, `SDA`, `(NO)`) |

### 6.1 Named pins

- Drawn as text inside the component box, associated with a port on a chosen side.
- Leading/trailing spaces trimmed.
- Case preserved.
- v1 does not interpret electrical type from the name.

### 6.2 Anonymous terminals (`x`)

- Used when a component participates in a net but has **no pin name** to print
  (typical two-terminal passives: resistor, diode, jumper, ferrite bead).
- `x` is an **unlabeled port**, not a special “bridge” operator and not a wire.
- A component with `x` on two different nets has **two ports on two nets**;
  its body is the only connection between those nets through that part.
- `x` does not appear as pin text inside the box; the **component name**
  carries identity (`10kΩ`).
- Do **not** read `x` as “splice this wire.” The nets stay distinct;
  the passive sits **between** them.

### 6.3 Reserved / future cell forms

These are **not** v1 requirements. Parse should fail soft or hard later; for now, treat unknown syntax carefully:

| Possible future cell | Intent |
|----------------------|--------|
| `x:A` / `1` / `2` | Named anonymous terminals (ordered leads) |
| `GPIO5@R` | Pin side hint (`L/R/T/B`) — presentation |
| `GPIO5!` | Highlight / important pin — presentation |
| `*SDA` | Bus member marker for folded bus draw — presentation/layout |
| `GND[2]` | Multi-pin same net on one component |

v1 authors must avoid decorating pin names with magic suffixes until specified.

### 6.4 Multiple pins same component/net

**v1:** one cell string per component per net. If a module has two pins on one net (e.g. dual GND), either:

- pick one representative pin for the diagram, or
- later use an explicit multi-pin form (ROADMAP).

Do not encode two labels in one cell with commas in v1 (undefined).

---

## 7. Graph meaning (electrical model)

**IR** means **intermediate representation**: the structured netlist the
renderer builds after parse and before layout/paint. “Electrical IR” =
that netlist (components, nets, ports) — not coordinates, not glyphs.

Informal but normative intent:

- **Net** = hyperedge over ports (one electrical node).
- **Port** = (component, pinLabel | anonymous, net).
- Connectivity is undirected.
- A multi-net passive contributes **one port per net it lists**; it does
  **not** merge those nets into one node. Current flows through the part
  only in the real circuit; the diagram must show two distinct nets
  meeting the part’s two terminals.

This is *not* an edge list of component→component links. `I2C DATA` joining
ESP32 and OLED is one net with two ports, not a single directed arrow.

---

## 8. Component roles (classification)

Roles are **derived**, not authored (v1). They guide bootstrap placement and
hints for humans; misclassification must not change the electrical model.

| Role | Typical rule (v1 heuristic) | Layout intent |
|------|----------------------------|---------------|
| **Bus** | ≥2 named pins on fixed nets (modules on the spine) | Horizontal backbone, shared nets as channels |
| **Branch** | Named pin(s) on ~1 primary net; hangs off a stem | Vertical drop below/aside backbone |
| **Passive** | Anonymous `x` on ≥2 **distinct** nets | Small body with one terminal lead per net (e.g. pullup R) |
| **Other** | Degenerate / future | Stable fallback: treat as small branch |

Notes:

- Prefer the name **passive** (not “bridge”). “Bridge” invites the wrong
  picture of a wire splice or a net that merely “passes through” a box.
- A component can share floating nets freely without forcing bus membership.
- Rules are heuristics; fixtures lock expected choices for `table01`.
- Future: optional stereotype via frontmatter map — not in-table (preferred).

---

## 9. Rendering semantics (acceptance)

Exact glyphs and coordinates are **not** part of the electrical guarantee.
Given a netlist (and, when present, a layout), a render is acceptable when a
knowledgeable human agrees that:

1. **Every named pin** appears labeled on its component box.
2. **Every fixed net** with ≥2 routed ports shows a continuous connection
   (wires + joins) or an equally clear multi-drop convention.
3. **Passives** show a terminal relationship into **each** net they touch;
   they must not look like a single net wire broken and continued through
   the body (unless the table truly puts both ends on the same net — unusual).
4. **Floating nets** are either wired like fixed or labeled at leaves
   (e.g. `GND` under a button) without lying about isolation.
5. **Boxes** don’t overwrite each other; wires use box-drawing characters
   with joins/crossings per §9.2 and port markers (default `●`).
6. Output is monospaced-stable (no tabs required for alignment).

**Non-requirements (v1):**

- Byte-identical to `examples/art01.md`
- Optimal wire length
- Zero cosmetic crossings when topology forces awkwardness
- Matching author table row order in the drawing

### 9.1 Default glyph profile (`classic`)

HITL **chrome vocabulary** (pin, stub, elbow, face, cell, junction, …):
[GLYPHS.md](GLYPHS.md) § Chrome vocabulary. This section is the electrical
paint alphabet only.

v1 ships one paint profile:

| Element | Default |
|---------|---------|
| Box corners/edges | `┌┐└┘─│` |
| Port marker on box edge | `●` |
| Wire H/V | `─│` |
| Join tees (same net) | `├┤┬┴` |
| Same-net four-way join | `┼` (rare; only when four arms of **one** net meet) |
| Insulated hop (different nets cross) | `\` |
| Free net label | plain text at wire end |

Future profiles may swap port markers (`○`, `▸`, `┊`), double-line buses,
or ASCII-only (`+`, `-`, `|`) — **paint only**, same electrical model. See ROADMAP.
`ascii7` may use `X` for hop and `+` for join if box-drawing is unavailable.

### 9.2 Joins vs crossings

These are easy to confuse in sketch art. They are **not** the same.

| Concept | Meaning | Glyph(s) |
|---------|---------|----------|
| **Join** (tee / star) | Two or more wire ends meet and are the **same net** | `├┤┬┴`; `┼` only for a true 4-way **join** |
| **Hop** (insulated cross) | Two **different** nets pass through one cell without connecting; neither turns | `\` in that cell; `─` / `│` continue on either side |

**Rule of thumb:** `┼` always means *electricity joins*. If the nets are
different, never paint `┼` — paint a hop or re-route.

Layout may still prefer routes that avoid hops when cheap, but hops are a
**first-class paint result**, not a failure. Branch stems that drop past
horizontal bus runs (GND/3V3/I2C) are the usual case.

**Join example** — one net with three ports (MCU, button, resistor terminal):

```
●───┬───●     same net left–right, third port down
    │
    ●
```

**Hop example** — BUTTON stem drops past backbone power (different nets):

```
│                     GPIO5   ●───┐     │
│                     GND     ●───\─────● GND
│                     3V3     ●───\─────● VCC
└─────────────────────────────┘   │     └─────
                                  │
```

Read `\` as “continue straight; no connection; no turn.” The vertical stem
and the horizontal net both keep going. Do **not** draw that as `┼`.
(Why `\`, not blank or `┼`: blank breaks the stroke; `┼` lies about connectivity.)

Wrong (reads as four-way joins on GND and 3V3):

```
│                     GND     ●───┼─────● GND
│                     3V3     ●───┼─────● VCC
└─────────────────────────────┘   │
```

**Pullup shape (join + second net)** — BUTTON stem stays continuous; 10kΩ
tees off beside it toward 3.3V:

```
         │            3.3V
         │             │
         │          ┌──┴──┐
         ├──────────┤ 10kΩ│   ├ = join on BUTTON
         │          └─────┘
         │
      (button)
```

**Passive body rule:** a two-net passive is drawn as a **regular box with two
leads**, one into each net. Alternate glyph profiles may later use a symbol,
but the current component convention is box-first (GLYPHS). It is incorrect
to draw the primary net as a single vertical that enters the top of the
passive and exits the bottom
with only a side stub for the other rail — that reads as “series insert on
the stem,” which is the old `art01` mistake.

### 9.3 Glyph decision at a wired cell

When paint resolves a cell that more than one segment wants:

| Occupancy | Same net? | Glyph |
|-----------|-----------|-------|
| 2 arms, one line (H or V only) | — | `─` or `│` |
| 3 arms | yes | tee `├┤┬┴` matching the missing side |
| 4 arms | yes | `┼` |
| H + V through-cell | **no** (two nets) | hop `\` |
| H + V, one net turning into the other | impossible electrically | layout bug |
| Segment ending into another net mid-wire | no | layout bug (must tee only on same net) |

Hop orientation: v1 uses a single character `\` regardless of which net was
routed first. Future profiles may offer `/` or a pair of over/under marks;
authors must not rely on slash direction as electrical meaning.

---

## 10. Error handling (v1 expectations)

| Condition | Behaviour |
|-----------|-----------|
| No table | Hard error |
| Duplicate net names | Hard error |
| Empty component header | Hard error |
| Component with zero incidences | Warn; omit or draw empty stub (prefer omit) |
| Passive with `x` on one net only | Warn; treat as ambiguous / incomplete |
| Unknown footnote noise | Ignore |
| Conflicting layout pressure | Best-effort art + optional stderr note |

---

## 11. Fixture: `table01` expectations

Input: `examples/table01.md`. Reference visual: `examples/art01.md`.

| Component | Expected role |
|-----------|----------------|
| ESP32-C3 | Bus |
| OLED | Bus |
| BUTTON | Branch on `BUTTON` net (and floating GND label) |
| 10kΩ | Passive with terminals on `BUTTON` and `3.3V` |

| Net | Kind | Draw intent |
|-----|------|-------------|
| I2C DATA / I2C CLOCK | Fixed | Horizontal between MCU and OLED |
| BUTTON | Fixed | Stem MCU → tee → button; tee also feeds 10kΩ terminal |
| 3.3V / GND | Floating | Backbone runs OK when easy; free labels OK at button/pullup |

Pin spelling in art follows the **table**. Renderer must not “correct”
`SCK`→`SCL` or similar. When reference art and table disagree, fix the art
or the table — table wins for generator output.

---

## 12. Versioning

- **Table language v1** is what this file describes.
- Additive cell forms and frontmatter keys get new subsections; old tables must keep rendering.
- Breaking changes require a language version note in frontmatter (`awg: 1`) once packaging begins.

---

## 13. Open questions (do not block v1)

1. Should floating `°` also suppress backbone painting by default?
2. Pin order inside a box: table row order vs electrical convention (power top/bottom)?
3. Are headers other than `Signal` accepted (`Net`, `Node`)?
4. Unicode Ω in component names (yes for art; ensure UTF-8 stdout).

Decisions land here when settled; until then implementers follow fixtures.
