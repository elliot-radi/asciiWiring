# Human-in-the-loop (HITL): where effort should go

**HITL** = **human-in-the-loop** — keep a person in the workflow for the
parts they’re better at (here: spatial placement / “does this read?”),
while the computer does mechanical draw/route/regen.

**Status:** design direction (updated 2026-07). The sidecar trial is the
current commitment; a browser UI remains gated on what that trial teaches.

When auto placement stops being “good enough,” the instinct is graph-paper
cutouts in a browser. That may be right — but **only after** we list what
humans are cheap at vs computers in *this* problem, and pick the smallest
loop that uses each well.

## Strengths

| Agent | Strong at | Weak at |
|-------|-----------|---------|
| **Human** | “Does this *read*?”, topology storytelling, pin facing, crowding, which rail is visual ground, when two nets may hop | Counting columns, repeating 12 box borders, merge-conflict geometry, remembering every net after a rename |
| **Computer** | Parse tables, preserve netlists, size boxes from pins, snap to grid, paint joins/hops, regenerate after renames, deterministic goldens | Global aesthetic packing, “this label looks wrong here,” multi-criterion tradeoffs without a good score function |
| **LLM (skill)** | Draft tables from intent + datasheets, iterate electrical meaning with user | Character-aligned art, stable multi-pass layout |

Table-as-SoT already matches that split for **connectivity**. The open
question is only **geometry**.

## What is actually hard (from fixtures)

Evidence so far (`table01` easy-ish, `table02` strained pure spine):

1. **Module interiors** — size box, pin dots, labels: **computer** is fine.
2. **Spine of peer modules** (MCU↔ADS I2C/power): **computer** is fine with
   simple left-to-right + aligned channels.
3. **Off-spine modules** (RELAY, ZMCT), **leaf stubs** (TPO, PUMP_*),  
   **multi-rail free labels**: **human** easily sees crowding; **heuristics** thrash.
4. **Routing once anchors are good**: **computer** (ortho + hop `\` / join
   tees we already specified) is appropriate; ugly routes usually mean
   bad placement, not bad Bresenham.
5. **Pin order on a box face**: human swipe of order is cheap; computer
   mustn’t treat table order as sacred (SPEC already allows art reorder).

So the bottleneck is not “draw a box” or even “draw a wire.” It is
**spatial composition of non-spine flakes** and **local pin banking**.

## Graph-paper cutouts (browser floorplan)

**Pros**

- Directly encodes the skill humans already practice.
- Placement failures become “slide that” instead of “tweak heuristic #7.”
- Still keeps table free of coordinates.
- Layout file = reviewable, committable SoT for geometry.

**Cons**

- Real surface area (tooling, UX): this is a **product**, not an `.md` skill.
- Risk of mini-EDA creep.
- Headless/CI need frozen layout artifacts; session isn’t the only API.
- May be more UI than needed if lighter HITL knobs unblock 80% of boards.

**Verdict:** excellent *fit* for strengths; not automatically the *first*
HITL feature to build — but a strong target architecture.

## Smaller human-in-the-loop options (often enough)

Ranked roughly by implementation cost × leverage. Mix-and-match.

### A. Bootstrap emit + hand-edited layout document (recommended near-term core)

Machine **emits** an initial layout dossier (today’s spine can seed this later, or
a dumb default bank). Human edits a **nested layout sidecar** — one block per
glyph, not cross-cutting attribute sections.

Checked-in sketch: [`examples/layout02.yaml`](../examples/layout02.yaml)
(unwired; CLI ignores it until Phase 3 from-document lands).

```yaml
# layout02.yaml — face-banked glyph dossiers (draft)
components:
  RELAY:
    x: 1
    y: 14
    sides:
      N: [IN]           # N/S lists: left → right
      E: [NO, COM, 5V]  # E/W lists: top → bottom
      S: [GND]
      W: []             # keep empty faces so HITL can drop pins in
  ZMCT103C:
    x: 24
    y: 17
    sides:
      N: [OUT]
      E: [5V]
      S: [GND]
      W: []
```

**Human does:** box origin (`x`,`y`); move/reorder pins on faces.  
**Computer does:** glyph metric, route from port sites, paint, hop/join.

**Pin census:** every named pin from the table appears exactly once across the
four faces. Bootstrap emit is complete; hand-edit is rearrange only. Drop /
rename / duplicate / invent pins → **error**.

**No separate `pinOrder`:** face list order *is* edge order.

**Not the path:** threading optional overrides into `spine-v1` while it still
owns net-row spines and host depth (hybrid overlay — tried, fragile, reverted).
Layout mode should be **from-document** place+route, with spine only as
bootstrap / default CLI.

This is graph paper **with a text editor** first — Phase A before any browser.

### B. Exhaustive “complaints” from the router (machine asks, human answers)

After a route pass, emit structured problems:

- `label-collision PUMP_OUT @ …`
- `stub-crosses-box ZMCT`
- `long-stem RELAY_CMD`

Human answers with minimal commands:

```text
move RELAY 3 right
bank ADS1115 AIN* to E
reorder RELAY E: NO,COM,5V
```

**Human does:** few high-value decisions.  
**Computer does:** diagnosis + application + re-route.

Feels magical; needs good diagnostics (doable without a GUI).

### C. Constraint annotations (human foresight, no coordinates)

In footnotes or frontmatter, *intent* not geometry:

```yaml
stack: [ESP32-C3, ADS1115]          # spine order
hang: { RELAY: under ESP32-C3, ZMCT103C: under ADS1115 }
banks: { ADS1115: { right: [AIN0, AIN1, AIN2, AIN3] } }
```

**Human does:** structure of the *story*.  
**Computer does:** realize within constraints.

More “skill-native” (LLM can draft constraints). Weaker when only nudges work.

### D. Enlarge the computer’s pre–human-in-the-loop competence (diminishing returns)

Slightly better spine, attach branches under correct hosts, reserved stub
corridors, etc. **Do this freely when cheap**; stop when adding rules only
fixes one board and breaks another.

### E. Full interactive browser (D+A with hands)

Same layout file as A; browser is an editor for A, not a parallel universe.
Route live; save YAML; export ASCII.

**Build when** A/B prove the model and editing YAML by hand is the pain.

## What still should *never* be human busywork

- Redrawing every box border after a pin rename  
- Manually typing `●───●` runs after a net add  
- Re-aligning shared I2C channels by hand when both ends moved  
- Re-deriving hop vs join glyphs  

If “human in the loop” requires that busywork, we designed the seam wrong.

## Implied product loop (tool + optional skill)

```text
Intent
  → [LLM skill] draft/iterate Markdown table     # electrical SoT
  → [tool] parse → IR → glyphs
  → [tool] bootstrap place (+ optional constraints)
  → [human] layout sidecar or browser or complain-answers
  → [tool] route → paint → ASCII
  → commit table + layout + art into HARDWARE.md world
```

The **skill** owns table conversation and “when to invoke the tool.”  
The **tool** owns IR, glyphs, route, paint, layout I/O.  
The **human** owns spatial taste (and electrical sign-off on the table).

## Decision guidance (don’t paint us into browser-only)

1. Ship **layout sidecar + route-from-layout** before GUI.  
2. Measure: does hand layout02 turn art02-quality with low pain?  
3. If yes and YAML is the bottleneck → browser editor for the same file.  
4. If yes and *discovering* what’s wrong is the bottleneck → router  
   complaints (B) first.  
5. Keep pure-auto path for trivial spines so simple docs don’t need ritual.

## Relationship to current code

- Keep: parse, model, classify, paint, join/hop rules, fixtures, table language.  
- Refactor toward: `glyph(component)`, `place(...)`, `route(plan)`,  
  `layout` document load/save.  
- Demote: “spine-v1 alone must match art02.” Bootstrap only.

See [STATUS.md](STATUS.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[GLYPHS.md](GLYPHS.md), and [ROADMAP.md](ROADMAP.md).

## Decision log (2026-07)

Following the strengths/options analysis above, current direction:

1. **Try Option A properly before building anything else** — but as
   **from-document**, not spine overlay. Schema sketch lives in
   `examples/layout02.yaml`. Early hybrid (`--layout` hooks inside
   `spine-v1`) was instructional and **reverted**. Next: freeze contract
   (this file + future LAYOUT.md), then implement in slices with IR acceptance
   tests. Schema ergonomics vs feedback latency still matter once obedience
   works; don’t confound them with half-honored YAML.
2. **Passives get boxes, not brackets.** See [GLYPHS.md](./GLYPHS.md) for
   the full convention (refdes labeling + side table).
3. **Component/module rotation is deliberately unspec'd for now** — wait to
   see how the passive convention holds up in practice before generalizing
   a rotate/flip interaction. Module pin banking is already `sides` face lists.
4. **Grouped components ship as layout-only grouping (Phase 1)**, not
   authoring-time templates. The wiring table remains the singular source
   of truth; only the layout stage treats a tagged cluster as one rigid
   glyph. Template/instance authoring (Phase 2) is explicitly deferred
   until Phase 1's table repetition proves painful. Full detail in
   GLYPHS.md.
5. **Schema shape for `layout.yaml` (draft):** `components` is a **map**
   keyed by table column name (not an array). Each value is a **nested glyph
   dossier**: `x`, `y`, and `sides: { N, E, S, W }` → ordered pin lists (always
   all four faces; empties are `[]`). No top-level `pinOrder` / pin→face maps.
   Nested beats three cross-cutting sections for hand-edit and future GUI
   inspectors. Maps still give identity-stable diffs vs component arrays.

### Target architecture for Option E (when we get there)

Not being built now, but worth keeping so it isn't rediscovered from
scratch later. Three-pane browser editor:

- **Left:** glyph palette, generated straight from the parsed table (and,
  once Phase 1 grouping exists, group templates appear as single draggable
  items rather than their sub-components).
- **Center:** a literal character-grid canvas (not continuous x/y) — every
  glyph snaps to integer cell coordinates from the first frame, arrow-key
  nudge = 1 cell, so what's seen while dragging is what exports.
- **Right:** router complaints list (`label-collision`, `stub-crosses-box`,
  `long-stem`, from Option B) paired with a live ASCII preview pane that
  renders the actual paint-stage output, not an approximation.
- **Persistence:** the GUI reads/writes the same `layout.yaml` Option A
  produces — no proprietary format, so hand-editing and the GUI stay
  interchangeable, and headless/CI workflows keep working.
- **Routing stays automatic.** The human moves boxes and reassigns
  pin faces/order; the router re-runs after every move. Manual wire-drawing
  is explicitly out of scope — an ugly route is a placement signal, not
  something to hand-fix with wire tools.
- **Open question, not yet resolved:** route-on-drop (stable, updates on
  release) vs. live re-route during drag (more "magical" but risks jitter
  on strained boards like `table02`). Revisit once there's an actual GUI to test it in.
