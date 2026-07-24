# RFC 001: Layout sidecar and human-in-the-loop

**Date:** 2026-07
**Status:** Accepted

## Context

Spine-v1 bootstrap placement (rfc/000 §7) works for simple bus pairs but
fails on real fixtures: off-spine modules crowd each other, leaf stubs
cross boxes, and multi-rail labels collide. The question is not whether
to add human placement help, but what form it takes and where the seam
between human and computer effort lies.

## Analysis: who is good at what

| Agent | Strong at | Weak at |
|-------|-----------|---------|
| **Human** | "Does this *read*?", topology storytelling, pin facing, crowding, which rail is visual ground, when two nets may hop | Counting columns, repeating 12 box borders, merge-conflict geometry, remembering every net after a rename |
| **Computer** | Parse tables, preserve netlists, size boxes from pins, snap to grid, paint joins/hops, regenerate after renames, deterministic goldens | Global aesthetic packing, "this label looks wrong here," multi-criterion tradeoffs without a good score function |
| **LLM (skill)** | Draft tables from intent + datasheets, iterate electrical meaning with user | Character-aligned art, stable multi-pass layout |

Table-as-SoT already matches that split for **connectivity**. The open
question is only **geometry**.

## Evidence from fixtures

1. **Module interiors** — size box, pin dots, labels: computer is fine.
2. **Spine of peer modules** (MCU↔OLED I2C/power): computer is fine with
   simple left-to-right + aligned channels.
3. **Off-spine modules** (RELAY, ZMCT), **leaf stubs**, **multi-rail free
   labels**: human easily sees crowding; heuristics thrash.
4. **Routing once anchors are good**: computer ortho routing (with hop
   and join rules already specified) is appropriate; ugly routes usually
   mean bad placement, not bad Bresenham.
5. **Pin order on a box face**: human swipe of order is cheap; computer
   must not treat table order as sacred.

## Options evaluated

### A. Bootstrap emit + hand-edited layout document (recommended)

Machine emits (or defaults to) a layout dossier per component: `x`, `y`,
and face-banked `sides: { N, E, S, W }` with ordered pin lists. Human
edits the YAML; tool routes and paints from it.

- **Human does:** box origin, move/reorder pins on faces.
- **Computer does:** glyph metrics, route from port sites, paint, hop/join.

Schema (Mode B): `components` is a map keyed by table column name. Each
value is `{ x, y, sides: { N:[], E:[], S:[], W:[] } }`. All four faces
required; empties are `[]`. Face list order is edge order. Pin census
must match the table exactly.

### B. Router complaints (machine asks, human answers)

After route, emit structured problems (`label-collision`,
`stub-crosses-box`, `long-stem`). Human answers with text commands
(`move RELAY 3 right`, `bank ADS1115 AIN* to E`). Feels magical but
needs excellent diagnostics.

### C. Constraint annotations (human foresight, no coordinates)

Stack and hang hints in frontmatter/footnotes. More skill-native (LLM
can draft constraints). Weaker when only nudges work.

### D. Enlarge bootstrap competence (diminishing returns)

Better spine, branch attachment, stub corridors. Do this freely when cheap;
stop when adding rules only fixes one board and breaks another.

### E. Full interactive browser

Three-pane editor: glyph palette, character-grid canvas, router complaints
+ live ASCII preview. Reads and writes the same YAML as Option A. Route
stays automatic.

## Decision

1. **Try Option A properly before building anything else** — but as
   **from-document**, not overlay. Early hybrid (`--layout` hooks inside
   `spine-v1`) was prototyped, hand-tested as fragile (Y moves ignored net
   rows, S faces, etc.), and **reverted**. Do not revive overlay. Ship
   complete layout interpretation in increments with IR acceptance tests.
2. **Passives get boxes, not brackets.** Refdes in glyph; specs in side
   table metadata. (See docs/GLYPHS.md for conventions.)
3. **Component/module rotation is deliberately unspec'd for now** — wait to
   see how the passive convention holds up in practice before generalizing.
4. **Grouped components ship as layout-only grouping (Phase 1)**, not
   authoring-time templates. The wiring table remains the singular SoT;
   only the layout stage treats a tagged cluster as one rigid glyph.
5. **Schema shape:** nested glyph dossiers, no top-level `pinOrder` key.

## Target architecture for Option E (not being built now)

Worth recording so it is not rediscovered from scratch later:

- Left pane: glyph palette from parsed table.
- Center: character-grid canvas (integer cell coordinates, arrow-key nudge
  = 1 cell).
- Right: router complaints list + live ASCII preview (actual paint-stage
  output, not an approximation).
- Persistence: reads/writes the same `layout.yaml` as Option A — no
  proprietary format. Hand-editing and GUI stay interchangeable.
- Routing stays automatic. Human moves boxes and reassigns pin faces;
  router re-runs. Manual wire-drawing is explicitly out of scope.

## What should never be human busywork

If the seam is wrong, these become required:

- Redrawing every box border after a pin rename
- Manually typing `●───●` runs after a net add
- Re-aligning shared I2C channels by hand when both ends moved
- Re-deriving hop vs join glyphs

If HITL requires that, the design is broken.

## Decision log (2026-07)

| Decision | Rationale |
|----------|-----------|
| From-document only, no hybrid overlay | Overlay was fragile; complete obedience is cleaner |
| Nested dossiers, map not array | Identity-stable diffs; one block per glyph |
| Strict four faces, pin census hard | Validates against table; empty faces kept for future drops |
| Browser gated behind YAML hand-edit trial | Avoid premature product surface area |

## Related

- docs/LAYOUT.md — normative schema contract
- docs/STATUS.md — current implementation status
- docs/GLYPHS.md — passive and grouping conventions
