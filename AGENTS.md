# AGENTS.md — working in asciiWiring

Short rules for humans and coding agents.  
**Not** the design bible — that lives under `docs/`.

## What this is

- **Tool** (`src/`): Markdown wiring **table** → netlist → place/route/paint → **ASCII**.
- **Skill** (`skill/SKILL.md`): optional LLM workflow to draft tables and run the CLI. Thin client only.
- **Electrical SoT:** the connectivity table (no coordinates in the matrix).
- **Geometry direction:** auto `spine-v1` is a **bootstrap only**. HITL path: nested layout sidecar (`examples/layout02.yaml` sketch) → route/paint from netlist+layout → optional browser later. See `docs/HITL.md`. CLI does **not** load the sidecar yet.

Do **not** freehand multi-box ASCII in the LLM. Do **not** treat perfect auto-layout as the bar. Do **not** re-thread layout overrides into `spine-v1.js` (hybrid overlay — tried and reverted).

## Read before large changes

| Doc | When |
|-----|------|
| `docs/STATUS.md` | Orientation / what’s solid |
| `docs/HITL.md` | Who places vs who draws + layout YAML shape |
| `docs/LAYOUT.md` | Layout sidecar schema (normative) |
| `docs/GLYPHS.md` | How components/groups are drawn |
| `docs/SPEC.md` | Table language (normative) |
| `docs/ARCHITECTURE.md` | Pipeline seams |
| `docs/ROADMAP.md` / `docs/TODO.md` | Phases vs deferred |
| `examples/table0N.md` + `art0N` / `golden0N` | Fixtures |
| `examples/layout02.yaml` | Unwired layout schema sketch (face-banked) |

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

After layout/paint/parse changes: **always** `npm test`. Prefer small edits over whole-file rewrites of `layout/`. No `--layout` flag until a real from-document path exists.

## Pipeline (names only)

```
parse → model (netlist IR) → classify → place → route → paint
```

Today place+route are still fused in `layout/spine-v1.js` (bootstrap). Target: **glyph from layout dossier** + **route from port sites** + paint — not fingertips on spine heuristics (`docs/HITL.md`, ROADMAP Phase 3).

## Agent do / don’t

**Do**

- Keep table electrical; put geometry in layout seams (sidecar sketch → real loader later), never new pin-cell magic for cosmetics.
- Pick the right layer: content (table) vs presentation (glyphs/paint) vs place policy vs route.
- Implement layout in **increments** with IR/acceptance checks; prefer a separate `from-document` path over overlaying `spine-v1`.
- Add/adjust `examples/tableNN` + art/golden when bootstrap behavior changes; keep `layout02.yaml` as schema sketch until wired.
- Discuss or write a short note before ambiguous geometry/language changes.
- For multi-net `x` passives: two nets + body, **not** series-on-stem.
- Joins = same net (`├┤┬┴`, rare `┼`). Different nets crossing = hop `\` only.

**Don’t**

- Claim skill production-ready or install global skill early.
- Pull Dagre/ELK/force-directed as a substitute for domain place+route.
- Encode feedthrough TBs / exterior labels without SPEC + TODO decisions.
- Blow the ontology into general CAD or Mermaid-flowchart clones.
- Large `spine-v1.js` rewrites without syntax check + tests (past footgun).
- Reintroduce hybrid “layoutDoc overrides inside spine-v1” without an explicit decision to abandon from-document.

## Current priority (check STATUS/ROADMAP if stale)

1. Freeze layout schema in docs (`HITL` / future `LAYOUT.md`) from `examples/layout02.yaml`; implement **from-document** in slices (loader → glyphs/ports → route).  
2. Keep spine bootstrap for simple cases / default CLI.  
3. Glyph growth (refdes, layout-only NTC groups) per `docs/GLYPHS.md` / `docs/TODO.md`.
4. Language growth (especially feedthrough TB incidence) only per `docs/TODO.md`.
5. Skill packaging last.

## Tone

Doc-native firmware/hardware notes (`HARDWARE.md`), not EDA export cosplay.
