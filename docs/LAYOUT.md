# Layout document — schema contract

**Status:** draft, normative for the **layout sidecar** YAML.  
**Companions:** [SPEC.md](SPEC.md) (table language),
[rfc/001-layout-sidecar-and-hitl.md](rfc/001-layout-sidecar-and-hitl.md)
(human-in-the-loop), [ARCHITECTURE.md](ARCHITECTURE.md) (pipeline seams),
[GLYPHS.md](GLYPHS.md) (drawing conventions).

Reference dossier: [`examples/layout02.yaml`](../examples/layout02.yaml).
Loaded by CLI as `TABLE.md LAYOUT.yaml` → `from-document` (+ `route-v1`
unless `-m`). Schema here is normative; the example is a living seed, not a
historical sketch.

---

## 1. Purpose and scope

The layout document owns **geometry only** — where each component box sits
and how its named pins are banked onto box faces. It owns **no** electrical
meaning: no nets, no wires, no connectivity. The wiring table
([SPEC.md](SPEC.md)) remains the single source of truth for what connects to
what.

Two things the layout document is **not**:

- Not a presentation profile (glyph set, page breaks, colors). Reserved.
- Not a free-form drawing file. There are no authored wire segments, no
  authored box width/height, no authored port pixel coordinates. The tool
  derives glyph metrics and routes from netlist + port sites.

### 1.1 Mode B — every table component must appear

`components` is **exhaustive**: every component column in the wiring table
must have a dossier, and no dossier may name a component absent from the
table. There is no sparse/fallback mode.

Rationale: a sparse file would force two placement engines (bootstrap +
from-document) to cooperate, which is exactly the hybrid-overlay fragility
that was prototyped and reverted (see
[rfc/001](rfc/001-layout-sidecar-and-hitl.md) decision log).
Mode B keeps `--layout` a single pure place→route path with one mental model.
The bootstrap auto-place policy already makes sensible face-banking choices
for many fixtures; the emitter preserves these decisions so HITL edits are
tweaks, not rewrites.

---

## 2. Policy split

Geometry path per invocation ([rfc/004](rfc/004-hitl-place-loop-and-modules-only.md)):

```text
ascw [flags] TABLE.md [LAYOUT.yaml]
```

| Invocation | Geometry | Stages | Art |
|------------|----------|--------|-----|
| `ascw TABLE.md` | none (bootstrap) | spine-v1 full | bootstrap full |
| `ascw --emit-layout TABLE.md` | write layout YAML | place seed only | YAML stdout |
| `ascw TABLE.md LAYOUT.yaml` | layout document | place → **route-v1** → paint | full pipeline |
| `ascw -m TABLE.md LAYOUT.yaml` | layout document | place → paint | modules chrome only |

**Only modules-art flag (no wires):** `-m` / `--modules-only`. **No `--route`.**
Routed art is default when a layout file is present and `-m` is absent.

Under a layout file, HITL **does not** morph spine wire lists into truth.
Interconnect is only the route stage (`route-v1`, or off under `-m`).

**Current code:** modules-from-dossier place; **route-v1** runs by default
under a layout file (`-m` / `--modules-only` skips route). CLI accepts
`TABLE.md [LAYOUT.yaml]`, `-m`, and deprecated `--layout FILE`. Binary may
still be `node src/render.js` (not yet `ascw`).

**Chrome parity:** shared `src/layout/chrome.js` (`sizeChrome`) for spine and
from-document (branch height, N/S pin-label rows, title clearance). Untouched
emit under `-m` should match spine branch `h` / `titleBottomInset` (selftest).
Router quality / floating policy polish ongoing (STATUS).

---

## 3. Document shape

YAML. One top-level key today: `components`.

```yaml
components:
  <TableName>:
    x: <int>            # top-left grid cell of the box border
    y: <int>
    sides:
      N: [<pin>, ...]   # left → right
      E: [<pin>, ...]   # top → bottom
      S: [<pin>, ...]   # left → right
      W: [<pin>, ...]   # top → bottom
```

Rules:

- **`components` is a map**, keyed by the component's table column name
  (stable identity). Not an array. One-component edit = one-line diff.
- **Each dossier has exactly `x`, `y`, `sides`.** Nothing else is honored yet
  (§7 lists reserved keys).
- **`x`, `y` are integers** (character cells). The box border's top-left cell.
  Width and height are **derived** by the glyph builder from pin count,
  labels, and padding rules.
- **`w`, `h` (optional, reference):** emit may write derived size for human
  orientation. **Gap:** loader should accept and currently may ignore; authored
  override / padding sacrifice is open (rfc/004), not required for modules-only.
- **`sides` always has all four faces** (`N`, `E`, `S`, `W`), even if empty.
  Empty face = `[]`. This is strict, not default-filled: a missing face key
  is an error (§6), so HITL editing never silently invents a face.
- **No `pinOrder` key.** Edge order *is* list order within each face list
  (§4). Separate pin-order maps were a redundant cross-cutting section in
  earlier sketches and are removed.
- **Pin tokens are the same strings as table cells.** A pin named `3V3` in
  the table is `3V3` in the dossier, not `VCC` or `3.3V`. Quote YAML strings
  as needed (e.g. `"5V"`).

### 3.1 What lives where (not in this file)

| Concern            | Home                                                     |
|--------------------|----------------------------------------------------------|
| Connectivity       | wiring table ([SPEC.md](SPEC.md))                        |
| Glyph drawing      | [GLYPHS.md](GLYPHS.md)                                   |
| Place policy seams | [ARCHITECTURE.md](ARCHITECTURE.md) §3.4                  |
| HITL workflow      | [rfc/001](rfc/001-layout-sidecar-and-hitl.md)            |
| Box origin + faces | **this file**                                            |

---

## 4. Face and edge order

On-screen reading of faces, pins, and boxes: [GLYPHS.md](GLYPHS.md) § Chrome
vocabulary. This section is the layout-document rule for list order only.

| Face | Edge traversal     |
|------|--------------------|
| `N`  | left → right       |
| `S`  | left → right       |
| `E`  | top → bottom       |
| `W`  | top → bottom       |

List order within a face is the order ports are placed along that edge. The
router consumes port sites in this order; reordering a list is the only way
to change pin order on a face (there is no separate order key).

---

## 5. Pin census (hard)

For each component, the **multiset of pins across all four faces** must equal
the component's named ports from the table. Specifically:

- Every named pin in the table's component column appears **exactly once**
  across `N ∪ E ∪ S ∪ W`.
- No pin appears on two faces, nor twice on one face.
- No dossier pin is absent from the table.
- Anonymous `x` ports (passive terminals) are **not** listed here — passives
  use a future `orientation` key (§7), not face banks. A passive appearing
  in `components` with a `sides` block is a schema error until passives are
  specced.

Bootstrap/pre-edit emit (§9) lists every named pin exactly once with a
tool-chosen initial banking. Hand-editing may move pins between faces and
reorder within a face; it may not drop, rename, duplicate, or invent pins.

---

## 6. Error table

`from-document` load is strict. Errors abort the render with a message naming
the component (and pin/face where relevant).

| # | Condition                                            | Error                          |
|---|------------------------------------------------------|--------------------------------|
| 1 | YAML parse failure                                   | `layout: malformed YAML`       |
| 2 | Missing top-level `components`                       | `layout: missing components`   |
| 3 | `components` is not a map                            | `layout: components not a map` |
| 4 | Dossier for a component not in the table             | `layout: unknown component <N>`|
| 5 | Table component with no dossier                      | `layout: missing component <N>`|
| 6 | Dossier missing `x` / `y` / `sides`                  | `layout: <N> missing <field>`  |
| 7 | `x` or `y` not an integer                            | `layout: <N>.<xy> not integer` |
| 8 | `sides` missing any of `N/E/S/W`                     | `layout: <N>.sides missing <F>`|
| 9 | `sides` has a key other than `N/E/S/W`               | `layout: <N>.sides bad face <F>`|
| 10| A face value is not a list                           | `layout: <N>.<F> not a list`   |
| 11| A pin appears that is not in the table column        | `layout: <N> unknown pin <P>`  |
| 12| A table pin missing from the dossier                 | `layout: <N> missing pin <P>`  |
| 13| A pin appears more than once (across or within faces)| `layout: <N> duplicate pin <P>`|
| 14| A pin list element is not a string                   | `layout: <N>.<F> bad pin`      |

Warnings (non-fatal, stderr only) are reserved for things like box overlap
or off-page coordinates, which belong to the route/paint stage rather than
load validation.

---

## 7. Reserved keys (no meaning yet)

The following may appear in dossiers later. **Today the loader rejects them**
as unknown fields (a strict superset of error #6's spirit) so nobody authors
against an unimplemented contract:

- `orientation: h | v` — passive axis ([GLYPHS.md](GLYPHS.md))
- `edge: N | E | S | W` — boundary/rail preference ([GLYPHS.md](GLYPHS.md))
- `group: <id>` — layout-only rigid group ([GLYPHS.md](GLYPHS.md))
- `refdes:`, `specs:` — passive labeling metadata ([GLYPHS.md](GLYPHS.md))

When one of these is specced, it moves out of this list and into §3.

---

## 8. Non-goals

- Authoring wire segments, junctions, or hops. Route is the tool's job.
- Authoring box `w`/`h` or per-port `x`/`y`. Glyph metrics are derived.
- Whole-module rotation. Unspecified pending passive-convention use
  ([GLYPHS.md](GLYPHS.md) open questions).
- Multiple pages / folds. v1 is one page.
- A parallel format to the wiring table. The table stays electrical SoT.
- KiCad/SPICE export. Out of scope entirely.

---

## 9. Authoring path (bootstrap emit)

Because Mode B requires a full dossier per component, hand-writing the first
file is tedious. Target CLI ([rfc/004](rfc/004-hitl-place-loop-and-modules-only.md)):

```bash
ascw --emit-layout examples/table02.md > my-layout.yaml
ascw examples/table02.md my-layout.yaml          # place → route → paint
ascw -m examples/table02.md my-layout.yaml       # modules only
```

`--emit-layout` dumps a valid Mode B document from the **current auto-place
policy (`spine-v1`)**: every component, every named pin banked onto the same
face spine chose, `x`/`y` from box origins. Component keys are emitted in
**spatial draw order** (top→bottom, then left→right) so the YAML tracks how
modules read on the page — not table column order. Implementation
(`src/layout/emit.js`) reads `PortGeom` + boxes on the layout plan; it does
not invent placement. Anonymous `x` ports stay off `sides` (empty banks on
passives). Hand reference: `examples/layout02.yaml`.

**Current:** `node src/render.js --emit-layout` and
`node src/render.js TABLE.md LAYOUT.yaml` (also `-m`). **Gap:** `ascw` bin name.

---

## 10. Implementation checklist

Tracks layout-document contract vs pipeline ([rfc/004](rfc/004-hitl-place-loop-and-modules-only.md)).

- [x] Loader + validate layout YAML vs netlist (census, schema errors per §6)
- [x] Bootstrap `--emit-layout` seeds dossiers from spine box origins + face banks
- [x] Grammar `TABLE.md [LAYOUT.yaml]` + `-m` / `--modules-only` (via `render.js`)
- [x] Modules-from-dossier place under layout file
- [x] Drop spine wire morph under layout file
- [x] Selftests: modules-only packing (`-m`); structural table01/02 + layout02
- [x] Real router MVP (`route-v1`) behind default table+layout (**no `--route`**)
- [x] Shared chrome helper (`layout/chrome.js`) + chrome parity selftest
- [ ] Floating route policy matches spine (bus rails; branch stubs — no ° trees)
- [ ] Router quality: same-face multi-pin nets, corridor choice
- [ ] **`ascw` bin** alias (optional rename; behavior already on `render.js`)
- [ ] Emit optional reference `w`/`h`; loader accept/ignore until override policy
- [ ] NTC-style fixture for repeated small components / boundary placement

---

## 11. Open questions

- Whether passives ever need micro face banks vs `orientation: h|v` only —
  deferred until real passive fixtures ([GLYPHS.md](GLYPHS.md)).
- Whether the loader should warn (not error) on box overlap at load time or
  leave it to the route stage. Lean: leave to route; load validates schema
  and census only.
- `schemaVersion` field — deferred until the first breaking change forces a
  versioned migration. Adding it preemptively is noise.
