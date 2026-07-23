# AGENTS.md — working in asciiWiring

Short rules for humans and coding agents.  
**Not** the design bible — that lives under `docs/`.

## What this is

- **Tool** (`src/`): Markdown wiring **table** → netlist → place/route/paint → **ASCII**.
- **Skill** (`skill/SKILL.md`): optional LLM workflow to draft tables and run the CLI. Thin client only.
- **Electrical SoT:** the connectivity table (no coordinates in the matrix).
- **Geometry direction:** auto `spine-v1` is a **bootstrap**. Prefer human-in-the-loop placement via a future **layout sidecar** (then maybe a browser editor). See `docs/HITL.md`.

Do **not** freehand multi-box ASCII in the LLM. Do **not** treat perfect auto-layout as the bar.

## Read before large changes

| Doc | When |
|-----|------|
| `docs/STATUS.md` | Orientation / what’s solid |
| `docs/HITL.md` | Who places vs who draws |
| `docs/GLYPHS.md` | How components/groups are drawn |
| `docs/SPEC.md` | Table language (normative) |
| `docs/ARCHITECTURE.md` | Pipeline seams |
| `docs/ROADMAP.md` / `docs/TODO.md` | Phases vs deferred |
| `examples/table0N.md` + `art0N` / `golden0N` | Fixtures |

**Drift rule:** SPEC / ARCHITECTURE / STATUS win over this file. Fix *this* file if it disagrees — don’t re-encode full specs here.

## Work here, not in global skills

- Edit **`~/projects/asciiWiring` only**.
- Do **not** install into `~/.pi/agent/skills/` until ROADMAP says the tool loop is ready.
- Remote: `https://github.com/elliot-radi/asciiWiring`

## Commands

```bash
node src/render.js examples/table01.md
node src/render.js examples/table02.md
node src/render.js --debug examples/table02.md   # art stdout; IR summary stderr
npm test                                         # src/selftest.js
```

After layout/paint/parse changes: **always** `npm test`. Prefer small edits over whole-file rewrites of `layout/`.

## Pipeline (names only)

```
parse → model (netlist IR) → classify → place → route → paint
```

Today place+route are still fused in `layout/spine-v1.js` bootstrap. Target split: glyphs + **layout document** + route + paint (`docs/HITL.md`, ROADMAP Phase 3).

## Agent do / don’t

**Do**

- Keep table electrical; put geometry in layout seams (sidecar when it exists), never new pin-cell magic for cosmetics.
- Pick the right layer: content (table) vs presentation (glyphs/paint) vs place policy vs route.
- Add/adjust `examples/tableNN` + art/golden when behavior changes.
- Discuss or write a short note before ambiguous geometry/language changes.
- For multi-net `x` passives: two nets + body, **not** series-on-stem.
- Joins = same net (`├┤┬┴`, rare `┼`). Different nets crossing = hop `\` only.

**Don’t**

- Claim skill production-ready or install global skill early.
- Pull Dagre/ELK/force-directed as a substitute for domain place+route.
- Encode feedthrough TBs / exterior labels without SPEC + TODO decisions.
- Blow the ontology into general CAD or Mermaid-flowchart clones.
- Large `spine-v1.js` rewrites without syntax check + tests (past footgun).

## Current priority (check STATUS/ROADMAP if stale)

1. Layout **sidecar** + route/paint from netlist+layout (prove on table02 ≈ art02).  
2. Keep spine bootstrap for simple cases.  
3. Glyph growth (refdes, layout-only NTC groups) per `docs/GLYPHS.md` / `docs/TODO.md`.
4. Language growth (especially feedthrough TB incidence) only per `docs/TODO.md`.
5. Skill packaging last.

## Tone

Doc-native firmware/hardware notes (`HARDWARE.md`), not EDA export cosplay.
