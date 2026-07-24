# Project status

**Snapshot date:** 2026-07
**Last reviewed:** 2026-07

**Repo:** https://github.com/elliot-radi/asciiWiring

## One-liner

**Tool** (Node library + CLI) that turns signal-first Markdown **wiring
tables** into ASCII module diagrams, with an explicit **geometry layer**
(place YAML) so humans pack modules and (later) the computer routes.
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
- **CLI (today):** `node src/render.js`, `--debug`, `node src/selftest.js`
- **CLI (rfc/004 target):** `ascw [flags] TABLE.md [LAYOUT.yaml]`; see north star
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
| Layout YAML + HITL CLI | Loader + emit exist (legacy flags). **rfc/004 grammar:** `ascw [flags] TABLE.md [LAYOUT.yaml]`; `-m` / `--modules-only`; no `--route`. Default table+layout = place → route → paint (route no-op until Deliverable B). **Not implemented yet** |
| Real route under layout file | No-op stub first; real router later; same `ascw TABLE LAYOUT` |
| Browser floorplan | Compatible with 2-loop/1-IR model; no work until place-loop trial wants it. See rfc/001, rfc/004 |
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

Per [rfc/004](rfc/004-hitl-place-loop-and-modules-only.md):

1. **`ascw` CLI + modules-from-dossier + no-op route** (next) — grammar in
   rfc/004; table+layout draws place→route→paint with empty wires until a real
   router; `-m` skips route explicitly.
2. Hand-edit packing on table02: `--emit-layout` → edit YAML →
   `ascw TABLE LAYOUT` until the page reads.
3. **No further spine+slide / wire-morph** under a layout file (delete when
   new path lands).
4. **Real router** behind the same default table+layout invocation (Deliverable B)
   when packing is boring; bootstrap remains `ascw TABLE` (spine).
5. Glyph extras (group/edge) and browser only under fixture/UX pressure.
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
| `ascw` bin + `TABLE [LAYOUT]` grammar + `-m` | rfc/004 CLI locked | rfc/004, LAYOUT.md |
| Modules-from-dossier + no-op route under layout | rfc/004 Deliverable A | rfc/004, LAYOUT.md |
| Real router (same CLI, no new flag) | packing solid | rfc/004 Deliverable B |
| Layout-only grouping (`group:` tag) | place loop works | GLYPHS.md `Gap:` |
| Boundary alignment (`edge:` tag) | place loop works | GLYPHS.md `Gap:` |
| Browser GUI (Option E) | place-loop trial wants canvas | rfc/001, rfc/004 |
| Skill update for passive/table drafting | GLYPHS.md convention stable | skill/SKILL.md |
| `--emit-layout` seed helper | **done** (keep name; wire to `ascw`) | LAYOUT.md §9 |
| Optional authored `w`/`h` / padding override | after modules-only sizes stably | rfc/004, LAYOUT.md |
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
| [rfc/004](rfc/004-hitl-place-loop-and-modules-only.md) | History | HITL place loop, modules-only, route deferred |
| [examples/layout02.yaml](../examples/layout02.yaml) | Sketch | Place / layout schema example |
| [skill/SKILL.md](../skill/SKILL.md) | Draft | pi skill workflow |
