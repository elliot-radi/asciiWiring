# RFC 003: Documentation topology and RFC process

**Date:** 2026-07
**Status:** Accepted

## Context

This repository accumulated documentation in an ad hoc way across many
sessions with different agents. Each document made sense at the time, but
they cross-referenced each other heavily. Any design change required
hunting through multiple files to remove stale material and update to
the latest viewpoint. The AGENTS.md file already contained a "drift rule"
acknowledging that SPEC / ARCHITECTURE / STATUS win over it — evidence
that the docs were aware of their own incoherence.

## Problem

Specific symptoms:

1. **State duplication:** The same priority sequence (freeze layout
   schema → from-document path → glyph growth → language growth → skill
   packaging) appeared in `STATUS.md` ("north star"), `AGENTS.md`
   ("current priority"), and `ROADMAP.md` (Phase 3).
2. **Layer confusion:** `AGENTS.md` held contributor norms, pipeline
   summaries, current priorities, and a doc cross-reference hub — four
   roles in one file.
3. **Stale content:** `TODO.md` contained "graduated" items that had
   been moved elsewhere, a fixture ladder, a layout checklist, and
   "newly deferred" ideas — none of which had a single owner.
4. **Historical rationale loss:** `HITL.md` contained a valuable
   decision log and options analysis, but its name suggested it was a
   living guide rather than a record of a reversible decision.

## Options evaluated

### A. Status quo (keep 9 docs + drift)

Continue with `STATUS`, `AGENTS`, `ROADMAP`, `TODO`, `HITL`, `LAYOUT`,
`GLYPHS`, `SPEC`, `ARCHITECTURE`, plus `table01-walkthrough`. Accept
that every priority shift requires a four-file edit and that drift rules
are needed to resolve conflicts.

- *Con:* Update tax is real and growing. Drift rules are a symptom, not a
  cure.

### B. Merge everything into a single large document

One `DESIGN.md` containing all contracts, priorities, and history.

- *Con:* A single file cannot be both living dashboard (changes often)
  and append-only history (never changes). The tension would re-emerge
  as sections within the file.

### C. Merge contracts into README, keep history separate

Put normative specs in the root README and move historical decisions to
a `HISTORY.md`.

- *Con:* README is public entry — it should pitch and quickstart, not
  carry normative pipeline details. History as a single file is
  edit-in-place; old decisions get overwritten.

### D. Fewer documents without explicit topology

Delete `TODO.md` and `ROADMAP.md`, absorb content into remaining files,
but without a formal map of what belongs where.

- *Con:* The same layer confusion recurs. Without explicit boundaries,
  future agents and humans will re-introduce duplication.

### E. Explicit four-layer topology with enforcement (chosen)

Separate current state, normative design, behavioral rules, and
historical rationale into distinct layers. Enforce with a topology
manifest (`docs/README.md`) that registers every file, states its role,
and forbids cross-layer duplication.

- *Pro:* Mechanical rule prevents drift. Each file changes for one reason.
- *Con:* Requires a small upfront investment in the manifest and
  retroactive RFCs. New files must be registered.

## Decision

Adopt a **four-layer topology** with explicit enforcement:

| Layer | Content | Examples |
|-------|---------|----------|
| **Dashboard** | Current state only | `STATUS.md` |
| **Contracts** | Normative design — what the system *is* | `SPEC.md`, `ARCHITECTURE.md`, `LAYOUT.md`, `GLYPHS.md` |
| **Norms** | How contributors behave | `AGENTS.md` |
| **History (RFCs)** | Why a path was chosen; append-only | `rfc/000-*.md`, `001-*.md`, `002-*.md` |

Rules:

1. **Dashboard files never contain normative specs or historical narratives.**
2. **Contract files never contain "we plan to."** Use "the system does" or
   an explicit `Gap:` label.
3. **Norm files never contain state that can go stale.**
4. **RFCs are append-only.** When superseded, write a new RFC that
   references the old. Never edit the old.
5. **No cross-layer duplication.** Cross-reference only.

Enforcement: `docs/README.md` is the topology manifest. It contains a
file registry, a decision tree for "where do I put this?", and an
enforcement rule: **no new `docs/` file without a registry entry.**

### Retroactive RFCs

Founding decisions deserve to be recorded even though they predate the
process. Three retroactive RFCs were authored:

- `rfc/000` — electrical model and pipeline architecture
- `rfc/001` — layout sidecar and human-in-the-loop
- `rfc/002` — table01 rendering rationale

The criterion for a retroactive RFC is: **was there a design option to
choose from, with tradeoffs?** Implementation order alone is not
RFC-worthy.

### The `Gap:` convention

Contract files may contain known gaps. The required form:

```markdown
**Gap:** Layout-only grouping is not yet implemented. When it is, the
`group:` tag will be recognised in the layout stage. See GLYPHS.md
§Grouping for the design convention.
```

This keeps the contract complete as a description of the *current* system
while explicitly flagging what is not yet real.

## Consequences

**New files:**
- `docs/README.md` — topology manifest
- `rfc/000-electrical-model-and-pipeline.md`
- `rfc/001-layout-sidecar-and-hitl.md`
- `rfc/002-table01-rendering.md`
- `rfc/003-docs-topology-and-rfc-process.md` (this file)

**Deleted files (content migrated):**
- `docs/HITL.md` → split: rationale to `rfc/001`; normative schema already in `LAYOUT.md`
- `docs/TODO.md` → split: fixture ladder/budget to `STATUS.md`; checklist to `LAYOUT.md`; deferred items to `GLYPHS.md` as `Gap:` labels
- `docs/ROADMAP.md` → split: early phases/decision log to `rfc/000`; Phase 3+ to `STATUS.md`
- `docs/table01-walkthrough.md` → split: normative examples to `SPEC.md`/`GLYPHS.md`; algorithmic narrative to `rfc/002`

**Rewritten files:**
- `AGENTS.md` — stripped to behavioral norms only; no state, no pipeline
  description, no priority lists
- Root `README.md` — reduced to pitch, quickstart, and pointer to `docs/`

## Related

- docs/README.md — the topology manifest (enforcement)
- docs/STATUS.md — current state
- docs/AGENTS.md — contributor norms
