# Architecture

**Status:** draft — guides implementation and keeps future features from
wrecking v1.  
**Companion:** [SPEC.md](SPEC.md), [ROADMAP.md](ROADMAP.md)

---

## 1. Problem framing

We convert a **connectivity matrix** into monospaced **wiring art**.

That is the same *product* pattern as Mermaid (text description → diagram),
with different *domain geometry*:

| Mermaid flowchart | asciiWiring |
|-------------------|-------------|
| Nodes + directed edges | Components + **nets (hyperedges)** + ports |
| Generic rank/order layout | Genre layout: **bus / branch / passive** |
| SVG paint | Character grid paint |
| Author writes topology | Author writes **incidence table** (also documentation) |

We borrow Mermaid’s **discipline**, not its flowchart ontology or layout engines.

### 1.1 Discipline we keep

1. **Authors never assign coordinates.**
2. **Parse is separate from layout is separate from paint.**
3. **One genre done well** before a toolbox of genres.
4. **Presentation config ≠ content.**
5. **Fixtures beat opinions** (tableNN → artNN).
6. **Determinism** so docs and tests stay calm.

### 1.2 Discipline we reject (for v1)

- Dropping Dagre/ELK in as the primary placer (continuous graph layout vs
  integer wire channels is a mismatch).
- Encoding drawing instructions in the connectivity table.
- User-facing JSON as the workflow interface.

---

## 2. End-to-end pipeline

```
                    ┌─────────────────────────────────────────┐
  Markdown file ──► │ 1. PARSE       Table + footnotes (+fm)  │
                    └───────────────┬─────────────────────────┘
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │ 2. MODEL     Electrical IR (netlist)    │
                    │    nets, components, ports, flags       │
                    └───────────────┬─────────────────────────┘
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │ 3. CLASSIFY  Roles (bus/branch/passive) │
                    └───────────────┬─────────────────────────┘
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │ 4. LAYOUT      Policy → LayoutPlan      │
                    │    box rects, port points, wire routes, │
                    │    free labels, optional pages          │
                    └───────────────┬─────────────────────────┘
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │ 5. PAINT       Glyph profile → Grid     │
                    └───────────────┬─────────────────────────┘
                                    ▼
                               ASCII string
```

Each stage is pure data in → data out (plus diagnostics).  
CLI only: read file/stdin, print art/stderr.

Internal JSON/objects are fine. They are **not** the author interface.

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
- No coordinates.
- No glyph choices.

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

### 3.4 Layout

**In:** classified `Netlist` + `LayoutOptions`.  
**Out:** `LayoutPlan`.

```
LayoutOptions {
  policy: "spine-v1"        // only v1 policy
  // future: channel spacing, direction, page width, fold buses, …
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

#### Policy `spine-v1` (only policy for acceptance)

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

`spine-v1` is deliberately limited. Harder boards become new policies
(`spine-v2`, `multi-row`, `paged`), not conditionals sprinkled through paint.

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

Target shape (names indicative; rewrite may replace spike):

```
src/
  render.js           # CLI entry: read → pipeline → stdout
  parse.js            # Markdown table + footnotes (+ future fm)
  model.js            # Ast → Netlist + validate
  classify.js         # roles
  layout/
    spine-v1.js       # first policy
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

## 6. Layout philosophy (`spine-v1`)

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

## 9. Skill vs library

| Piece | Role |
|-------|------|
| `src/*` | Deterministic library + CLI |
| `skill/SKILL.md` | Teaches LLM when/how to write tables and invoke CLI |
| User repo `HARDWARE.md` | Owns settled tables + committed art |

The skill must not re-implement layout in prose. It stops at table authoring
quality and renderer invocation.

Install path (`~/.pi/agent/skills/ascii-wiring/`) only after acceptance.

---

## 10. Relationship to current spike

`src/render.js` was an exploratory spike (parse/classify/layout/paint crushed
together). Known issues include unclear naming and weak layout quality.

**Rewrite policy:** implement against this document’s stages; keep the spike only
as reference until `spine-v1` + classic paint pass `table01`. Prefer clean
pipeline over salvaging tangled helpers.

---

## 11. Design principles (checklist)

When a change is proposed, ask:

1. Does it alter electrical meaning, or only presentation?
2. Can it live in IR / policy / paint without new table syntax?
3. Is there a fixture that will lock the behaviour?
4. Does it still work if we add a second paint target tomorrow?
5. Are we inventing general CAD, or covering the wiring-block genre?

If (5) drifts toward CAD, stop and re-read ROADMAP non-goals.
