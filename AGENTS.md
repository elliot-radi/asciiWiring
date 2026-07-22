# AGENTS.md — asciiWiring

Guidance for humans and coding agents working in this repo.

## What this project is

A **tool** (Node library + CLI) that turns signal-first Markdown wiring
tables into ASCII module diagrams, plus an optional **pi skill** that only
teaches table drafting and how to run the tool. See `docs/STATUS.md`.

LLMs should **reliably** produce connectivity tables; geometry is tool +
human-in-the-loop (see `docs/HITL.md`), not freehand ASCII.

LLMs are bad at freehand box-drawing alignment. The skill avoids that by
working from a **signal-first connectivity table** (Markdown) that the user
and LLM iterate on. The table is the source of truth and documentation.
A **renderer** turns a settled table into ASCII art.

Target install location (when ready): `~/.pi/agent/skills/ascii-wiring/`  
Until then: **all development happens in this project directory.**

## Read these first

| Doc | Why |
|-----|-----|
| [README.md](README.md) | Public project overview |
| [docs/STATUS.md](docs/STATUS.md) | Tool vs skill; what is solid |
| [docs/HITL.md](docs/HITL.md) | Human vs computer workload |
| [docs/SPEC.md](docs/SPEC.md) | Normative table language |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Pipeline seams |
| [docs/ROADMAP.md](docs/ROADMAP.md) / [TODO.md](docs/TODO.md) | Phases + deferred |
| [docs/table01-walkthrough.md](docs/table01-walkthrough.md) | Early fixture walkthrough |

If SPEC/ARCHITECTURE and this file drift, **SPEC/ARCHITECTURE win** for
language and pipeline; update this file to match.

## Project layout

```
asciiWiring/
├── README.md
├── AGENTS.md                 # this file
├── docs/
│   ├── SPEC.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── table01-walkthrough.md
├── skill/
│   └── SKILL.md              # draft pi skill (workflow + table format)
├── src/
│   └── render.js             # incomplete Node renderer (not acceptance-ready)
└── examples/
    ├── table01.md            # canonical connectivity table (first fixture)
    ├── art01.md              # target-ish ASCII for table01 (acceptance visual)
    └── esp32-oled-button.md  # same circuit + abbreviation footnotes
```

Do **not** install into `~/.pi/agent/skills/` until the table→art path works
well enough that the skill is usable in real sessions.

## Architecture (summary)

```
User intent
  → LLM proposes Markdown wiring table  ← iterate with user
  → table lives in HARDWARE.md (docs)
  → renderer: parse → model → classify → layout → paint
  → ASCII art
```

No user-facing JSON middleware. JSON inside the renderer is fine if it helps
implementation; it is not the workflow interface.

**Extensibility (do not implement early — just don’t block):**

- Alternate connector glyphs → paint `GlyphProfile`
- Folded net buses → layout policy + paint (keep per-net rows in the table)
- Multi-page → `LayoutPlan.pages[]` + presentation config
- SVG backend → new paint target from the same plan

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ROADMAP.md](docs/ROADMAP.md).

### Wiring table (source of truth)

| Idea | Rule |
|------|------|
| Row | One electrical **net** (all cells on the row are the same node) |
| Column (after Signal) | One **component**; header becomes the box label |
| Cell = pin name | Named pin on that component for this net |
| Cell = `x` | Anonymous terminal (no pin label) of a component on this net — typical passive end |
| Cell empty | Not connected |
| Net name with `°` | **Floating** net (typically power/GND): may appear as a free label without full wire-trace back to the source |
| Net name without `°` | **Fixed** net: draw explicit wires between ports |
| Abbreviations | Optional footnotes under the table when labels are shortened for art |

Normative detail: [docs/SPEC.md](docs/SPEC.md). Example: `examples/table01.md`.

### Layout heuristics (design intent)

Derived from table connectivity, not freehand placement by the LLM:

1. **Bus** components — named pins on ≥2 *fixed* nets → side-by-side horizontal backbone; shared nets as horizontal pin-to-pin runs.
2. **Branch** components — named pin on ~1 net → hang vertically below / off the backbone.
3. **Passive** components — `x` on ≥2 *distinct* nets → small body with a lead into **each** net (e.g. pullup). Not a wire splice; nets stay separate.
4. **Net row order** for drawing may be reordered for compactness (group related fixed nets, put branch-friendly nets near the edge, floating optional). The **published table order is not required to match art row order**; keep the human table as documentation.
5. **Box width** ≈ widest text in that component (name + pin labels) + padding.
6. **Box height** ≈ title + pins used + padding + borders.
7. **Big blocks first** horizontally; smaller stuff on a second pass using vertical space.
8. Floating nets: fixed-style wires when adjacent/convenient; otherwise free labels (see GPIO5 / 10kΩ / BUTTON / 3V3 / GND region in `examples/art01.md`).
9. **Join vs hop:** tees/`┼` mean same-net joins; different nets crossing use insulated hop `\\` — never `┼` (SPEC §9.2–9.3).

Walk through on the first fixture: [docs/table01-walkthrough.md](docs/table01-walkthrough.md).

### “Done” for use as a skill

- Settled wiring **table** + clean **ASCII art** for the user’s circuit.
- SKILL.md that teaches the LLM the table format, iteration workflow, and how to run the renderer.
- Renderer reliable enough on simple multi-module cases (bus + branch + optional pullup-style passive).

## Where we stand

### Settled

- Workflow: intent → table ↔ user → art.
- Table semantics: nets, components, `x`, `°` floating nets (SPEC).
- Pipeline seams + extension map (ARCHITECTURE).
- Layout intent: bus / branch / passive; row reorder as render concern; floating vs fixed drawing.
- `x` = anonymous port; multi-net passives tee into nets rather than sitting series-on-stem.
- Join vs hop paint: tees/`┼` = same net; `\\` = insulated hop.
- First fixture working end-to-end: `examples/table01.md` → `examples/golden01.md`.
- Mermaid lesson: product discipline, not flowchart engines.
- Skill install still deferred until a couple more fixtures + SKILL harden (Phase 2).

### Implementation (Phase 1)

```
src/parse.js → model.js → classify.js → layout/spine-v1.js → paint/classic.js
src/render.js   CLI
src/index.js    library API render()
src/selftest.js smoke tests
```

### Next steps (priority order)

1. Optional layout polish (`art02` hand target, denser multi-branch packing).
2. Phase 2 remainder: license, package metadata, more CLI polish.
3. `table03` only after SPEC work in `docs/TODO.md` (feedthrough TB, exterior labels).
4. Only then install into `~/.pi/agent/skills/ascii-wiring/`.

## Running

```bash
cd /home/elliot/projects/asciiWiring
node src/render.js examples/table01.md
node src/render.js --debug examples/table01.md   # art on stdout, IR summary on stderr
node src/selftest.js
```

## Conventions for agents

- Prefer **editing under `~/projects/asciiWiring`**, not global pi skills dirs.
- Prefer **discussing or writing a short design note** for layout before large renderer rewrites if the algorithm is still ambiguous.
- Keep fixtures small and checkable; add new `tableNN` / `artNN` pairs for regressions.
- Don’t claim the skill is production-ready until table→art works for at least the ESP32+OLED+button case.
- User tone for product: human-readable table + symlinky ASCII for docs (`HARDWARE.md`-style), not EDA export.
- New features: content vs presentation vs layout policy vs paint — pick the right seam (ARCHITECTURE §5). Refuse kitchen-sink table syntax for cosmetics.
- Do not install Dagre/ELK/etc. as a shortcut around `spine-v1`.
