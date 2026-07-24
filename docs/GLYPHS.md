# Glyphs: component drawing conventions

**Status:** normative contract for drawing conventions. Extends
[rfc/001-layout-sidecar-and-hitl.md](rfc/001-layout-sidecar-and-hitl.md)
and [LAYOUT.md](LAYOUT.md); normative table-language changes belong in
[SPEC.md](SPEC.md).

This doc is the home for *how the diagram looks on the character grid* — chrome
vocabulary (HITL hand-edit and art review), box shape, labeling, and composition —
as distinct from *where the box goes* (rfc/001 / [LAYOUT.md](LAYOUT.md)) or
*what's legal in the wiring table* ([SPEC.md](SPEC.md)). Place/route engine
seams stay in [ARCHITECTURE.md](ARCHITECTURE.md).

## Chrome vocabulary (HITL)

On-screen language for reading art and discussing hand layout edits. Prefer
these terms unless debugging electrical IR or place/route internals — then say
so explicitly. Engine-only words (stem, backbone rail, hinge, …) live in
implementation notes and [ARCHITECTURE.md](ARCHITECTURE.md), not here.

| Term | Meaning |
|------|---------|
| **cell** | One ASCII character grid position; unit of length and alignment ("about two cells too long", "middle cell of the N face"). |
| **chrome** | The visible ASCII art product (boxes, wires, labels as shown). |
| **box** | Rectangle depicting a module or component. Synonym: **footprint**. |
| **face** | One of the four walls of a box: N, E, S, W. Matches layout YAML face lists. Prefer over "bank" in prose. |
| **face cell** | A single border cell on a face. Usually better to name the **pin** instead. |
| **pin** | Named attachment on a box wall where a **wire** terminates (e.g. RELAY `IN`), typically with marker `●`. |
| **port** | Bare-wall termination (e.g. passive side of a body) where a wire ends without a named pin marker; also a casual synonym for **pin** when talking about faces/YAML. |
| **interior label** | Text inside a box (pin name, title / refdes). |
| **net** | Name of a signal (one electrical identity). May be **floating**. May appear as an exterior label at a **stub**. |
| **segment** | One horizontal or vertical run of a **wire**. |
| **wire** | The entire drawn route from pin/port to pin/port or junction (all **segments** and **elbows** along the way; may pass a **hop** without joining). |
| **stub** | Short protrusion (~1–2 cells) from a **pin** or **port**, free end, usually terminating next to a **net** name label (e.g. `●──TPO`, S-face drop to `GND`). Longer path → call it a **wire**, not a stub. |
| **elbow** | A 90° turn on one **wire** (ortho corner glyphs). Not a junction. |
| **junction** | Where three or more **wires** of the **same net** meet electrically. Cover term for tee and cross-join. |
| **tee** | A three-way **junction** (`├┤┬┴`). |
| **cross-join** | A four-way **junction** (`┼`) — rare; only one net. |
| **hop** | Two different **nets** cross in one **cell** but do not connect (`\`). Never paint as a junction. |

Join vs hop electrical paint rules: [SPEC.md](SPEC.md) §9. Layout face lists:
[LAYOUT.md](LAYOUT.md).

## Glyph kinds

Three kinds, each with a different placement contract:

| Kind        | Ports                           | Orientation concept                                          |
| ----------- | ------------------------------- | ------------------------------------------------------------ |
| **module**  | N pins, banked onto faces       | layout `sides: { N,E,S,W: pin[] }` (list order = edge order) |
| **passive** | exactly 2, in-line with a wire  | binary `orientation: h \| v` (not four face banks)            |
| **group**   | frozen interior, external ports | same face-bank `sides` contract as module                    |

A group is a module from the placement engine's point of view — the only
difference is its interior is pre-rendered once and cached, not solved live
by the general layout heuristic.

## Passives (resistors, capacitors, terminal blocks, ...)

**Decision:** regular boxes, not brackets. A single visual grammar across all
glyph kinds is worth more than the vertical space a bracket-only form would
save, and it keeps every component drawable without a second rendering path
for vertical wire runs.

**Labeling:** reference designator (refdes) inside the box, spec lives in a
side table — never both in the diagram at once. This mirrors standard
schematic reference-designator convention rather than inventing one:

| Prefix | Component      |
| ------ | -------------- |
| `R`    | Resistor       |
| `C`    | Capacitor      |
| `L`    | Inductor       |
| `D`    | Diode          |
| `Q`    | Transistor     |
| `TB`   | Terminal block |
| `SW`   | Switch         |
| `J`/`P`| Connector/jack |
| `F`    | Fuse           |

Side table (spec mapping) lives alongside the wiring table, same doc or a
sibling file:

```
| Ref | Type      | Value       |
|-----|-----------|-------------|
| R1  | Resistor  | 10K 1/8W 5% |
| TB1 | Terminal  | 2-pos 5mm   |
```

Rendered example:

```
    │
 ┌──┴──┐
 │ R1  │
 └──┬──┘
    │
```

**Gap:** Passive refdes-in-box rendering and side-table parsing are not yet
implemented. The prefix conventions and side-table format above are design
conventions only; parser and render support does not exist.

## Groups (composite glyphs)

For repeated sub-circuits (e.g. an NTC + divider resistor + 2 terminal
blocks, repeated per sensor channel) that should place as one unit rather
than N individual components.

**Phase 1 (current target) — layout-only grouping.**
The wiring table stays exactly as flat as today; every component in every
instance is still an explicit row/column. A `group:` tag on components tells
the *layout* stage to treat a tagged cluster as one rigid glyph: solve the
internal geometry once, cache it, redraw the cached fragment for every
instance. The electrical source of truth is untouched — this is purely a
placement-stage optimization.

**Gap:** Layout-only grouping (`group:` tag recognition in the layout stage) is
not yet implemented. Internal geometry caching and rigid-glyph redraw are
design conventions only.

**Phase 2 (deferred) — authoring-time templates.**
A real template/instance system (declare `NTC_DIVIDER` once with a named
external interface, instantiate via a compact port-to-net table) would
remove the repeated table rows entirely, but is a genuine hierarchical
sub-circuit feature — closer to KiCad hierarchical sheets than a layout
tweak. Only pursue this if Phase 1's table repetition proves painful in
practice; don't build it speculatively.

**Boundary/rail convention.** Components (or groups) that connect off-board —
terminal blocks, external sensor leads — can carry `edge: S` (or N/E/W).
This does two things, both reusing the existing spine channel-alignment
mechanism rather than introducing new machinery:
1. Defaults that glyph's dominant face to the tagged edge, removing a
   rotate/flip decision per instance.
2. Feeds a baseline-alignment pass so all `edge: S` items line up along one
   row, the same way shared-bus peers (e.g. I2C `SDA`/`SCL`) channel-align
   today — just applied to a perimeter instead of an internal bus.

**Gap:** Boundary preference/alignment (`edge:` tag) is not yet implemented.
The baseline-alignment pass is a design convention only.

## Rotation / orientation

Deliberately **not** spec'd yet — deferred until the passive convention
above has been used in practice, per the 2026-07 discussion.

Two distinct concepts, kept separate rather than unified into one generic
"rotate" feature:
- **Modules/groups:** layout face banks (`sides` N/E/S/W pin lists). Draft
  shape: [examples/layout02.yaml](../examples/layout02.yaml) / [rfc/001](rfc/001-layout-sidecar-and-hitl.md).
  Bootstrap `spine-v1` does **not** read layout files and does not honor author
  face banks (faces are assigned internally). From-document place owns that.
- **Passives:** binary `orientation: h | v`, not four face banks — a
  2-terminal passive has no meaningful multi-pin face stack, just an axis.

## Open questions carried forward

- Route-on-drop vs. live-reroute during drag — deferred to whenever the
  browser GUI (Option E in rfc/001) is actually built.
- Whether passives ever use micro face banks vs orientation only — after
  real passive fixtures.
