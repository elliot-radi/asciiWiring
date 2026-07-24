# asciiWiring

**Signal-first Markdown wiring tables → ASCII module diagrams.**

This repository is a **tool** (Node library + CLI). An optional **pi skill**
(`skill/SKILL.md`) can teach an LLM how to draft tables and invoke the tool.

## Approach

Electrical connectivity lives in a human-readable **Markdown table** (the
source of truth, SoT). Geometry today is a heuristic bootstrap (`spine-v1`).
Direction of travel: computers draw boxes and route wires; humans own hard
placement via a **layout sidecar**
([`examples/layout02.yaml`](examples/layout02.yaml); CLI `--layout <file.yaml>`).
Spine place/route first; YAML owns box `x`/`y` for HITL. See
[`docs/STATUS.md`](docs/STATUS.md) and [`docs/README.md`](docs/README.md).

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

> **Status:** Bootstrap renderer works on two fixtures (`table01`, `table02`).
> Do not expect arbitrary tables to yield production art without placement
> help. MIT-licensed.

## Why this exists

| Problem | Approach |
|--------|----------|
| Character alignment is brittle for LLMs | Don’t freehand the art |
| Wiring docs go stale | Table is the doc; art is generated |
| Pin tables alone don’t show topology | Art shows modules, buses, branches |
| Full EDA is overkill for module block diagrams | Lightweight ASCII for firmware/docs |
| Pure auto-layout hits a wall quickly | Human-in-the-loop layout dossier (`--layout`) |

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

**Output** (`examples/golden01.md`):
```
 ┌────────────┐         ┌────────────┐
 │ ESP32-C3   │         │ OLED       │
 │            │         │            │
 │        3V3 ●─────────● VCC        │
 │        GND ●─────────● GND        │
 │      GPIO8 ●─────────● SDA        │
 │      GPIO9 ●─────────● SCK        │
 │      GPIO5 ●───┐     └────────────┘
 └────────────┘   │           3.3V
                  │             │
                  │         ┌───┴──┐
                  ├─────────┤ 10kΩ │
                  │         └──────┘
                  │
            ┌─────●────┐
            │   (NO)   │
            │ BUTTON   │
            └─────●────┘
                  │
                 GND
```

Hand targets: `examples/art01.md`, `examples/art02.md`.  
Generator snapshots: `examples/golden01.md`, `examples/golden02.md`.

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
│   ├── layout/             # spine-v1, loader, from-document
│   └── paint/
└── examples/
    ├── table01 art01 golden01
    ├── table02 art02 golden02
    └── esp32-oled-button.md
```

## Documentation

For the full document topology, current status, and normative contracts,
see [`docs/README.md`](docs/README.md).

For contributor norms and agent rules, see [`AGENTS.md`](AGENTS.md).

## Running

```bash
git clone <your-fork-or-remote> asciiWiring
cd asciiWiring
node src/render.js examples/table01.md
node src/render.js examples/table02.md
node src/render.js --debug examples/table02.md   # IR summary on stderr
npm test                                         # → node src/selftest.js
```

Requires Node ≥ 18. Runtime dependency: `js-yaml` (layout sidecar).

## Design pillars

1. **Table is the electrical interface.** No coordinates in the matrix.
2. **Tool ≠ skill.** Library/CLI is the product; skill is optional UX for LLMs.
3. **Deterministic paint** given a netlist + layout.
4. **Domain genre:** module wiring / block diagrams — not full EDA.
5. **Human-in-the-loop placement** when auto bootstrap isn’t enough. See
   [rfc/001](docs/rfc/001-layout-sidecar-and-hitl.md).
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
