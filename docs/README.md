# Documentation topology

This file is the **enforcement mechanism** for the `docs/` directory.
Every document below must be registered here. If a file is not in the
registry, it does not belong in `docs/`.

## Philosophy

Documentation rots when the same information lives in multiple files.
The fix is not "try not to duplicate things." It is an explicit
mechanical rule: **each layer owns one kind of content, and cross-layer
duplication is forbidden.**

There are four layers. A document belongs to exactly one layer.

| Layer | Content | Change trigger |
|-------|---------|----------------|
| **Dashboard** | Current state, priorities, what works / what doesn't | Priorities shift, fixtures land, capabilities change |
| **Contracts** | Normative design — what the system *is* | The code changes |
| **Norms** | How humans and agents behave | Workflow or rules change |
| **History (RFCs)** | Why a path was chosen; append-only design dialogues | A reversible decision is made or superseded |

Rules that apply to all layers:

- **Dashboard files never contain normative specs or historical narratives.**
- **Contract files never contain "we plan to" — only "the system does" or an
  explicit `Gap:` label.**
- **Norm files never contain state that can go stale.**
- **RFCs are append-only.** When a decision is superseded, write a new RFC;
  do not edit the old one.
- **Cross-reference only.** If Layer A needs content from Layer B, link to it.
  Do not copy.

## File registry

| File | Layer | Role | Update when… | Do NOT add… |
|------|-------|------|--------------|-------------|
| `STATUS.md` | Dashboard | Current priorities, fixture status, snapshot date, backlog | Priorities shift, fixtures land or go stale | Normative specs, historical narratives, option analysis |
| `SPEC.md` | Contract | Table language syntax, electrical semantics, paint rules | Parser, syntax, or paint rules change | Roadmap items, implementation notes, examples beyond specification |
| `ARCHITECTURE.md` | Contract | Pipeline stages, IR shapes, module seams | New pipeline stage or IR change | Priority lists, CLI tutorials, design rationale |
| `LAYOUT.md` | Contract | Layout sidecar schema, valid keys, error modes, loader checklist | Schema changes, new loaders, new validations | HITL philosophy, GUI speculation, unscoped future keys |
| `GLYPHS.md` | Contract | Drawing conventions, box rules, passive rendering; `Gap:` labels for unimplemented features | Paint or glyph logic changes | Unimplemented features without a `Gap:` label |
| `AGENTS.md` (root) | Norms | Contributor rules, test commands, drift policy | Workflow or testing rules change | Current priorities, architecture details, any state that goes stale |
| `rfc/000-electrical-model-and-pipeline.md` | History | Founding decisions: nets as hyperedges, derived roles, tee-vs-series passives, pipeline shape, no-Dagre heuristic | Never — append-only | Current status, how-to-build instructions |
| `rfc/001-layout-sidecar-and-hitl.md` | History | Layout sidecar decision: options A–E, from-document path, hybrid overlay rejected, browser target scoped | Major layout reversals or new HITL decisions | Current status, normative schema (lives in `LAYOUT.md`) |
| `rfc/002-table01-rendering.md` | History | Table01 algorithmic rationale: classification evidence, channel order, placement rules, implementation order | Never — append-only | Normative syntax or paint rules (lives in `SPEC.md`, `GLYPHS.md`) |
| `README.md` (this file) | Meta | Topology manifest, decision tree, enforcement rule | New doc created or deleted, layer boundary changes | Anything else |

## Decision tree

Use this when adding or editing documentation.

| Intent | Target |
|--------|--------|
| Document a new YAML property for the layout sidecar | `LAYOUT.md` |
| Record that a feature is deferred (e.g. feedthrough TBs) | `STATUS.md` backlog |
| Explain why the system behaves a certain way | `rfc/NNN-*.md` (new or existing) |
| Argue for or against a design direction | New `rfc/NNN-*.md` |
| Add a rule about running tests before commits | `AGENTS.md` |
| Update which fixtures exist and their status | `STATUS.md` |
| Change the table language syntax | `SPEC.md` |
| Change how boxes or passives are drawn | `GLYPHS.md` |
| Add a new pipeline stage or IR shape | `ARCHITECTURE.md` |
| Explain why an old decision was wrong | New `rfc/NNN-*.md` referencing the old |

## Enforcement rule

> **No new file or subdirectory may be created under `docs/` without an entry
> in the registry above.**
>
> **No document may duplicate content owned by another layer. Cross-reference
> only.**
>
> **If a contract file (`SPEC`, `ARCHITECTURE`, `LAYOUT`, `GLYPHS`) contains
> an unimplemented feature, it must be marked with a `Gap:` label, not
> described as a future plan elsewhere.**

## Cross-cutting notes

### Snapshot date

`STATUS.md` carries a prominent snapshot date at the top. If the date is more
than two months old, distrust the file.

### `Gap:` labels in contracts

A contract may contain known gaps. The required form is:

```markdown
**Gap:** Layout-only grouping is not yet implemented. When it is, the
`group:` tag will be recognised in the layout stage. See GLYPHS.md §Grouping
for the design convention.
```

This keeps the contract complete as a description of the *current* system,
while explicitly flagging what is not yet real.

### RFC numbering

RFCs are numbered sequentially as they are authored. Early numbers may be
retroactive (e.g. `000`, `001`, `002`). A later RFC may supersede an earlier
one by referencing it explicitly, but must not edit it.

---

## For future projects

This topology is reusable. Copy this file into a new repo and adjust the
registry table. The rule generalises: **separate current state, normative
design, behavioral rules, and historical rationale into distinct layers, and
never let them bleed into each other.**
