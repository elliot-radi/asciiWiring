# Project status

**Snapshot date:** 2026-07

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

We outgrew “only a skill.” Keep the skill draft, but develop and version
**the tool** as the GitHub artifact.

## What is solid (keep)

- **Table as electrical SoT** — nets × components; no coordinates in matrix  
- **Semantics:** named pins, `x` anonymous ports, `°` floating nets  
- **Roles (derived):** bus / branch / passive (feedthrough still TODO)  
- **Pipeline idea:** parse → netlist IR → place → route → paint  
- **Paint rules:** join tees / `┼` same-net; insulated hop `\` different nets  
- **Passives:** multi-net body between nets, not series fake-on-stem; target
  glyph convention is a regular box with refdes inside and specs in metadata
- **Modules:** named pin dots on boxes (MCU, ADC, relay, …)  
- **Fixtures:**  
  - `table01` / `art01` / `golden01` — ESP32 + OLED + button + pullup  
  - `table02` / `art02` / `golden02` — pump controller **module-level**  
- **CLI:** `node src/render.js`, `--debug`, `node src/selftest.js`  
- **Docs:** SPEC, ARCHITECTURE, ROADMAP, TODO, HITL (human-in-the-loop), AGENTS, README  

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
|------|--------|
| Perfect auto placement | Bridge too far for pure heuristics; see HITL.md (human-in-the-loop) |
| Layout sidecar file | Next geometry SoT; hand-edit trial is the immediate product test |
| Browser floorplan | Gated editor *for that file*; no work until the sidecar trial identifies the bottleneck |
| Passive refdes/spec metadata | Convention documented in `docs/GLYPHS.md`; parser/render support not implemented |
| Layout-only grouping / edge alignment | Direction documented in `docs/GLYPHS.md`; not implemented |
| Feedthrough TB semantics | `docs/TODO.md` — still needs table03+ language decisions |
| Whole-module rotation | Explicitly unspecified pending real passive/layout use |
| Skill install to `~/.pi` | After tool + layout loop is pleasant |

## Parallel tracks (don’t confuse them)

1. **Tool core** — IR freeze, glyph/route/paint, layout document, tests  
2. **Human-in-the-loop geometry** — sidecar → diagnostics → maybe browser ([HITL.md](HITL.md))  
3. **Glyph growth** — refdes metadata, grouping, edge alignment ([GLYPHS.md](GLYPHS.md))
4. **Language growth** — feedthrough incidence semantics ([TODO.md](TODO.md))
5. **Skill** — table workflow only; invoke tool

## Current north star (sequence)

1. Extract/confirm pipeline seams; **layout YAML** load/save + route-from-layout
2. Trial hand-edited layouts on table02 and an NTC-style fixture
3. Distinguish schema-editing pain from slow visual feedback before choosing UX work
4. Add layout-only grouping / boundary alignment as fixture pressure requires
5. Optional: router complaints or grid browser, selected from trial evidence
6. Skill package when invocation story is boring

## Non-goals (still)

- KiCad/SPICE replacement  
- LLM freehand ASCII as primary path  
- User-facing JSON *instead of* the Markdown table  

## 23 Jul 2026 update: HITL direction decided for now — hand-editing
`layout.yaml` (Option A) is being trialed before any browser GUI work
(Option E) starts; see HITL.md decision log for the reasoning and the
target architecture kept on file for later. Passive component convention
(boxes + refdes + side table) and grouped-component handling (layout-only
grouping, Phase 1) are specified in the new GLYPHS.md, not yet implemented.
Component/module rotation remains explicitly unspec'd pending the passive
convention's real-world use.


## Key docs map

| Doc | Role |
|-----|------|
| [README.md](../README.md) | Public entry |
| [docs/SPEC.md](SPEC.md) | Table language |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md) | Pipeline seams |
| [docs/HITL.md](HITL.md) | Human-in-the-loop (HITL): who places vs draws |
| [docs/GLYPHS.md](GLYPHS.md) | Component drawing, grouping, and orientation conventions |
| [docs/ROADMAP.md](ROADMAP.md) | Phased work |
| [docs/TODO.md](TODO.md) | Deferred language/features |
| [AGENTS.md](../AGENTS.md) | Contributor / agent norms |
| [skill/SKILL.md](../skill/SKILL.md) | Draft pi skill |
