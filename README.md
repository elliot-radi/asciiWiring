# asciiWiring

**Signal-first Markdown wiring tables → ASCII module diagrams.**

This repository is a **tool** (Node library + CLI). An optional **pi skill**
(`skill/SKILL.md`) can teach an LLM how to draft tables and invoke the tool —
it is not the whole product.

Electrical connectivity lives in a human-readable **Markdown table** (the
source of truth). Geometry is still largely automatic today (heuristic
bootstrap). The direction of travel is a cleaner split: computers draw boxes
and route wires; humans own hard placement via a layout sidecar (and maybe a
browser editor later). See [docs/HITL.md](docs/HITL.md) and
[docs/STATUS.md](docs/STATUS.md).

```
User intent
  → Markdown wiring table     ← electrical SoT (iterate here)
  → tool: parse → IR → place → route → paint
  → ASCII art for HARDWARE.md / READMEs / labs
```

Inspired in spirit by [Mermaid](https://mermaid.js.org/): structure in text,
mechanics in code. Domain model is electrical — **nets are hyperedges**,
components have **ports** — not flowchart graphs.

> **Status:** Bootstrap renderer works on two fixtures (`table01`, `table02`).
> Do not expect arbitrary tables to yield production art without placement
> help. MIT-licensed; ready for a GitHub remote.

## Why this exists

| Problem | Approach |
|--------|----------|
| Character alignment is brittle for LLMs | Don’t freehand the art |
| Wiring docs go stale | Table is the doc; art is generated |
| Pin tables alone don’t show topology | Art shows modules, buses, branches |
| Full EDA is overkill for module block diagrams | Lightweight ASCII for firmware/docs |
| Pure auto-layout hits a wall quickly | Human-in-the-loop geometry (planned) |

## Quick example

**Table** (`examples/table01.md`):

```markdown
| Signal    | ESP32-C3 | OLED | BUTTON | 10kΩ |
|-----------|----------|------|--------|------|
| I2C DATA  | GPIO8    | SDA  |        |      |
| I2C CLOCK | GPIO9    | SCK  |        |      |
| BUTTON    | GPIO5    |      | (NO)   |  x   |
| °3.3V     | 3V3      | VCC  |        |  x   |
| °GND      | GND      | GND  | GND    |      |
```

```bash
node src/render.js examples/table01.md
node src/selftest.js
```

Hand targets: `examples/art01.md`, `examples/art02.md`.  
Generator snapshots: `examples/golden01.md`, `examples/golden02.md`.

## Repository layout

```
asciiWiring/
├── README.md LICENSE package.json AGENTS.md
├── docs/
│   ├── STATUS.md HITL.md SPEC.md ARCHITECTURE.md
│   ├── ROADMAP.md TODO.md table01-walkthrough.md
├── skill/SKILL.md          # draft pi skill (thin)
├── src/                    # the tool
│   ├── render.js index.js selftest.js
│   ├── parse.js model.js classify.js
│   ├── layout/spine-v1.js  # bootstrap place only
│   └── paint/
└── examples/
    ├── table01 art01 golden01
    ├── table02 art02 golden02
    └── esp32-oled-button.md
```

## Documentation map

| Doc | Read it for |
|-----|-------------|
| [docs/STATUS.md](docs/STATUS.md) | Where we are: tool vs skill |
| [docs/HITL.md](docs/HITL.md) | Human vs computer; browser optional |
| [docs/SPEC.md](docs/SPEC.md) | Table language (normative) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Pipeline seams |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phases |
| [docs/TODO.md](docs/TODO.md) | Deferred (TBs, NTC expand, …) |
| [AGENTS.md](AGENTS.md) | Contributor / agent norms |
| [skill/SKILL.md](skill/SKILL.md) | LLM table-workflow draft |

## Running

```bash
git clone <your-fork-or-remote> asciiWiring
cd asciiWiring
node src/render.js examples/table01.md
node src/render.js examples/table02.md
node src/render.js --debug examples/table02.md   # IR summary on stderr
npm test                                         # → node src/selftest.js
```

Requires Node ≥ 18 (no npm dependencies today).

## Design pillars

1. **Table is the electrical interface.** No coordinates in the matrix.
2. **Tool ≠ skill.** Library/CLI is the product; skill is optional UX for LLMs.
3. **Deterministic paint** given a netlist + layout.
4. **Domain genre:** module wiring / block diagrams — not full EDA.
5. **HITL for placement** when auto bootstrap isn’t enough ([HITL.md](docs/HITL.md)).
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

## License

[MIT](LICENSE)
