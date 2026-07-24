# Architecture

**Status:** draft — guides the **tool** implementation.  
**Companions:** [SPEC.md](SPEC.md), [GLYPHS.md](GLYPHS.md),
[STATUS.md](STATUS.md), [LAYOUT.md](LAYOUT.md),
[rfc/000-electrical-model-and-pipeline.md](rfc/000-electrical-model-and-pipeline.md),
[rfc/001-layout-sidecar-and-hitl.md](rfc/001-layout-sidecar-and-hitl.md)

Product: Node library + CLI. Optional pi skill only drafts tables and invokes
the tool (`skill/SKILL.md`) — it is not the placer.

---

## 1. Problem framing

We convert a **connectivity matrix** into monospaced **wiring art**, with
geometry increasingly split between bootstrap auto-place and human-owned
layout documents ([rfc/001](rfc/001-layout-sidecar-and-hitl.md)).

Same *pattern* as Mermaid (text → diagram), different *domain*:

| Mermaid flowchart | asciiWiring |
|-------------------|-------------|
| Nodes + directed edges | Components + **nets (hyperedges)** + ports |
| Generic rank/order layout | Genre place + route (bootstrap: bus/branch/passive) |
| SVG paint | Character grid paint |
| Author writes topology | Author writes **incidence table** (+ optional layout file) |

We borrow Mermaid’s **discipline**, not its flowchart ontology or layout engines.

### 1.1 Discipline we keep

1. **No coordinates in the connectivity table.** Placement may live in a
   separate layout document (human-in-the-loop), not in pin cells.
2. **Parse → model → place/route → paint** are separate stages (route may still
   be fused with place in code today).
3. **One genre done well** before a toolbox of genres.
4. **Presentation / placement ≠ electrical content.**
5. **Fixtures beat opinions** (tableNN + artNN/goldenNN).
6. **Determinism** given the same netlist + layout inputs.

### 1.2 Discipline we reject

- Dagre/ELK as the primary placer (wrong geometry for character channels).
- Drawing instructions smuggled into the connectivity table.
- User-facing JSON *instead of* the Markdown table (internal IR is fine).
- Treating bootstrap `spine-v1` alone as the long-term quality bar.

---

## 2. End-to-end pipeline

```
  Markdown table (+ footnotes)
           │
           ▼
     1. PARSE ──► 2. MODEL (netlist IR) ──► 3. CLASSIFY (roles)
                                                    │
                    ┌───────────────────────────────┤
                    ▼                               ▼
     4a. BOOTSTRAP PLACE               4b. LAYOUT DOCUMENT (HITL path)
         (spine-v1 today)                  sidecar YAML / future browser
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                    5. ROUTE (ortho + join/hop)   [fused with place today]
                                    ▼
                    6. PAINT (glyph profile → character grid)
                                    ▼
                               ASCII string
```

Each stage is pure data in → data out (plus diagnostics).
CLI: read file/stdin, print art/stderr.

Internal objects/JSON are fine. They are **not** a replacement for the table.
Layout sidecars are geometry-only companions to the table, not a second netlist.

---

## 3. Stage contracts

### 3.1 Parse

**In:** UTF-8 Markdown string.  
**Out:** `AstDocument`.

```
AstDocument {
  frontmatter?: object      // reserved; v1 may ignore
  components: string[]      // column headers after Signal
  nets: AstNet[]
  abbreviations: { [short: string]: string }
  sourceHints?: { startLine, endLine }
}

AstNet {
  rawName: string           // including ° if present
  name: string              // without °
  floating: boolean
  cells: (string | null)[]  // parallel to components; null = empty
}
```

Parse cares about **tables and footnotes**, not layout.

### 3.2 Model (electrical IR)

**IR** = **intermediate representation**: in-process structured data between
parse and paint. The **electrical IR** is the netlist — connectivity only.
It is not user-facing and not a file format we ask authors to write.

**In:** `AstDocument`.  
**Out:** `Netlist` (validated).

```
Netlist {
  components: Component[]
  nets: Net[]
  ports: Port[]
  abbreviations: {...}
}

Component { id, name, columnIndex }
Net       { id, name, floating, rowIndex }
Port      {
  id,
  componentId,
  netId,
  kind: "named" | "anonymous",
  label?: string            // pin text if named
}
```

**Invariants**

- Every non-empty cell ↔ exactly one port.
- Port net membership is the only connectivity truth.
- No coordinates in the **netlist** (geometry only in LayoutPlan / layout docs).
- No glyph choices in the netlist.

This netlist should still make sense if we later emit SVG, Graphviz, or KiCad
notes. It is the **stable semantic core**.

### 3.3 Classify

**In:** `Netlist`.  
**Out:** `Netlist & { roles: Map<componentId, Role> }`.

```
Role = "bus" | "branch" | "passive" | "other"
```

Pure functions of incidence patterns (SPEC §8).  
Layout reads roles; paint does not need them.

### 3.4 Place + route → LayoutPlan

**In:** classified `Netlist` + `LayoutOptions` (+ optional layout document).  
**Out:** `LayoutPlan` (integer cell geometry, ready to paint).

```
LayoutOptions {
  policy: "spine-v1" | "from-document"  // bootstrap vs HITL sidecar
  layoutDocument?: object               // Loader validates YAML → nested
                                        // components map; see LAYOUT.md for
                                        // schema (x, y, sides; later:
                                        //  orientation, group, edge).
  // channel spacing, page width, fold buses, …
}

LayoutPlan {
  pages: PagePlan[]         // v1: exactly one page
}

PagePlan {
  width: number             // grid cols needed
  height: number
  boxes: BoxGeom[]
  ports: PortGeom[]
  wires: WireGeom[]
  labels: LabelGeom[]       // free-floating net names, notes
  meta?: { netChannelY: { [netId]: number }, ... }
}

BoxGeom  { componentId, x, y, w, h, title }
PortGeom { portId, x, y, side: "N"|"S"|"E"|"W", marker?: string }
WireGeom { netId, segments: Segment[], junctions?: Point[] }
LabelGeom { text, x, y, kind: "net" | "note" | "title" }
Segment  { x1,y1,x2,y2 }    // axis-aligned
```

Coordinates are **integer character cells**.

**Layout document:** map `components.<tableName>` → glyph dossier
`{ x, y, sides: { N, E, S, W: pin[] } }`. Face list order is edge order
(N/S left→right, E/W top→bottom). Pin multiset must match the netlist named
ports. Schema contract: [LAYOUT.md](LAYOUT.md); example
[examples/layout02.yaml](../examples/layout02.yaml); HITL history rfc/001.

**Policy `from-document` / place file:** loader validates the YAML against the
netlist (census/schema). `layoutFromDocument` builds module chrome from the
dossier (`x`/`y`, face banks, derived `w`/`h`) and leaves `page.wires` empty
for the place stage; `route-v1` fills wires unless `-m`. Spine wire morph
under a layout file is gone
([rfc/004](rfc/004-hitl-place-loop-and-modules-only.md)).

**Under a place file:**

1. **Place loop** — glyph chrome (boxes, ports, labels) from dossier + table;
   no interconnect until the route stage runs.
2. **Route loop** — `route-v1` from fixed port sites (unless `-m`); place YAML
   unchanged across tries. Floating nets should **rhyme with spine policy**
   (collinear bus rails OK; branch pins stub + exterior net label — not an
   MST home-run off the rail). Quality polish ongoing.

Default CLI *without* a place file remains full **spine-v1** bootstrap. See §3.4.2.

**Chrome SoT:** `src/layout/chrome.js` (`sizeChrome`) — spine-v1 and
from-document share branch sizing, N/S pin-label rows, and title clearance.
Paint stays placer-agnostic (`titleVAlign` / `titleBottomInset`). Chrome
parity on untouched emit is selftested; remaining cascade work is route /
floating policy (STATUS).

### 3.4.1 Glyph build (target seam)

Before placement, a glyph builder should derive module, passive, or composite
geometry and external ports from the netlist plus non-electrical metadata.
Drawing conventions live in [GLYPHS.md](GLYPHS.md).

- Modules expose N ports with layout-controlled face banks (`sides` lists).
- Two-terminal passives use regular boxes and a horizontal/vertical axis.
- Layout-only groups retain their flat electrical components but expose a rigid
  cached interior and module-like external boundary to placement.
- `edge` is a boundary placement/alignment preference, never connectivity.

The current `spine-v1` implementation does not yet have this independent seam.
It builds boxes while placing and assigns faces internally.

#### Policy `spine-v1` (bootstrap placer — implemented)

High-level behaviour (product intent):

1. Place **bus** boxes left→right (respect column order when possible).
2. Choose a **channel stack** for nets used on the backbone (reorder allowed).
3. Map named bus ports onto east/west faces aligned to channels when adjacent buses share nets.
4. Route shared **fixed** nets as horizontal runs between facing ports.
5. Place **branch** stacks below the stem port’s bus (or nearest carrier).
6. Place **passive** bodies off a **tee-join** on one net, with a second lead
   to their other net (not as a series splice on the stem).
7. For **floating** nets: prefer short explicit runs on the backbone; at leaves, free labels are OK.
8. Reserve row/column gutters so paint never collides boxes with wires.
9. Prefer routes that need no hops when cheap; when a stem must cross a
   foreign backbone run, emit an insulated hop (not a join).

`spine-v1` is deliberately limited. It is a **bootstrap**, not the quality
ceiling (see table02). Harder packing → layout document + human edit
(rfc/001), not endless new spine heuristics. Optional future auto
policies (`multi-row`, `paged`) must not block the sidecar path.

**Implementation order matters.** Spine does **not** “size all boxes → drop
them on a loose grid → globally route.” Place and route are **fused and
constructive**. Precise pipeline: §3.4.2.

### 3.4.2 Mental model: constructive place+route (why large `x`/`y` moves hurt)

Two different pictures of “ASCII wiring layout” is easy to mix. Maintain the
**engine** model, not only the **ideal CAD** model.

#### Ideal picture (not how spine-v1 works)

A floorplan-then-route pipeline many engineers expect:

1. Size every module box from pin banks / labels.
2. Place **buses** on a top row with large gutters.
3. Place **secondaries** on a lower row with exterior clearance around pins.
4. **Then** run an ortho router through free space (stems, rails, stubs).

In that world, changing a box’s `x`/`y` is cheap: geometry moves, then
**routing is recomputed** against the new open channels. Large YAML bumps
should still look intentional.

#### Actual spine-v1 picture (code: `src/layout/spine-v1.js`)

Spine is a **role-aware constructive placer**. Corridors and wires are chosen
while modules appear, not over a finished packing.

Approximate order:

| Step | What happens | Consequence for geometry |
|------|----------------|---------------------------|
| 1 | Roles already classified (`bus` / `branch` / `passive`). | Secondaries are not a generic “row 2.” |
| 2 | **`assignNetRows`** — shared `netY` map for backbone-ish nets (shared bus nets first with scoring, then exclusive nets per bus). | Horizontal “spine” channels exist **before** bus boxes finish. |
| 3 | **Size/place buses only** at `y = 0`, left→right (`GAP_BUSES`). Width from title/pin labels; height from **`max(netY)+2`**, i.e. the channel stack, not face list length alone. | Bus ports get absolute `(x,y)` tied to channels. |
| 4 | Instantly place bus **port sites** (E/W by facing rule + `netY`). | Port coordinates are world truth for rails. |
| 5 | **Bus–bus H wires** for same net + same `y` between consecutive buses. | Backbone rails are segment lists, not a later pass. |
| 6 | For each **branch** (host-attached): find stem net on a host bus → read host port site → stoop out `STEM_RUN` to column `stemX` → drop stem → optional passive tee → **only then** size/place branch box under that host (`hostBottom` stacks siblings) → attach N/E/S ports and leaf stubs/labels. | Branch `x` is stem-centred / collision-nudged; `y` is under host’s current bottom — **not** a global second laundry line of all non-buses. |
| 7 | **Dangling stubs** for single-owner nets that never got a wire. | Leaf labels share cells with stub ends. |
| 8 | Page bounds; paint is pure raster + join/hop (no re-place). | |

So “spacing” is **emergent** from gap constants, channel rows, stem run,
and host bottoms — not a free orthogonal packing of all boxes first.

Sketch of the **structural** result (not glyph-perfect):

```
  [ BUS A ]──── netY channels (H rails) ────[ BUS B ]
      │ stemX (STEM_RUN out of host port)
      │
      ├──── tee ── [ passive ]     ← only on some fixtures (table01)
      │
   [ BRANCH ]   ← under THIS host’s stack, not global row of all secondaries
```

Side-by-side:

| Expectation | Ideal CAD picture | spine-v1 |
|-------------|-------------------|----------|
| Second tier of modules | One global `y` below buses | Per-**host** stacks + stem-driven `x` |
| Clear space before wires | Yes | Wires and Knuth box placement interleave |
| Bus height | Mostly pin count / faces | Driven by **channel `netY`** |
| Branch attachment | Route after both boxes exist | Stem from **existing** bus `PortGeom` to child placed **after** stem column exists |
| Backbone alignment | Free corridor between rows | Shared **`netY`** through bus ports |

#### HITL under a place file (rfc/004) — two loops, one IR

Paper model: module chrome → pack/tape boxes → draw wires → rework place if
ugly. Spine full bootstrap remains the **no-file** path for simple fixtures.

```
                 table (electrical SoT)
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
     glyph size + ports          place YAML (human)
     (labels, faces, pad)        x/y, sides [(w/h ref)]
            │                           │
            └─────────────┬─────────────┘
                          ▼
              PLACE LOOP art (modules only)
                          │
                   (later) ROUTE LOOP
                   fixed ports → segments
                          ▼
                    full art paint
```

- **Layout path:** place modules from dossier; **route-v1** after place
  (unless `-m`); paint. CLI: `TABLE.md LAYOUT.yaml` or `-m …` for
  modules-only. Emit: `--emit-layout TABLE.md`.
  Transitional binary: `node src/render.js` (**Gap:** `ascw` name).
- **Route stage (`src/layout/route-v1.js`):** pure interconnect from fixed
  ports; does not rewrite layout YAML; **no `--route` flag** (default when
  layout present and not `-m`). MVP: collinear H/V, face-exit + L elbows,
  greedy MST, leaf stubs; hop via paint. Quality polish ongoing.
- **Abandoned:** spine+slide / rigid wire morph as HITL interconnect strategy.

Cross-refs: [LAYOUT.md](LAYOUT.md), [STATUS.md](STATUS.md),
[rfc/004](rfc/004-hitl-place-loop-and-modules-only.md), §6 (hops).

### 3.5 Paint

**In:** `LayoutPlan` + `GlyphProfile`.  
**Out:** `string` (ASCII art).

Paint:

- rasterizes boxes, labels, port markers, wire segments;
- resolves overlaps with a simple precedence (box border < wire < port marker < text — exact order TBD in code comments + fixtures);
- resolves **joins** (same net) into tee / `┼` glyphs where segments meet;
- resolves **hops** (different nets, H∩V) into the profile hop glyph (`\\`);
- never paints a join where net ids differ (see SPEC §9.2–9.3).

On-screen names for reviewing that chrome (pin, stub, elbow, face, cell):
[GLYPHS.md](GLYPHS.md) § Chrome vocabulary. Engine terms for constructive
place/route remain in §3.4.2.

Paint must not re-decide which component is a passive vs branch.

#### Glyph profiles

```
GlyphProfile {
  name: "classic" | "ascii7" | ...
  box: { tl,tr,bl,br,h,v }
  port: { default: "●", ... }
  wire: { h, v, teeE, teeW, teeN, teeS, join4, hop }  // classic hop = '\\'
  // future: busFold, pageClip, connectorStyles by port kind
}
```

**Different connector conventions** = different profiles (and maybe
port-kind styling), not a different table language.

---

## 4. Module layout (code)

Current / target shape (names indicative; split glyph/place/route next):

```
src/
  render.js              # CLI: [flags] TABLE.md [LAYOUT.yaml]
  parse.js               # Markdown table + footnotes
  model.js               # Ast → Netlist
  classify.js            # roles
  layout/
    spine-v1.js          # bootstrap constructive place+route (§3.4.2)
    loader.js            # layout YAML validate vs netlist (census)
    from-document.js     # modules-from-dossier place (chrome only)
    route-v1.js          # route after place under layout file (unless -m)
    emit.js              # --emit-layout YAML seed from plan PortGeom
  paint/
    grid.js
    classic.js
  index.js               # render(markdown, options) / debugStages
  selftest.js
```

v1 may live in fewer files if clearer; **stage boundaries** matter more
than file count.

### 4.1 Library API (intent)

```js
const { render, parse, buildNetlist } = require('./src');
const art = render(markdownString, {
  layout: { policy: 'spine-v1' },
  paint: { profile: 'classic' }
});
```

CLI wraps that. Skill wraps the CLI.

---

## 5. Why this layering future-proofs complexity

Features you called out map onto **single seams**:

| Future feature | Where it lives | What must not break |
|----------------|----------------|---------------------|
| Alternate connectors (`○`, crowfoot, stubs) | `GlyphProfile` / port style | Netlist, table language |
| Folded net buses (draw 8 wires as a thick bundle) | Layout policy + paint | Incidence IR still has distinct nets |
| Multiple pages / sheets | `LayoutPlan.pages[]` + page break hints in frontmatter | Single-page still a plan with one page |
| Pin side constraints | Layout sidecar → glyph/place/route | Default auto side assignment remains |
| Passive orientation | Layout sidecar (`h`/`v`) → glyph/place | Still two ports on distinct nets |
| Layout-only groups | Glyph composition + layout sidecar | Flat netlist remains electrical SoT |
| Boundary alignment | Layout placement preference (`edge`) | No electrical semantics |
| Richer passives (series R between two connectors) | Passive/route generalization | Still ports on nets |
| SVG/HTML backend | New paint target from `LayoutPlan` | Same layout plan |
| Multi-board / harness | Multiple netlists + composition policy | Table per board remains simple |

### 5.1 Folded buses (design intent only)

Electrical IR keeps **one net per row** (or explicit bus groups later).  
Folded drawing is a **layout presentation** of several channels that share
path segments. Do not collapse nets in the table just to get a thinner picture.

Possible later authoring:

```yaml
# frontmatter
paint:
  fold:
    - { name: I2C, nets: ["I2C DATA", "I2C CLOCK"] }
```

or a non-electrical group block under the table. Exact syntax TBD; seam is clear.

### 5.2 Multi-page (design intent only)

Options that keep content clean:

- frontmatter page width / max components per spine;
- explicit `---` sheet breaks between tables;
- one table, layout partitions into `pages[]`.

IR stays one netlist (or a netlist per sheet if intentionally disconnected).

### 5.3 Connector conventions

Port marker is not sacred. Examples:

| Profile | Port | Notes |
|---------|------|-------|
| `classic` | `●` | current default |
| `ascii7` | `o` or `+` | 7-bit friendly |
| `schematic-lite` | `○` / hollow | future |
| per-kind | power vs signal markers | needs optional port kinds |

Kinds may later derive from net name patterns (`GND`, `3V3`) or footnotes —
derivation is classify/layout adjacent; glyphs stay in paint.

---

## 6. Layout philosophy (`spine-v1` bootstrap)

For **code order of operations** and why large layout-doc moves interact badly
with existing segments, read §3.4.2 first. This section is the geometric
ideology that constructive spine tries to approximate.

Think **channel routing on a character grid**, not force-directed graphs.

```
  [ BUS A ]──── channels (nets as rows) ────[ BUS B ]
      │
      │ stem (fixed net)         3.3V
      ├──────────── tee ──────────│
      residual stem               [ R ]  ← passive between two nets
      │
    [BRANCH]
```

### 6.1 Net channel order

Painting order may differ from table order. Heuristics:

1. Nets shared by most bus pairs gravitate to the backbone stack.
2. Nets that only serve branches prefer edge channels (easier vertical drop).
3. Floating power often near outer channels or free-labeled at leaves.
4. Passives want their two nets easy to reach (adjacent channels help, not required).

### 6.2 Coordinates

- Origin top-left, `x` right, `y` down.
- Box interior padding ≥1 character where labels sit.
- East ports for left bus facing a right bus; west ports mirror.
- Branch ports prefer south face of carrier / north face of child.

### 6.3 Routing rules (minimum)

- Segments axis-aligned only.
- Prefer: out from port → horizontal/vertical to channel → run → drop to target.
- **Join** (same net, ≥3-way): paint tee glyphs (`├┤┬┴`); four-way same-net → `┼`.
- **Hop** (different nets, orthogonal through-cell): paint hop `\\`. Do **not**
  use `┼` or a tee. Hops are allowed whenever layout geometry requires them
  (classic case: branch stem dropping past horizontal power/I2C runs).
- Prefer re-route over hop only when it stays simple; hop is not a last resort shame.
- Never route through a box interior (around or stop at port).
- Passive bodies are obstacles with two port endpoints — hard points that
  nets route **to**, not corridors nets route **through**.

Paint must know **which net owns each segment** so H∩V can choose join vs hop.
Grid cells store occupant net id(s), not only characters.

---

## 7. Configuration surface

Growth path without poisoning the table:

| Layer | Mechanism | Examples |
|-------|-----------|----------|
| Content | Markdown table | nets, pins, `x`, `°` |
| Content footnotes | Abbreviations | long BOM names |
| Geometry | Sibling layout YAML | positions, pin order/faces, passive axis, groups, edge alignment |
| Presentation | YAML frontmatter (later) | policy, profile, fold, page size |
| Component metadata | Specified side table/sibling (later) | refdes type/value/spec; no net meaning |
| CLI flags | override frontmatter | `--profile ascii7` |

v1 may ignore frontmatter entirely. Parsing should not crash on unknown keys
once frontmatter exists (warn).

---

## 8. Testing strategy

1. **Unit:** parse fixtures, classification of `table01`, channel inventories.
2. **Golden v1:** `node src/render.js examples/table01.md` reviewed against `art01.md`.
   - Start with **human accept** + checked-in `examples/golden01.md` when stable.
   - Avoid brittle full-string equality until paint settles; prefer structural asserts
     (contains pin labels, box titles, passive tied into both nets).
3. **Structural tests** on `LayoutPlan` (port coords on box edges, wires endpoint-match ports).
4. Later: multi-fixture matrix `tableNN`.

No visual SVG diff pipeline needed for v1.

---

## 9. Tool vs skill

| Piece | Role |
|-------|------|
| `src/*` | **Tool** — deterministic library + CLI |
| `skill/SKILL.md` | Optional thin LLM client: table draft + invoke CLI |
| User `HARDWARE.md` | Owns settled tables + layout (when used) + art |

The skill must not re-implement place/route in prose.

Install under `~/.pi/agent/skills/` only after the tool + layout loop is pleasant.

---

## 10. Relationship to current code

Pipeline modules exist under `src/` (parse, model, classify, layout/spine-v1,
paint). Place and route are still largely fused in `spine-v1.js`.

**Current:** modules-from-dossier + route-v1 under layout file (`-m` skips
route); spine bootstrap when table-only; shared chrome (`layout/chrome.js`).
**Next:** floating route = spine policy; cascade remainder; optional goldens
via `npm run golden`. See LAYOUT.md §10 and STATUS.md.

---

## 11. Design principles (checklist)

When a change is proposed, ask:

1. Does it alter electrical meaning, or only presentation/placement?
2. Can it live in IR / place / route / paint / layout-doc without new table syntax?
3. Is this a human-in-the-loop concern better solved by a layout sidecar (rfc/001)?
4. Is there a fixture that will lock the behaviour?
5. Does it still work if we add a second paint target tomorrow?
6. Are we inventing general CAD, or covering the wiring-block genre?

If (5) drifts toward CAD, stop and re-read ROADMAP non-goals.
