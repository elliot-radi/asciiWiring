# RFC 000: Electrical model and pipeline architecture

**Date:** 2026-04 (retroactive)
**Status:** Accepted — foundational; supersedes all earlier informal design notes.

## Context

asciiWiring started as an experiment: can a Markdown wiring table become
the sole electrical source of truth (SoT) for a small module diagram,
with the computer handling draw and route? This RFC captures the founding
decisions that shaped the electrical model, the pipeline, and the
bootstrap heuristic.

## Decisions

### 1. Table as electrical SoT

The Markdown table is the one canonical description of connectivity.
No user-facing JSON workflow, no coordinate annotations in cells, no
drawing instructions smuggled into the matrix. Geometry lives outside
the table in a separate layout document (see rfc/001).

Rationale: Markdown tables are human-readable, diff-friendly, and
iterate well in firmware READMEs. Adding coordinates would make them
brittle.

### 2. Nets are hyperedges

A row in the table is a net. A net connects every component that has a
non-empty cell in that row. A net may connect two ports (simple wire)
or many (bus, branch, power rail).

- `°` prefix (e.g., `°3.3V`) marks a floating net — rendered as a free
  label, not dishonest.
- `x` marks an anonymous port on a passive — no named pin, just a
  terminal on the net.

### 3. Component roles are derived, not authored

The table contains no explicit type tags. The pipeline derives roles from
the connectivity pattern:

| Role | Pattern |
|------|---------|
| **Bus** | Named pins on multiple fixed nets (e.g., MCU with GPIO8/9/5) |
| **Branch** | One primary named signal pin; other pins may be floating leaves |
| **Passive** | `x` ports on two or more **different** nets; no named pins |

Rationale: keeping the table free of metadata reduces authoring friction.
The renderer can classify; the human only writes connectivity.

### 4. Passives are two-terminal bodies between nets, not series splices

A passive (e.g., `10kΩ`) with `x` on net A and `x` on net B is a
component whose body is the only path between those nets through this
part. It is **not** a splice inserted into one net.

Correct mental model (pullup between BUTTON and 3.3V):

```
  GPIO5 ──────┬──────── BUTTON (NO)
              │
             10kΩ
              │
             3.3V
```

Wrong mental model (series on BUTTON):

```
  GPIO5 ──┤10kΩ├── BUTTON (NO)   ← implies BUTTON net was cut
```

The passive hangs off a tee on one net with a lead to the other net.
This preserves net continuity and avoids accidental electrical
misrepresentation.

### 5. Paint distinguishes join (same net) from hop (different nets)

- Tee joins (`├ ┤ ┬ ┴`) and rare four-way joins (`┼`) are **same-net**
  connections.
- An insulated hop glyph (`\\`) is used when a vertical wire of one
  net must pass through a horizontal run of a different net.

Never use `┼` for a crossing of different nets — it looks like a short.

### 6. Pipeline: parse → model → classify → place → route → paint

The renderer is a strict transform pipeline:

1. **Parse** table + abbreviations → raw cells
2. **Model** cells → netlist IR (components, nets, ports)
3. **Classify** connectivity patterns → bus / branch / passive roles
4. **Place** → assign component positions and pin faces (bootstrap: spine-v1)
5. **Route** → ortho wire paths between port sites
6. **Paint** → final ASCII characters (box drawing, joins, hops, labels)

Rationale: each stage has a narrow, testable contract. The IR between
model and place is the seam where a layout document (rfc/001) can
inject human placement without touching the table.

### 7. Bootstrap placement is heuristic, not optimal

Phase 1 placement (`spine-v1`) is a bootstrap only. It handles simple
left-to-right bus pairs and aligned channels well. It strains on
off-spine modules, leaf stubs, and multi-rail free labels.

We explicitly rejected Dagre, ELK, and force-directed graph layout for
the bootstrap. Domain-specific electrical placement (rail awareness, pin
facing, component glyphs) does not map well onto generic graph drawing.

### 8. No general ASCII art tool, no EDA replacement

asciiWiring is not:
- A general ASCII art studio
- A replacement for KiCad, Eagle, or SPICE
- A Mermaid flowchart generator

It is a lightweight tool for module wiring diagrams in firmware READMEs
and lab notes.

## Consequences

- The netlist IR is the stable seam between electrical and geometric
  concerns.
- Roles are recomputed on every render; the table is the only persistent
  state.
- Spine-v1 quality is intentionally capped. When it fails, the answer
  is human placement (rfc/001), not a better heuristic.

## Related

- rfc/001-layout-sidecar-and-hitl.md — how human placement replaces
  bootstrap heuristics
- rfc/002-table01-rendering.md — how these rules manifest in the first
  fixture
- docs/SPEC.md — normative table language (this RFC's decisions
  codified)
- docs/ARCHITECTURE.md — pipeline module details
