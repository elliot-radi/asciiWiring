# Glyphs: component drawing conventions

**Status:** design discussion (2026-07). Extends [HITL.md](./HITL.md); normative
table-language changes belong in [SPEC.md](./SPEC.md), not here.

This doc is the home for *how a component becomes a glyph* — box shape, labeling,
and composition — as distinct from *where the glyph goes* (HITL.md) or *what's
legal in the wiring table* (SPEC.md).

## Glyph kinds

Three kinds, each with a different placement contract:

| Kind        | Ports                          | Orientation concept              |
| ----------- | ------------------------------- | --------------------------------- |
| **module**  | N pins, assignable to any face  | `sides:` map (N/E/S/W per pin)    |
| **passive** | exactly 2, in-line with a wire  | binary `orientation: h \| v`      |
| **group**   | frozen interior, external ports | same `sides:` contract as module  |

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

## Rotation / orientation

Deliberately **not** spec'd yet — deferred until the passive convention
above has been used in practice, per the 2026-07 discussion.

Two distinct concepts, kept separate rather than unified into one generic
"rotate" feature:
- **Modules/groups:** already representable via the existing `sides:` map
  (arbitrary per-pin face assignment). Open question: whether `spine-v1.js`'s
  bootstrap actually honors `sides:` overrides today (e.g. left/right-only
  placement) or currently assumes top/bottom — needs a code-level check
  before this is spec'd into any editor affordance.
- **Passives:** binary `orientation: h | v`, not a 4-way `sides:` map — a
  2-terminal passive has no meaningful "face," just an axis.

## Open questions carried forward

- Does `spine-v1.js` respect `sides:` overrides for arbitrary face
  assignment today? (verification task, not yet done)
- Route-on-drop vs. live-reroute during drag — deferred to whenever the
  browser GUI (Option E in HITL.md) is actually built.
