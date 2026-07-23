# Roadmap

**Status:** living plan. Near-term items are commitments for making the
tool loop real; later items are **scoped so we don’t paint ourselves into a
corner**, not promises.

---

## Guiding rule

> Table stays electrical SoT. Tool owns glyphs/route/paint. Humans own hard
> placement (layout sidecar → optional browser). Auto spine is bootstrap only.

> Ship boring correctness on fixtures before cleverness (folded buses,
> multi-page, fancy connectors, full GUI).

Extensibility lands as **seams** in [ARCHITECTURE.md](ARCHITECTURE.md), the
human-in-the-loop workload split in [HITL.md](HITL.md), and component drawing
conventions in [GLYPHS.md](GLYPHS.md).

---

## Phase 0 — Docs & fixtures

- [x] Project intent in `AGENTS.md`
- [x] Draft skill `skill/SKILL.md`
- [x] Fixture pair `examples/table01.md` + `examples/art01.md`
- [x] Spec / architecture / README for GitHub-facing discipline
- [x] Walkthrough note: `docs/table01-walkthrough.md`

**Exit:** a new contributor understands table language + pipeline without
reading chat history. ✅

---

## Phase 1 — Renderer rewrite (`spine-v1`) — **landed for table01**

Goal: `node src/render.js examples/table01.md` produces **human-acceptable**
art next to `art01.md`.

Pipeline modules under `src/`:

1. Parse table + abbreviations — `parse.js`
2. Build netlist IR — `model.js`
3. Classify bus / branch / passive — `classify.js`
4. Layout policy `spine-v1` — `layout/spine-v1.js`
5. Paint profile `classic` — `paint/classic.js` (+ `paint/grid.js`)
6. CLI / library — `render.js`, `index.js`
7. Smoke tests — `node src/selftest.js`

Acceptance:

- [x] Bus pair MCU↔OLED with DATA/CLOCK (and power runs)
- [x] BUTTON branch under GPIO5 stem
- [x] 10kΩ reads as pullup **between** BUTTON and 3.3V (tee on BUTTON; not series)
- [x] Floating GND/3.3V not dishonest
- [x] Checked-in `examples/golden01.md` (snapshot; not byte-identical to art01)
- [x] Minimal structural tests (`node src/selftest.js`)

Remaining polish (optional before Phase 2): tighter box widths vs art01, OLED
display-name abbreviations in art, bus title padding, more hop-on-stem cases.

**Explicitly out of phase 1:** multi-page, folded buses, alternate glyphs,
auto reverse-engineering of pin sides from silkscreen, perf optimisation.

---

## Phase 2 — Tool packaging + fixtures (largely done)

- [x] Library API `render(md, options)` (`src/index.js`)
- [x] Second fixture `table02` + `art02` + `golden02` + selftest
- [x] License MIT + `package.json`
- [x] STATUS / human-in-the-loop docs; skill framed as thin client
- [ ] Cleaner CLI errors
- [x] Configure GitHub remote and `package.json` repository URL

Deferred board detail: [TODO.md](TODO.md) (`table03+`).

---

## Phase 3 — Layout sidecar (next product bar)

See [HITL.md](HITL.md) (human-in-the-loop). Goal: table + **layout YAML** →
route/paint → art close to `art02` without heroic auto-place. Try this text
workflow properly before committing to GUI work.

- [ ] Define layout document schema (positions, optional `pinOrder`/`sides`;
      top-level maps keyed by stable component identity)
- [ ] Build glyphs independently of global placement
- [ ] Route + paint from netlist + layout
- [ ] CLI: `--layout examples/layout02.yaml`
- [ ] Freeze `layout02` for the golden path; keep spine bootstrap as default
- [ ] Add one expanded NTC-style fixture/layout to exercise repeated small
      components and boundary placement
- [ ] Record whether trial friction is **schema ergonomics** or
      **edit/render feedback latency**
- [ ] Optional: router collision “complaints” for minimal human answers

**Exit:** hand-authored layouts for table02 and the NTC trial regenerate
acceptable art stably, and the next UX investment is supported by evidence.

### Near-term glyph work

These tasks may land during/after the sidecar seams; their design home is
[GLYPHS.md](GLYPHS.md).

- [ ] Passive refdes-in-box rendering plus specified side-table metadata
- [ ] Layout-only grouping (`group`) with reusable/cached interiors
- [ ] Boundary preference/alignment (`edge`) for off-board component groups
- [ ] Passive horizontal/vertical orientation in the layout document

Authoring-time group templates are deliberately absent: they are triggered
only if flat-table repetition remains painful after layout-only grouping.

---

## Phase 4 — Optional UI + skill install

- [ ] **Gated:** build the three-pane grid browser editor only if the Phase 3
      trial identifies hand-editing/feedback as the bottleneck; use the **same**
      layout file, not a parallel format (target architecture in HITL)
- [ ] Package pi skill that only: drafts tables, runs CLI, opens layout loop
- [ ] Real HARDWARE.md adoption; more fixtures as needed

---

## Later themes (not scheduled — design already reserved)

Each item lists the **intended seam** so v1 doesn’t block it.

### A. Connector & glyph conventions

**Examples:** hollow pads, power bars, crow’s feet, 7-bit ASCII, double-line boxes.

| Seam | Notes |
|------|-------|
| `GlyphProfile` | Swap markers without retouching IR |
| Optional port kinds | power/signal/gnd derive from net names or metadata |
| CLI `--profile` | Presentation only |

No table break required for pure cosmetics.

### B. Folded net buses

**Examples:** draw I2C/SPI/memory bus as a thick bundle with a single trunk
and short stubs to pins; still electrically distinct nets.

| Seam | Notes |
|------|-------|
| Layout policy | Choose shared trunk geometry |
| Paint | Bundle glyphs / bus rippers |
| Optional frontmatter fold groups | Do **not** destroy per-net rows in the table |

### C. Multiple pages / sheets

**Examples:** MCU page + sensors page; constrained column width for GitHub.

| Seam | Notes |
|------|-------|
| `LayoutPlan.pages[]` | Already in architecture |
| Frontmatter / sheet breaks | Presentation + composition |
| Cross-page net references | Labels like `3V3 (sheet 1)` — paint/layout |

### D. Richer author hints (still optional)

| Hint | Seam |
|------|------|
| Pin side `GPIO8@E` | parse extension → port preference → layout |
| Component stereotype | side table / fm map → classify assist |
| Explicit pin order | layout |
| Important net highlight | paint |

Default path must remain: **no hints, still good art**.

### E. Alternate backends

| Backend | Seam |
|---------|------|
| SVG | Consume `LayoutPlan` |
| HTML sticky `<pre>` | trivially wrap ASCII |
| Dot/Graphviz debug dump | from IR, not from art |

### F. Validation beyond drawing

Strict mode: missing MCU pins vs a pinout database, undriven nets, etc.  
Separate checker; renderer stays a pure transform.

---

## Non-goals (product boundary)

We are **not** trying to become:

- KiCad / Eagle
- SPICE
- A general ASCII art studio
- A replacement for Mermaid flowcharts/sequence diagrams
- An LLM prompt that freehands boxes “more carefully”

If a request needs PCB copper, use EDA. If it needs flowchart control flow, use Mermaid. If it needs module wiring in a firmware README, use this.

---

## Decision log (short)

| Date | Decision |
|------|----------|
| 2026-04 | Table is SoT; no user-facing JSON workflow |
| 2026-04 | Nets are hyperedges; `°` = floating render kind |
| 2026-04 | Roles bus/branch/passive derived, not authored |
| 2026-04 | `x` = anonymous port; multi-net passive ≠ wire splice |
| 2026-04 | Join (same net) vs hop (different nets) distinguished in paint |
| 2026-04 | Classic insulated hop glyph is `\\`; `┼` is join-only |
| 2026-04 | Mermaid-like pipeline discipline; not Dagre/ELK for v1 |
| 2026-04 | Glyphs / pages / folds are layout+paint seams |
| 2026-04 | Skill install deferred until table01 acceptance |
| 2026-04 | table02 = real pump controller at **module** detail; NTC/TB/mains expanded later |
| 2026-04 | Feedthrough TB + exterior labels parked in docs/TODO.md (not sneaked into v1 table) |
| 2026-07 | Trial hand-edited layout sidecars before starting a browser editor |
| 2026-07 | Two-terminal glyphs use boxes; refdes in glyph and specs in metadata table |
| 2026-07 | Repeated sub-circuits start as layout-only groups; authoring templates deferred |
| 2026-07 | Generic module rotation remains unspecified pending fixture experience |

Add rows when something normative changes; update SPEC/ARCHITECTURE to match.
## Near-term (23 Jul 2026 direction)

1. **Hand-edit `layout.yaml` trial (Option A).** Exercise it against
   `table02` and a new NTC-style fixture. Goal: determine whether the pain
   is schema ergonomics or feedback-loop latency — see HITL.md decision
   log for why that distinction matters before deciding what to build next.
2. **Passive convention.** Refdes labeling in-glyph, side table for specs,
   standard prefix set. See GLYPHS.md.
3. **Layout-only grouping (Phase 1).** `group:` tag + cached-interior
   rendering; `edge:` tag + boundary-alignment pass. See GLYPHS.md.
4. **Gated: browser GUI (Option E).** Only after (1) concludes hand-edited
   YAML is the actual bottleneck. Target architecture already sketched in
   HITL.md's decision log so it doesn't need re-deriving when this comes up.

Group-template authoring (GLYPHS.md Phase 2) is intentionally not on this
list — it's a trigger-conditioned future item, not a scheduled one.
