# Project status

**Snapshot date:** 2026-07  
**Last reviewed:** 2026-07 (living-doc pass: chrome Done; passive TYPENUM)

**Repo:** https://github.com/elliot-radi/asciiWiring

## One-liner

**Tool** (Node library + CLI) that turns signal-first Markdown **wiring
tables** into ASCII module diagrams, with an explicit **geometry layer**
(place YAML) so humans pack modules and the computer routes. Optional **pi
skill** is a thin client over the tool, not the whole product.

## Product framing: skill vs tool

| | **Tool** (`src/`, this repo) | **Skill** (`skill/SKILL.md`) |
|--|------------------------------|------------------------------|
| Is | Renderer, IR, fixtures, specs | LLM workflow: table draft, when to run CLI |
| Is not | “Just a prompt” | Full placement/routing engine |
| Ship | npm-/git-installable project | Copy under `~/.pi/agent/skills/` **later** |

## Pipeline map (who does what)

Do **not** treat “bootstrap” as one engine that also draws `-m`.

```text
table.md  (electrical SoT — nets, pins, ° floating)
   │
   ├─ no LAYOUT.yaml
   │     → spine-v1   (constructive place + route fused)
   │     → paint
   │     = bootstrap full art  (artNN target; optional goldenNN via npm run golden)
   │
   └─ LAYOUT.yaml
         → from-document   (chrome only: x/y, faces, sizes, pin dots/labels)
         │
         ├─ -m / --modules-only  → paint          (no wires)
         └─ default              → route-v1 → paint
```

| Invocation | Place | Route | Art |
|------------|-------|-------|-----|
| `node src/render.js TABLE` | spine-v1 | inside spine | bootstrap full |
| `node src/render.js --emit-layout TABLE` | spine seed → YAML | — | layout document |
| `node src/render.js -m TABLE LAYOUT` | from-document | off | modules chrome |
| `node src/render.js TABLE LAYOUT` | from-document | route-v1 | HITL full |

Binary name `ascw` still **Gap**; grammar is on `render.js`. Shell alias is fine.

**Chrome SoT:** `src/layout/chrome.js` (`sizeChrome`) — used by spine-v1 and
from-document. Branch N/S pin-label rows + title clearance are shared.
Paint still placer-agnostic (`titleVAlign` / `titleBottomInset`).

## What is solid (keep)

- **Table as electrical SoT** — nets × components; no coordinates in matrix
- **Semantics:** named pins, `x` anonymous ports, `°` floating nets
- **Roles (derived):** bus / branch / passive (feedthrough still TODO)
- **Stage seams:** parse → netlist → classify → place → route → paint
- **Paint rules:** join tees / `┼` same-net; insulated hop `\` different nets
- **Passives:** multi-net body between nets, not series fake-on-stem
- **Modules:** named pin dots on boxes
- **HITL path:** modules-from-dossier; morph deleted; `-m` skips route
- **route-v1 MVP:** wires under default table+layout (quality + floating policy
  still hardening)
- **CLI:** `TABLE.md [LAYOUT.yaml]`, `--emit-layout`, `-m`, `--debug`

## Example pyramid (rebuild substrate)

Live fixtures under `examples/`:

| File | Role |
|------|------|
| `table01.md` / `art01.md` | ESP32 + OLED + button + pullup `R1`; hand look target |
| `table02.md` / `art02.md` | Pump modules; sense/dry-contact **°**-marked; hand look target |
| `layout02.yaml` | Reference packing for table02 (matches spine emit banks) |

**Goldens:** optional (`npm run golden`); not CI-required.  
**No wing fixtures** (`table02b`, narrative twins) in tree.  
Local `examples_archive/` (gitignored) may hold old snapshots — not live SoT.

**Coherence bar:**

```text
table  (° honest)
  → artNN.md              human-look intent (geometry slop OK vs tool)
  → layoutNN.yaml         packing seed (hand or --emit-layout)
  → -m TABLE LAYOUT       modules chrome only
  → TABLE LAYOUT          route-v1 on frozen ports
  → goldenNN.md           optional accept: bootstrap ≈ art
```

Hard: chrome parity on untouched emit; floating policy matches bootstrap  
(spine: collinear **bus** floating rails; branch floating = stub + **net**
label — not a home-run tree off the rail).  
Soft: corridor geometry under route-v1 vs spine / art.

### Known pyramid nits (honest, not blockers)

| Nit | Notes |
|-----|-------|
| art01 wider packing | hand look target; tool still spine geometry (ok soft bar) |
| art02 °5V | two exterior stubs (not joined) — matches spine leaf policy |
| layout02 / emit `NO` | YAML may quote bareword `NO` on re-emit; banks match |
| Passive box labels | house rule: header `R1` not value; value in footnotes only |

## Current north star (sequence)

1. ~~Modules-from-dossier + CLI grammar~~ done.  
2. ~~Morph abandoned~~ done.  
3. ~~route-v1 MVP~~ done — **not** quality-frozen.  
4. ~~Example pyramid reset~~ done — five live files; tests on table/art/layout02.  
5. ~~Shared branch chrome~~ done — `layout/chrome.js`; spine + dossier; parity test.  
6. **Floating route = bootstrap policy** — collinear bus rails only for multipin
   bus `°`; branch floating = stub + exterior net label.  
7. **Cascade selftests** (C0–C5 remainder): SoT `°`; spine floating; emit banks;
   `-m` no wires; route policy rhyme (chrome parity already in).  
8. Optional regen golden01/golden02 ≈ art (manual `npm run golden` — not CI).  
9. Router polish (same-face °5V, corridors) only after (6)–(7).  
10. Glyph extras / browser / skill under pressure; table03 language when ready.

## What works path-wise today

```bash
node src/render.js examples/table01.md
node src/render.js examples/table02.md
node src/render.js --emit-layout examples/table02.md
node src/render.js -m examples/table02.md examples/layout02.yaml
node src/render.js examples/table02.md examples/layout02.yaml    # route-v1
npm test
```

Bootstrap under table-only remains “readable,” not art-director. HITL packing
is sturdy; route MVP promising; floating multi-drop still wrong vs spine until
(6).

## What is intentionally incomplete

| Item | Notes |
|------|-------|
| Goldens as CI truth | Optional snapshots via `npm run golden`; not required |
| Cascade route/floating parity tests | Planned with (7) |
| route-v1 floating policy | Must match spine, not MST-tree all `°` pins |
| Perfect auto placement | Still not the bar (rfc/001) |
| `ascw` bin name | Optional alias |
| Browser / skill install | After place+route loop is pleasant |
| Feedthrough TB / table03+ | Language design |
| Authorised `w`/`h`, group/edge | Layout contract gaps |

## Parallel tracks (don’t confuse them)

1. **Tool core** — route policy, cascade tests, IR freeze  
2. **HITL geometry** — packing YAML; route on frozen ports  
3. **Glyph growth** — group/edge; passive footnote polish (GLYPHS)  
4. **Language growth** — feedthrough (table03+)  
5. **Skill** — table draft; invoke tool  

## Backlog

| Item | Blocked on | Home |
|------|-----------|------|
| Cascade selftests C0–C5 remainder | floating policy | selftest.js |
| Floating route = spine policy | — | route-v1.js |
| Optional golden snapshots | human accept | `npm run golden` |
| route-v1 corridor / same-face polish | policy sound | route-v1.js |
| Feedthrough TB semantics | table03 language | SPEC + STATUS |
| Passive side-table parse (optional) | not needed for R1 headers | GLYPHS.md |
| `ascw` bin alias | optional | package.json |
| Layout `group:` / `edge:` | place loop product pressure | GLYPHS.md |
| Browser (Option E) | HITL trial wants canvas | rfc/001, rfc/004 |
| Skill package | loop boring | skill/SKILL.md |
| Authorised `w`/`h` | sizes stable | LAYOUT.md |
| Multi-page / folded buses | V1 stable | rfc/000 later |

## Non-goals (still)

- KiCad/SPICE replacement  
- LLM freehand ASCII as primary path  
- User-facing JSON *instead of* the Markdown table  
- Pixel-identity between spine and route-v1  

## Key docs map

| Doc | Layer | Role |
|-----|-------|------|
| [README.md](../README.md) | Public | Pitch, quickstart |
| [docs/README.md](README.md) | Meta | Topology manifest |
| [docs/SPEC.md](SPEC.md) | Contract | Table language (`°`, pins, paint electrical) |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md) | Contract | Pipeline seams, place/route split |
| [docs/LAYOUT.md](LAYOUT.md) | Contract | Layout sidecar schema |
| [docs/GLYPHS.md](GLYPHS.md) | Contract | Drawing / chrome vocabulary |
| [docs/STATUS.md](STATUS.md) | Dashboard | **This file** |
| [AGENTS.md](../AGENTS.md) | Norms | Agent / contributor rules |
| [rfc/000](rfc/000-electrical-model-and-pipeline.md) … [rfc/004](rfc/004-hitl-place-loop-and-modules-only.md) | History | Decisions |
| [examples/](../examples/) | Fixtures | tables, art, layout02; goldens later |
| [skill/SKILL.md](../skill/SKILL.md) | Draft | pi skill |
