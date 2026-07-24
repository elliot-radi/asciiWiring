# AGENTS.md — working in asciiWiring

Short rules for humans and coding agents.  
**Not** the design bible — that lives under `docs/`. For the full document
topology (where to put what), see [`docs/README.md`](docs/README.md).

## What this is

- **Tool** (`src/`): Markdown wiring **table** → netlist → place/route/paint → **ASCII**.
- **Skill** (`skill/SKILL.md`): optional LLM workflow to draft tables and run the CLI. Thin client only.
- **Electrical SoT:** the connectivity table (no coordinates in the matrix).
- **Geometry direction:** auto `spine-v1` is a **bootstrap only**. HITL path:
  layout sidecar (`examples/layout02.yaml`) via CLI `--layout` (spine-first
  `from-document`: place/route then rigid x/y). See ARCHITECTURE §3.4.2 and
  [rfc/001](docs/rfc/001-layout-sidecar-and-hitl.md).

Do **not** freehand multi-box ASCII in the LLM. Do **not** treat perfect
auto-layout as the bar. Do **not** re-thread layout overrides into
`spine-v1.js` (hybrid overlay — tried and reverted).

## Work here, not in global skills

- Edit **`~/projects/asciiWiring` only**.
- Do **not** install into `~/.pi/agent/skills/` until the tool loop is ready.
- Remote: `https://github.com/elliot-radi/asciiWiring`

## Commands

```bash
node src/render.js examples/table01.md
node src/render.js examples/table02.md
node src/render.js --layout examples/layout02.yaml examples/table02.md
node src/render.js --debug examples/table02.md   # art stdout; IR summary stderr
npm test                                         # src/selftest.js
```

After layout/paint/parse changes: **always** `npm test`. Prefer small edits
over whole-file rewrites of `layout/`.

## Agent do / don’t

**Do**

- Keep table electrical; put geometry in layout seams, never new pin-cell magic for cosmetics.
- Pick the right layer: content (table) vs presentation (glyphs/paint) vs place policy vs route.
- Implement layout in **increments** with IR/acceptance checks; prefer a separate `from-document` path over overlaying `spine-v1`.
- Add/adjust `examples/tableNN` + art/golden when bootstrap behavior changes; keep `layout02` aligned with spine for identity tests.
- Discuss or write a short note before ambiguous geometry/language changes.
- For multi-net `x` passives: two nets + body, **not** series-on-stem.
- Joins = same net (`├┤┬┴`, rare `┼`). Different nets crossing = hop `\` only.

**Don’t**

- Claim skill production-ready or install global skill early.
- Pull Dagre/ELK/force-directed as a substitute for domain place+route.
- Encode feedthrough TBs / exterior labels without SPEC + backlog decisions.
- Blow the ontology into general CAD or Mermaid-flowchart clones.
- Large `spine-v1.js` rewrites without syntax check + tests (past footgun).
- Reintroduce hybrid “layoutDoc overrides inside spine-v1” without an explicit decision to abandon from-document.
- Create new `docs/` files without updating `docs/README.md`.

## Drift rule

This file contains **no state that can go stale.** It does not list current
priorities, pipeline details, or document cross-references. If you need the
plan, read [`docs/STATUS.md`](docs/STATUS.md). If you need the system design,
read the contracts under `docs/`. If this file disagrees with a contract, fix
this file — don’t re-encode full specs here.

## CodeGraph — codebase navigation

This project is indexed with CodeGraph. To keep context windows small,
**do not** read or grep across `src/` to trace call trees by hand. Use the
MCP proxy:

- Discover tools: `mcp({ search: "codegraph" })`
- Explore an area: `mcp({ tool: "codegraph_explore", args: '{"query":"<topic>"}' })`
- Inspect a symbol: `mcp({ tool: "codegraph_node", args: '{"name":"<symbol>"}' })`

Guidelines:
- Use `codegraph_explore` before touching unfamiliar parts of `src/`
  (e.g. layout, paint, parse).
- Use `codegraph_node` before editing a function to review callers/callees
  and avoid breaking invariants.
- Fall back to `read` only after CodeGraph has narrowed the target to a
  specific file + symbol.

## Tone

Doc-native firmware/hardware notes (`HARDWARE.md`), not EDA export cosplay.
