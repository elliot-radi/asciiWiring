# TODO — future language, fixtures, layout

Living list of deferred work. Near-term product roadmap stays in
[ROADMAP.md](ROADMAP.md). This file captures **design debt and ideas** from
real hardware (boiler-room pump controller) that must not be forgotten when
slicing fixtures.

---
## Graduated from "deferred" (was: "NTC expand") (23 Jul 2026)

The vague "NTC expand" bullet is now a real design, see
[GLYPHS.md](./GLYPHS.md):
- [ ] Implement `group:` tag recognition in the layout stage (Phase 1:
      layout-only grouping — cache internal geometry, redraw as one rigid
      glyph per instance).
- [ ] Implement `edge: S` (boundary/rail) tag: default dominant face +
      baseline-alignment pass, reusing the existing spine channel-alignment
      logic.
- [x] ~~Verify whether `spine-v1` honors layout `sides`~~ — it does **not**;
      spine assigns faces internally. Layout face banks belong to
      **from-document** only ([HITL.md](HITL.md), `examples/layout02.yaml`).
- [ ] Passive refdes rendering + side-table parsing (see GLYPHS.md for
      prefix conventions and table format).

## Layout document (schema + path) — product bar

- [x] Nested face-banked schema sketch committed (`examples/layout02.yaml`)
- [ ] Normative short write-up (`docs/LAYOUT.md` or HITL freeze)
- [ ] Loader + pin-census validation vs netlist
- [ ] Glyph/port sites from document; route without spine overlay
- [ ] CLI `--layout` → `policy: from-document` only

## Newly deferred (23 Jul 2026)

- Whole-component rotation UI (rotate-90 + per-pin face drag) — waiting on the passive convention settling in practice first.
- Group-template / instance authoring (Phase 2 in GLYPHS.md) — only pursue
  if Phase 1 layout-only grouping proves insufficient (i.e. table
  repetition across many group instances becomes genuinely painful).
- GUI tech stack (canvas rendering approach, framework, local vs. static
  app) — premature until the layout.yaml hand-edit trial (Option A) is
  actually done; see HITL.md decision log.
- `skill/SKILL.md` update to draft tables including passive refdes/side-
  table convention — blocked on GLYPHS.md existing as something to draft
  against; not urgent.

---
Previous update 2026-07 with the sidecar/glyph direction and the planned
NTC grouping fixture.

---

## Fixture ladder (same product, growing truth)

| ID | Intent | Status |
|----|--------|--------|
| `table01` | ESP32 + OLED + button + pullup passive | done (`golden01`) |
| `table02` | Pump controller **module-level**: MCU + ADS1115 + ZMCT + relay | table + art02 target + golden02; multi-pin module branches |
| `table03` | **One** NTC channel fully expanded: NTC + 2×TB + 100k + sense into AINx | not started |
| `table04` | Three NTC channels + CT + relay + mains TBs | not started |
| `artNN` / `goldenNN` | Hand target + generator snapshot per table | as each lands |


## Language / SPEC (before expanded channels)

### Feedthrough components (terminal blocks, jumpers)

- [ ] New layout role distinct from multi-net **passive** (avoid overloaded “bridge”).
  Suggested name: **`feedthrough`** (or `terminal`).
- [ ] Semantics: two ports, **same net**, continuity through the body.
  Art motif: `─│ TB01 │─` or vertical equivalent (orientation free).
- [ ] **Cell / incidence problem:** today one cell per component per net —
  cannot place two anonymous ends on one net. Design one of:
  - cell form `x-x` / `╡ prov` / similar dual-end marker on a single net row
  - port-count stereotype via frontmatter (`TB1: { role: feedthrough }`)
  - other SPEC’d form — **no silent hacks**
- [ ] No pin dots required; minimal 4×3-ish box optional for identity.

### Refdes + specification metadata

The visual convention has moved from vague deferral to a design direction in
[GLYPHS.md](GLYPHS.md): regular boxes, refdes in the glyph, and type/value/spec
in a side table. Existing value-named v1 components remain legal.

- [ ] Specify the metadata table (selection/heading, same-document vs sibling,
      duplicate/missing refs, relationship to abbreviations) before parsing it.
- [ ] Parse metadata without changing incidence/net semantics.
- [ ] Render passive refdes boxes and expose spec metadata to future backends.
- [ ] Mini-box sizing heuristic: common refdes of roughly 1–4 characters gets
      a compact box; longer valid refs still auto-size rather than truncate.
- [ ] Exterior net/note labels remain **presentation**, not incidence cells.

### NTC / sensor composites

- [ ] Model each NTC as an explicit two-terminal component (often with
      feedthrough TBs on its legs).
- [ ] Add a `table03`-class fixture for one complete NTC divider channel and a
      layout sidecar that exercises the refdes convention.
- [ ] Implement layout-only `group` metadata: retain explicit flat components
      and nets, but place an NTC channel as one rigid composite glyph.
- [ ] Define group external ports and equivalence/cache identity from fixtures;
      never infer or collapse connectivity.
- [ ] Implement geometry-only `edge: S` (and N/E/W) preference: dominant-face
      default plus perimeter baseline alignment, reusing extracted alignment
      machinery where practical.
- [ ] Do not collapse nets merely to make thinner art; folding is layout/paint.
- [ ] **Deferred:** authoring-time channel templates/instances. Revisit only if
      flat-table repetition remains painful after layout-only grouping.

### Rails & power

- [ ] Multi-rail boards (`°3.3V`, `°5V`, `°GND`) — layout should not assume single floating rail.
- [ ] Optional derivation of port kind (pwr/gnd/signal) from net name patterns.

### Commodities deferred from pump board prose

- [ ] I2C pullups on SDA/SCL (passives to 3.3V) when we want them explicit.
- [ ] ADS1115 ALERT/RDY + pullup.
- [ ] Decoupling caps (usually omitted from wiring-block diagrams).
- [ ] Relay COM/NC/NO full dry-contact + **mains TB pair** to 220VAC load.
- [ ] ADDR hardwire vs GPIO strap documented per build.

---

## Layout / paint capabilities

- [x] Branch off non-primary bus (needed for ZMCT → ADS CURRENT) — aim with `table02`
- [ ] Multiple branches without colliding stems (RELAY_CMD + others)
- [ ] Single-port nets as free labels / stub on module (TPO/TPU/AMB into AIN only)
- [ ] Dry-contact or open nets labeled without fake second module
- [ ] Passive **series** between two signal modules (LED + R motif), distinct from pullup-to-rail
- [ ] Feedthrough in-line on a routed net (TB on way from connector to ADC)
- [ ] Hop-heavy stems still rare but tested when pin order forces it
- [ ] Abbreviations applied to art titles when desired (`ADS1115` → short vs long)
- [ ] Passive `orientation: h | v` in the layout document
- [ ] Arbitrary module/group pin-face banking in **from-document** route
      (face list order N/S L→R, E/W T→B; spine never reads the sidecar)
- [ ] Boundary baseline alignment for `edge: N/E/S/W` peers

---

## Process

- [x] `table02` → hand target + generator snapshot + selftest case
- [x] Layout schema sketch (nested dossiers / four face lists) + hybrid path reverted
- [ ] Implement from-document path; then trial hand-edited YAML on `table02`
      and NTC fixture; record schema vs feedback pain only once obedience works
- [ ] After `table03` language decisions: update SPEC §6–§8 and ARCHITECTURE roles.
- [ ] Keep HARDWARE.md-style prose under tables for collapsed chemistry.

## Deferred interaction / product choices (2026-07)

- Whole-component rotation UI (rotate 90° and per-pin face dragging): wait for
  passive orientation and real sidecar usage to settle.
- Group-template/instance authoring: only if layout-only grouping leaves proven
  authoring pain.
- Browser technology (canvas/DOM/framework/local vs static): wait until the
  layout-sidecar trial shows whether a GUI is warranted.
- Route-on-drop versus live reroute during drag: decide with a GUI prototype,
  not in the file schema.
- Skill guidance for refdes/spec tables: update after the metadata format is
  specified and implemented, not merely from the drawing convention.

---

## Non-goals (still)

- Full PCB/schematic capture of boiler plant
- SPICE of NTC curves
- Auto BOM from the matrix
