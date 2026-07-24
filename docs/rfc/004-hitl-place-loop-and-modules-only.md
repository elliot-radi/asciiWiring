# RFC 004: HITL place loop and modules-only packing

**Date:** 2026-07  
**Status:** Accepted  
**Supersedes (strategy):** spine-first **wire morph** under `--layout` as the
HITL quality path (rfc/001 course correction + later from-document hinge /
clearance work). Sidecar IR and emit concept from rfc/001 remain.

## Context

rfc/001 chose a layout **sidecar** so humans place modules and the computer
draws. The implemented bridge was:

```
netlist → spine-v1 (constructive place+route) → rigid-apply dossier x/y → paint
```

That preserves bootstrap art when YAML matches spine origins, and works for
tiny bumps. Hand-edit trials (compact packing on table02) showed the limit:
stems, elbows, and corridors were planned **with** the old packing. Sliding
boxes does not re-route; hinge / clearance / prune patches thrash and do not
scale with the fixture ladder.

The pencil model the product actually needs:

1. Draw each module (chrome, pins, labels) in isolation.  
2. Cut them out, slide on the page, tape when packing reads.  
3. Draw wires. If ugly → back to (2), not mutual morph of old strokes.

Steps 1–2 are ready enough. Step 3 under HITL is missing. Until a real
router exists, step 3 must not be faked.

## Problem

1. **Wrong stage boundary under `--layout`.** Interconnect still came from
   spine’s joint place+route, then surgical endpoint moves. Large `x`/`y`
   (and face edits) are not continuous on that graph.
2. **No honest intermediate product.** Authoring packing required staring at
   broken wires, which confuses place bugs with route ghosts.
3. **Complexity axis wrong.** Morph debt grew with every fix; fixture
   coverage did not.

## Decision (kernel)

**Two loops, one electrical SoT (table), one geometry IR (layout YAML).**

| Loop | Human | Computer | Art |
|------|--------|----------|-----|
| **Place** | Edit YAML `x`/`y`, face banks / pin order | Glyph size + port sites from dossier | **Modules only** (no interconnect) |
| **Route** *(later)* | Click / flag “try route”; revise place if ugly | Ortho router from **fixed** port sites | Full figure |

- Layout YAML **does not change** across a route attempt.  
- Spine remains **full bootstrap** when no geometry file is supplied
  (simple fixtures).  
- As soon as geometry is human-owned, **spine wire lists are void**. Spine’s
  durable gift is the **chrome seed** (boxes, faces, labels), not stems/rails.  
- **Abandon** spine+slide (and hinge/clearance/prune as HITL strategy).

### GUI forethought (not a deliverable)

Browser floorplan (rfc/001 Option E) is **compatible** and needs **no parallel
IR**:

- Canvas = place loop (drag boxes, reorder face pins) → writes same YAML.  
- “Route it” = route loop on frozen packing.  
- Accept / “Revise placement” = stay on or return to place; optional static
  last-route preview pane is UX only.

RFC does **not** specify widgets. Constraint for later UI work: do not invent
a second geometry file or bake route segments into the place IR.

## CLI shape (normative intent)

**Binary:** `ascw` (asciiWiring). Implementation may keep `node src/render.js`
as a thin alias during transition.

**Grammar (locked):**

```text
ascw [flags] TABLE.md [LAYOUT.yaml]
```

- **TABLE.md** — always the electrical SoT (required for normal draws).
- **LAYOUT.yaml** — optional second path; the layout **document** (geometry).
  Present ⇒ human-owned packing path (not spine full bootstrap).
- Flags do not take the layout path; at most one extra free path = layout file.

| Intent | Invocation |
|--------|------------|
| Bootstrap full art (spine, simple fixtures) | `ascw TABLE.md` |
| Seed editable layout YAML | `ascw --emit-layout TABLE.md` |
| Full pipeline art with layout (place → route → paint) | `ascw TABLE.md LAYOUT.yaml` |
| Modules chrome only (no interconnect) | `ascw -m TABLE.md LAYOUT.yaml` |
| Same | `ascw --modules-only TABLE.md LAYOUT.yaml` |

**Only modules-art flag (no wires):** `-m` / `--modules-only`.

**No `--route` flag.** Routed art is the **default** whenever a layout file is
supplied and `-m` is absent. Route is a real pipeline stage after place.
Until a real router exists, that stage is a **documented no-op** (empty
segment list), so:

```text
ascw TABLE.md LAYOUT.yaml
```

produces art **identical** to modules-only. When the router is hooked up,
the **same invocation** gains wires without a CLI change.

**Not in the surface:** `--layout FILE` as geometry input, `--place`,
`--emit-place`, `--route`, required `--render`. Keep `--emit-layout` (emit a
layout **document**). Layout when drawing is the **second positional path**.

**Bootstrap** (table only) stays full **spine-v1** for simple fixtures and
spine goldens.

**Strict content rule under a layout file:** never spine+slide morph as “full”
art. Place modules from the dossier; interconnect only from the route stage
(no-op or real).

## Next shippable (Deliverable A)

**Modules-only packing render driven by the place document.**

### Do

1. **Load + validate** place YAML (loader / census unchanged in spirit).  
2. **Derive glyph chrome from the dossier + table**, not from spine-then-slide:
   - box origin = authored `x`/`y`;
   - **w/h** from pin labels, title, padding rules (shared with emit);
   - port cells from face banks and edge order on that box;
   - interior pin / title labels.  
3. **Emit optional reference fields** in YAML (non-authoritative at first):
   `w`, `h` written for human reference when seeding; loader may accept and
   ignore until a deliberate “authored size / padding override” exists.
   Optional human shrink/grow via padding remains **open**, not promised.  
4. **Paint** boxes, ports, labels only. `page.wires` empty (or unscanned).  
5. **Loop:** `ascw --emit-layout TABLE.md` → edit YAML →
   `ascw TABLE.md LAYOUT.yaml` (or `-m`) → repeat.

### Do not (this deliverable)

- Spine+slide morph under a layout file.
- A `--route` flag or mandatory `--render`.
- Grow rigid wire morph / clearance / prune.
- Build the browser.

Deliverable A ships: modules from dossier, route stage as no-op (or `-m`
to force modules-only / no wires), so layout-aware art is modules chrome.
Wired art appears later by replacing the no-op router only.

### Acceptance

- Hand-compact place file (table02-class): modules slide cleanly; no orphan
  stems/wall H/stub bugs **because those objects are absent**.  
- Face bank edits restamp pins on chrome.  
- Spine default path + existing bootstrap goldens remain for no-file CLI.  
- Selftests: modules-only packing checks replace “from-document full art
  identity under HITL” as the HITL bar. Spine identity may remain as a
  **bootstrap** check only where still meaningful (e.g. emit structural).

## Deliverable B (later): real router (same CLI)

Replace the no-op route stage. **CLI unchanged:**

```text
ascw TABLE.md LAYOUT.yaml          # now with wires
ascw -m TABLE.md LAYOUT.yaml       # still modules-only
```

**In:** netlist + layout document (fixed boxes + port sites).  
**Out:** wire segments + exterior net labels; paint full art.  
**Policy (sketch, not an algorithm bake-in):** short nets first; box clearance;
elbow before stroke; no box cross; hop on foreign H∩V; stub length constants;
domain ortho / stem — not Dagre/ELK/maze cosplay.

Acceptance hardens when modules packing is boring. Salvage from morph
experiments as **router heuristics** only where still true (e.g. min face-exit
clearance, prefer elbow above N pin not on border, mid-face N/S single-pin
aesthetic) — never as endpoint-mutation of foreign segment lists.

## Code posture after accept

- **Stop** investing in from-document wire retarget as product path.  
- **Prefer modest delete** of dead morph (hinge-only drop wires under place
  file, or delete morph helpers when modules-only lands) over archaeology
  reverts that thrash git; no need to cosplay pre-debug history if behavior is
  modules-only.  
- **Keep** loader, emit structure, spine bootstrap, paint.

## Explicit non-goals

- Perfect auto pack.  
- Route quality as gate for Deliverable A.  
- General CAD.  
- Skill / browser as blocking dependencies.

## Alternatives rejected (this round)

| Option | Why not |
|--------|---------|
| Keep improving rigid morph until “good enough” | Wrong complexity axis; already thrashing |
| Soft full art under `--layout` “best effort” | Teaches false confidence; confuses place vs route |
| Monolithic spine forever under HITL | Superseded by paper model + rfc/001 HITL intent |
| Specify browser now | Loop IR is enough forethought; UI later from trial |

## Cross-refs

- rfc/001 — sidecar + HITL split (still foundation).  
- rfc/000 — electrical SoT and pipeline bones.  
- LAYOUT.md — schema contract (update when flags / optional `w`/`h` land).  
- ARCHITECTURE.md — stage seams (place vs route).  
- STATUS.md — priorities (place loop next).  
- GLYPHS.md — chrome vocabulary for modules-only review.

## Summary

**Problem:** HITL packing was bolted through spine wire morph; art broke under
real edits.  
**Solution:** Honest **place loop** (modules-only from place YAML) now; **route
loop** later on frozen packing; spine full art only as no-file bootstrap.  
**Next:** `ascw` grammar + modules-from-dossier + no-op route under layout
file; freeze morph; then real router behind the same default invocation.
