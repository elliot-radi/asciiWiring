# Project status

**Snapshot date:** 2026-07
**Last reviewed:** 2026-07

**Repo:** https://github.com/elliot-radi/asciiWiring

## One-liner

**Tool** (Node library + CLI) that turns signal-first Markdown **wiring
tables** into ASCII module diagrams — soon with an explicit **geometry
layer** (layout sidecar) so humans place, computers draw and route.
Optional **pi skill** is a thin client over the tool, not the whole product.

## Product framing: skill vs tool

| | **Tool** (`src/`, this repo) | **Skill** (`skill/SKILL.md`) |
|--|------------------------------|------------------------------|
| Is | Renderer, IR, fixtures, specs | LLM workflow: table draft, when to run CLI |
| Is not | “Just a prompt” | Full placement/routing engine |
| Ship | npm-/git-installable project | Copy under `~/.pi/agent/skills/` **later** |

## What is solid (keep)

- **Table as electrical SoT** — nets × components; no coordinates in matrix
- **Semantics:** named pins, `x` anonymous ports, `°` floating nets
- **Roles (derived):** bus / branch / passive (feedthrough still TODO)
- **Pipeline:** parse → netlist IR → classify → place → route → paint
- **Paint rules:** join tees / `┼` same-net; insulated hop `\` different nets
- **Passives:** multi-net body between nets, not series fake-on-stem
- **Modules:** named pin dots on boxes (MCU, ADC, relay, …)
- **Fixtures:**
  - `table01` / `art01` / `golden01` — ESP32 + OLED + button + pullup
  - `table02` / `art02` / `golden02` — pump controller **module-level**
- **CLI:** `node src/render.js`, `--debug`, `node src/selftest.js`
- **Docs topology:** [README.md](README.md) (manifest), SPEC, ARCHITECTURE,
  LAYOUT, GLYPHS, STATUS, AGENTS, RFCs

## What works path-wise today

```bash
node src/render.js examples/table01.md   # usable spine + branch + passive
node src/render.js examples/table02.md   # usable module-level multi-branch
node src/selftest.js                     # structural checks both fixtures
```

Auto place is **heuristic spine-v1** (one shot). Quality is “readable bootstrap,”
not guaranteed art-director output — especially off-spine stacks.

## What is intentionally incomplete

| Item | Notes |
|------|-------|
| Perfect auto placement | Bridge too far for pure heuristics; see rfc/001 |
| Layout sidecar file | `examples/layout02.yaml` loaded via `--layout`. **Spine-first course correction:** place+route stays spine-v1; YAML applies rigid x/y (identity when matching spine). Loader enforces pin census. See LAYOUT.md §10 |
| Browser floorplan | Gated editor for layout file; no work until sidecar trial identifies bottleneck. See rfc/001 |
| Passive refdes/spec metadata | Convention in GLYPHS.md; parser/render support not implemented |
| Layout-only grouping / edge alignment | Direction in GLYPHS.md; not implemented |
| Feedthrough TB semantics | Still needs table03+ language decisions. See backlog below |
| Whole-module rotation | Explicitly unspecified pending real passive/layout use |
| Skill install to `~/.pi` | After tool + layout loop is pleasant |

## Parallel tracks (don’t confuse them)

1. **Tool core** — IR freeze, glyph/route/paint, layout document, tests
2. **Human-in-the-loop geometry** — sidecar → diagnostics → maybe browser (rfc/001)
3. **Glyph growth** — refdes metadata, grouping, edge alignment (GLYPHS.md)
4. **Language growth** — feedthrough incidence semantics (backlog below)
5. **Skill** — table workflow only; invoke tool

## Current north star (sequence)

1. Layout loader + spine-first from-document + **`--emit-layout`** are wired
   (identity round-trip in selftest). See LAYOUT.md §9–§10.
2. Hand-edit trial on table02 (+ later NTC fixture): emit → tweak x/y → `--layout`
3. Distinguish schema-editing pain from slow visual feedback before choosing
   UX work
4. Add layout-only grouping / boundary alignment as fixture pressure requires
5. Optional: router complaints or grid browser, selected from trial evidence
6. Skill package when invocation story is boring

## Fixture ladder

| ID | Intent | Status |
|----|--------|--------|
| `table01` | ESP32 + OLED + button + pullup passive | done (`golden01`) |
| `table02` | Pump controller **module-level**: MCU + ADS1115 + ZMCT + relay | table + art02 target + golden02; multi-pin module branches |
| `table03` | **One** NTC channel fully expanded: NTC + 2×TB + 100k + sense into AINx | not started |
| `table04` | Three NTC channels + CT + relay + mains TBs | not started |

## Backlog

| Item | Blocked on | Home |
|------|-----------|------|
| Feedthrough TB semantics | table03 language design | Backlog (here) |
| Passive refdes rendering + side-table parsing | Glyph convention settled | GLYPHS.md `Gap:` |
| Layout-only grouping (`group:` tag) | from-document path works | GLYPHS.md `Gap:` |
| Boundary alignment (`edge:` tag) | from-document path works | GLYPHS.md `Gap:` |
| Browser GUI (Option E) | Hand-edit trial identifies YAML/feedback as bottleneck | rfc/001 target architecture |
| Skill update for passive/table drafting | GLYPHS.md convention stable | skill/SKILL.md |
| `render --emit-layout` helper | **done** — `src/layout/emit.js`, CLI `--emit-layout`; seeds from spine `PortGeom` | LAYOUT.md §9 |
| Router collision complaints | from-document path works | LAYOUT.md §10 |
| Multi-page / folded buses | V1 stable | rfc/000 later themes |
| Validation beyond drawing (strict mode) | Separate checker design | rfc/000 §F |

## Non-goals (still)

- KiCad/SPICE replacement
- LLM freehand ASCII as primary path
- User-facing JSON *instead of* the Markdown table

## Key docs map

| Doc | Layer | Role |
|-----|-------|------|
| [README.md](../README.md) | Public | Pitch, quickstart, pointer to docs |
| [docs/README.md](README.md) | Meta | Topology manifest and enforcement |
| [docs/SPEC.md](SPEC.md) | Contract | Table language |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md) | Contract | Pipeline seams |
| [docs/LAYOUT.md](LAYOUT.md) | Contract | Layout sidecar schema |
| [docs/GLYPHS.md](GLYPHS.md) | Contract | Drawing conventions |
| [docs/STATUS.md](STATUS.md) | Dashboard | **This file** — current state |
| [AGENTS.md](../AGENTS.md) | Norms | Contributor / agent rules |
| [rfc/000](rfc/000-electrical-model-and-pipeline.md) | History | Founding electrical and pipeline decisions |
| [rfc/001](rfc/001-layout-sidecar-and-hitl.md) | History | Layout sidecar + HITL options and decision |
| [rfc/002](rfc/002-table01-rendering.md) | History | Table01 algorithmic rationale |
| [rfc/003](rfc/003-docs-topology-and-rfc-process.md) | History | Documentation topology + RFC process |
| [examples/layout02.yaml](../examples/layout02.yaml) | Sketch | Layout schema example (unwired) |
| [skill/SKILL.md](../skill/SKILL.md) | Draft | pi skill workflow |
