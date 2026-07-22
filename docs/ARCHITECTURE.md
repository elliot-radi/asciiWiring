# Architecture

**Status:** draft — guides the **tool** implementation.  
**Companions:** [SPEC.md](SPEC.md), [HITL.md](HITL.md), [STATUS.md](STATUS.md),
[ROADMAP.md](ROADMAP.md)

Product: Node library + CLI. Optional pi skill only drafts tables and invokes
the tool (`skill/SKILL.md`) — it is not the placer.

---

## 1. Problem framing

We convert a **connectivity matrix** into monospaced **wiring art**, with
geometry increasingly split between bootstrap auto-place and human-owned
layout documents ([HITL.md](HITL.md)).

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
  layoutDocument?: object               // future: positions, pinOrder, sides
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

#### Policy `spine-v1` (bootstrap placer — implemented)

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
([HITL.md](HITL.md)), not endless new spine heuristics. Optional future auto
policies (`multi-row`, `paged`) must not block the sidecar path.

### 3.5 Paint

**In:** `LayoutPlan` + `GlyphProfile`.  
**Out:** `string` (ASCII art).

Paint:

- rasterizes boxes, labels, port markers, wire segments;
- resolves overlaps with a simple precedence (box border < wire < port marker < text — exact order TBD in code comments + fixtures);
- resolves **joins** (same net) into tee / `┼` glyphs where segments meet;
- resolves **hops** (different nets, H∩V) into the profile hop glyph (`\\`);
- never paints a join where net ids differ (see SPEC §9.2–9.3).

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

Current / target shape (names indicative; split place vs route next):

```
src/
  render.js           # CLI entry: read → pipeline → stdout
  parse.js            # Markdown table + footnotes (+ future fm)
  model.js            # Ast → Netlist + validate
  classify.js         # roles
  layout/
    spine-v1.js       # bootstrap placer (+ fused route today)
    index.js          # pick policy
  paint/
    grid.js           # sparse/dense char buffer helpers
    classic.js        # glyph profile + rasterize
  index.js            # library API: render(markdown, options) → string
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
| Pin side constraints | Optional port hints → layout | Default auto side assignment remains |
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
| Presentation | YAML frontmatter (later) | policy, profile, fold, page size |
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

**Next structural work:** layout document load + route-from-layout + keep spine
as bootstrap default ([ROADMAP.md](ROADMAP.md) Phase 3, [HITL.md](HITL.md)).

---

## 11. Design principles (checklist)

When a change is proposed, ask:

1. Does it alter electrical meaning, or only presentation/placement?
2. Can it live in IR / place / route / paint / layout-doc without new table syntax?
3. Is this a human-in-the-loop concern better solved by a layout sidecar ([HITL.md](HITL.md))?
4. Is there a fixture that will lock the behaviour?
5. Does it still work if we add a second paint target tomorrow?
6. Are we inventing general CAD, or covering the wiring-block genre?

If (5) drifts toward CAD, stop and re-read ROADMAP non-goals.
