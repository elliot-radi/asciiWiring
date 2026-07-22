# Project status

**Snapshot date:** 2026-04  
**Repo:** local `asciiWiring` (git initialized for GitHub)

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
- **Passives:** multi-net body between nets, not series fake-on-stem  
- **Modules:** named pin dots on boxes (MCU, ADC, relay, …)  
- **Fixtures:**  
  - `table01` / `art01` / `golden01` — ESP32 + OLED + button + pullup  
  - `table02` / `art02` / `golden02` — pump controller **module-level**  
- **CLI:** `node src/render.js`, `--debug`, `node src/selftest.js`  
- **Docs:** SPEC, ARCHITECTURE, ROADMAP, TODO, HITL, AGENTS, README  

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
| Perfect auto placement | Bridge too far for pure heuristics; see HITL.md |
| Layout sidecar file | Next geometry SoT (planned) |
| Browser floorplan | Optional editor *for that file*, not required day-one |
| Feedthrough TBs / NTC expand | `docs/TODO.md` — table03+ language |
| Skill install to `~/.pi` | After tool + layout loop is pleasant |
| License text beyond TBD | Choose on GitHub publish |

## Parallel tracks (don’t confuse them)

1. **Tool core** — IR freeze, glyph/route/paint, layout document, tests  
2. **HITL geometry** — sidecar → diagnostics → maybe browser ([HITL.md](HITL.md))  
3. **Language growth** — feedthrough, exterior labels ([TODO.md](TODO.md))  
4. **Skill** — table workflow only; invoke tool  

## Current north star (sequence)

1. Document + GitHub-ready repo (**this**)  
2. Extract/confirm pipeline seams; **layout YAML** load/save + route-from-layout  
3. Prove table02: hand layout → art close to `art02` without heuristic heroics  
4. Optional: router “complaints” prompts  
5. Optional: grid browser editing the same layout file  
6. Skill package when invocation story is boring  

## Non-goals (still)

- KiCad/SPICE replacement  
- LLM freehand ASCII as primary path  
- User-facing JSON *instead of* the Markdown table  

## Key docs map

| Doc | Role |
|-----|------|
| [README.md](../README.md) | Public entry |
| [docs/SPEC.md](SPEC.md) | Table language |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md) | Pipeline seams |
| [docs/HITL.md](HITL.md) | Human vs computer geometry |
| [docs/ROADMAP.md](ROADMAP.md) | Phased work |
| [docs/TODO.md](TODO.md) | Deferred language/features |
| [AGENTS.md](../AGENTS.md) | Contributor / agent norms |
| [skill/SKILL.md](../skill/SKILL.md) | Draft pi skill |
