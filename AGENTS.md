# AGENTS.md — working in asciiWiring

Short rules for humans and coding agents.  
**Not** the design bible — that lives under `docs/`. For the full document
topology (where to put what), see [`docs/README.md`](docs/README.md).

## What this is

- **Tool** (`src/`): Markdown wiring **table** → netlist → place/route/paint → **ASCII**.
- **Skill** (`skill/SKILL.md`): optional LLM workflow to draft tables and run the CLI. Thin client only.
- **Electrical SoT:** the connectivity table (no coordinates in the matrix).

### Stages (not “one bootstrap engine”)

| Path | Place | Route | When |
|------|-------|-------|------|
| Table only | **spine-v1** (place+route fused) | inside spine | bootstrap full art / goldens |
| `--emit-layout` | spine → YAML seed | — | packing document |
| `TABLE LAYOUT` | **from-document** (chrome) | **route-v1** | HITL full fig |
| `-m TABLE LAYOUT` | from-document | off | modules chrome only |

“Bootstrap” means **table-only spine**, not modules-only. Chrome/size fixes
must land in a **shared helper** used by spine **and** from-document (or they
will not appear on bootstrap). Do **not** morph spine wires under a layout
file. See [rfc/004](docs/rfc/004-hitl-place-loop-and-modules-only.md).

Do **not** freehand multi-box ASCII in the LLM. Do **not** treat perfect
auto-layout as the bar. Do **not** re-thread layout overrides into
`spine-v1.js` (hybrid overlay — tried and reverted).

## Work here, not in global skills

- Edit **`~/projects/asciiWiring` only**.
- Do **not** install into `~/.pi/agent/skills/` until the tool loop is ready.
- Remote: `https://github.com/elliot-radi/asciiWiring`

## Commands

Target CLI ([rfc/004](docs/rfc/004-hitl-place-loop-and-modules-only.md)); transitional
`node src/render.js` until `ascw` lands:

```bash
npm test
# bootstrap (spine) full art
node src/render.js examples/table01.md
node src/render.js examples/table02.md
# seed layout YAML from spine
node src/render.js --emit-layout examples/table02.md
# HITL: modules only / place+route
node src/render.js -m examples/table02.md examples/layout02.yaml
node src/render.js examples/table02.md examples/layout02.yaml
# target binary name (optional alias): ascw …
```

After layout/paint/parse changes: **always** `npm test`. Prefer small edits
over whole-file rewrites of `layout/`. When bootstrap behavior or chrome
rules change: update `examples/tableNN` + `artNN` and **regen goldens** once
the pyramid is coherent (see STATUS).

## Agent do / don’t

**Do**

- Keep table electrical; put geometry in layout seams, never new pin-cell magic for cosmetics.
- Pick the right layer: content (table) vs presentation (glyphs/paint) vs place policy vs route.
- Implement place/route as **stage seams** — not hinge patches on spine wires.
- Share chrome rules across spine and from-document; paint stays placer-agnostic.
- Keep fixtures a pyramid: table (`°` honest) → art intent → emit → `-m` / routed layout; goldens optional accept.
- Floating policy: rhymes with bootstrap path (bus collinear rails OK; branch floating = stub + net label, not multi-drop trees).
- Discuss or write a short note before ambiguous geometry/language changes.
- For multi-net `x` passives: two nets + body, **not** series-on-stem.
- Passive column headers: short **`TYPENUM`** (`R1`, `C2`); value/tolerance in
  footnotes only — not in the header, not as exterior floating labels.
- Joins = same net (`├┤┬┴`, rare `┼`). Different nets crossing = hop `\` only.

**Don’t**

- Assume bootstrap and `-m` share one code path (they don’t — different placers).
- Fix chrome only in from-document and call bootstrap done.
- Claim skill production-ready or install global skill early.
- Pull Dagre/ELK/force-directed as a substitute for domain place+route.
- Encode feedthrough TBs / exterior labels without SPEC + backlog decisions.
- Blow the ontology into general CAD or Mermaid-flowchart clones.
- Large `spine-v1.js` rewrites without syntax check + tests (past footgun).
- Reintroduce hybrid layout overrides inside `spine-v1` or spine+slide wire morph as HITL strategy.
- Create new `docs/` files without updating `docs/README.md`.
- Treat `examples_archive/` or gitignored snapshots as live fixtures.

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
