# asciiWiring

**Signal-first Markdown wiring tables → ASCII module diagrams.**

This repository is a **tool** (Node library + CLI). An optional **pi skill**
(`skill/SKILL.md`) can teach an LLM how to draft tables and invoke the tool.

## Approach

Electrical connectivity lives in a human-readable **Markdown table** (the
source of truth, SoT). **Table-only** runs use a heuristic bootstrap placer
(`spine-v1`, place+route fused). **Layout YAML** is a separate path: place
modules from the dossier (`from-document`), then `route-v1` unless `-m`
(modules chrome only). See [rfc/004](docs/rfc/004-hitl-place-loop-and-modules-only.md),
[`docs/STATUS.md`](docs/STATUS.md) (pipeline map), and
[`docs/README.md`](docs/README.md). CLI: `node src/render.js` today; target
binary name `ascw`.

```
User intent →
  → Markdown wiring table     ← electrical SoT (iterate here)
  → tool: parse → IR* → place (with human assistance if needed)
  → route → paint
  → ASCII art for HARDWARE.md / READMEs / labs
```

\*IR = intermediate representation (of electrical modules/components)

Inspired in spirit by [Mermaid](https://mermaid.js.org/): structure in text,
mechanics in code. Domain model is electrical — **nets are hyperedges**,
components have **ports.** These are not flowchart graphs.

> **Status:** Live pyramid = `table01`/`art01`, `table02`/`art02`,
> `layout02.yaml`. Goldens not checked in until chrome unifies. HITL packing
> + route MVP exist. Do not expect arbitrary tables to yield production art
> without placement help. MIT-licensed.

## Why this exists

| Problem | Approach |
|--------|----------|
| Character alignment is brittle for LLMs | Don’t freehand the art |
| Wiring docs go stale | Table is the doc; art is generated |
| Pin tables alone don’t show topology | Art shows modules, buses, branches |
| Full EDA is overkill for module block diagrams | Lightweight ASCII for firmware/docs |
| Pure auto-layout hits a wall quickly | Human-in-the-loop layout YAML (place; route on frozen ports) |

## Quick example

**Table** (`examples/table01.md`):

```markdown
| Signal    | ESP32-C3 | OLED | BUTTON | R1   |
|-----------|----------|------|--------|------|
| I2C DATA  | GPIO8    | SDA  |        |      |
| I2C CLOCK | GPIO9    | SCK  |        |      |
| BUTTON    | GPIO5    |      | (NO)   |  x   |
| °3.3V     | 3V3      | VCC  |        |  x   |
| °GND      | GND      | GND  | GND    |      |
```

```bash
node src/render.js examples/table01.md
npm test
```

Hand look target: [`examples/art01.md`](examples/art01.md). Bootstrap
goldens deferred until shared chrome settles — see
[`docs/STATUS.md`](docs/STATUS.md).

```
# typical bootstrap shape (geometry may drift)
 ESP32-C3 ── I2C / power ── OLED
     │
     └─ BUTTON (+ pullup R1 on °3.3V)
```

## Repository layout

```
asciiWiring/
├── README.md LICENSE package.json AGENTS.md
├── docs/
│   ├── README.md           # documentation topology manifest
│   ├── STATUS.md           # current state and priorities
│   ├── SPEC.md             # table language contract
│   ├── ARCHITECTURE.md     # pipeline seams
│   ├── LAYOUT.md           # layout sidecar schema
│   ├── GLYPHS.md           # drawing conventions
│   └── rfc/                # design decision log (append-only)
├── skill/SKILL.md          # draft pi skill (thin)
├── src/                    # the tool
│   ├── render.js index.js selftest.js
│   ├── parse.js model.js classify.js
│   ├── layout/             # spine-v1, from-document, route-v1, loader, emit
│   └── paint/
└── examples/               # tableNN, artNN, layout02; goldenNN after chrome
```

## Documentation

For the full document topology, current status, and normative contracts,
see [`docs/README.md`](docs/README.md).

For contributor norms and agent rules, see [`AGENTS.md`](AGENTS.md).

## Running

```bash
git clone <your-fork-or-remote> asciiWiring
cd asciiWiring
npm install
node src/render.js examples/table01.md              # spine bootstrap
node src/render.js examples/table02.md
node src/render.js --emit-layout examples/table02.md
node src/render.js -m examples/table02.md examples/layout02.yaml   # chrome only
node src/render.js examples/table02.md examples/layout02.yaml      # place+route
node src/render.js --debug examples/table02.md
npm test
# optional: alias ascw='node src/render.js'
```

Requires Node ≥ 18. Runtime dependency: `js-yaml` (layout YAML).

## Design pillars

1. **Table is the electrical interface.** No coordinates in the matrix.
2. **Tool ≠ skill.** Library/CLI is the product; skill is optional UX for LLMs.
3. **Deterministic paint** given a netlist + layout.
4. **Domain genre:** module wiring / block diagrams — not full EDA.
5. **Human-in-the-loop packing** when auto bootstrap isn’t enough; **route**
   from fixed ports (not spine wire morph). See
   [rfc/001](docs/rfc/001-layout-sidecar-and-hitl.md),
   [rfc/004](docs/rfc/004-hitl-place-loop-and-modules-only.md).
6. **Docs-native:** Markdown in, ASCII out, diff-friendly.

## Out of scope

- PCB copper / footprints (use KiCad)
- SPICE / ERC as a primary mission
- Replacing Mermaid flowcharts
- LLM freehand box-drawing as the main path

## Contributing

- Prefer small commits; run `npm test` after layout/paint changes.
- Add `examples/tableNN` (+ art/golden) for regressions.
- Geometric ambiguity: discuss or write a short note before large rewrites.
- Don’t install into `~/.pi/agent/skills/` until the tool loop is boring.
- Don’t create new `docs/` files without updating `docs/README.md`.

## License

[MIT](LICENSE)
