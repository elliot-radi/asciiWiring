# Human-in-the-loop: where effort should go

**Status:** design discussion (2026-04). Not a commitment to a browser UI.

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

## Smaller HITL options (often enough)

Ranked roughly by implementation cost × leverage. Mix-and-match.

### A. Bootstrap + surgical override file (recommended near-term core)

Machine produces an initial place (today’s spine or simpler).
Human (or LLM under human review) edits a **layout sidecar**:

```yaml
# layout02.yaml — geometry only; nets still from table
components:
  RELAY:    { x: 12, y: 14 }
  ZMCT103C: { x: 40, y: 14 }
pinOrder:
  ADS1115: [VDD, GND, SDA, SCL, ADDR, AIN0, AIN1, AIN2, AIN3]
sides:
  RELAY: { IN: N, NO: E, COM: E, "5V": E, GND: S }
```

**Human does:** positions / pin banks / faces.  
**Computer does:** glyph metric, route, paint, hop/join.

This is graph paper **with a text editor** first — Phase A before any browser.

### B. Exhaustive “complaints” from the router (machine asks, human answers)

After a route pass, emit structured problems:

- `label-collision PUMP_OUT @ …`
- `stub-crosses-box ZMCT`
- `long-stem RELAY_CMD`

Human answers with minimal commands:

```text
move RELAY 3 right
flip ADS1115 AIN* to E
pinOrder RELAY NO,COM,5V
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

### D. Enlarge the computer’s pre-HITL competence (diminishing returns)

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

If HITL requires that, we designed the seam wrong.

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

See [STATUS.md](STATUS.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md).
