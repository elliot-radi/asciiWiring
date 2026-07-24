/**
 * Layout policy: from-document
 *
 * Course correction: do NOT reimplement place+route. Spine-v1 already produces
 * fixture-quality channels, stems, stubs, and floating leaves. The layout YAML
 * owns geometry overrides (box origin x/y). Face banks are validated by the
 * loader (pin census). When dossier x/y match spine placement, the transform
 * is identity and ASCII matches the default CLI.
 *
 * Pipeline:
 *   1. layoutSpineV1(netlist) — full place+route quality
 *   2. Rigid-move boxes whose dossier x/y differ:
 *        - ports owned by that component
 *        - wire ends on those port cells
 *        - **true leaf stubs** (port → free tip, tip not another port and not
 *          a multi-wire junction): both ends ride with the box (GND S-drop,
 *          short E stubs). Direction alone is not enough — W-face bus rails
 *          also point "outward" toward the facing bus.
 *        - shared rails / stem elbows: hinge only the port vertex
 *        - after hinges, explode any non-ortho segment into an L
 *        - labels interiors + exterior leaf net labels
 *
 * Large corridor edits still need a real re-route pass (ARCHITECTURE §3.4.2).
 *
 * See docs/LAYOUT.md and ARCHITECTURE.md.
 */

const { layoutSpineV1 } = require('./spine-v1');

function pt(x, y) {
  return x + ',' + y;
}

function layoutFromDocument(netlist, layoutDoc) {
  const plan = layoutSpineV1(netlist);
  return applyLayoutDocument(plan, netlist, layoutDoc);
}

function applyLayoutDocument(plan, netlist, layoutDoc) {
  const page = plan.pages[0];
  if (!page) return plan;

  const nameToComp = new Map(netlist.components.map((c) => [c.name, c]));
  const portOwner = new Map(netlist.ports.map((p) => [p.id, p.componentId]));

  // Port cells and wire-endpoint degree used to tell leaf stubs from rails/elbows.
  // Built fresh after each component move (geometry changes).
  function wireTopology() {
    const portCells = new Set((page.ports || []).map((g) => pt(g.x, g.y)));
    const degree = new Map();
    const bump = (x, y) => {
      const k = pt(x, y);
      degree.set(k, (degree.get(k) || 0) + 1);
    };
    for (const w of page.wires || []) {
      for (const s of w.segments) {
        bump(s.x1, s.y1);
        bump(s.x2, s.y2);
      }
    }
    return { portCells, degree };
  }

  for (const [name, dossier] of Object.entries(layoutDoc)) {
    const comp = nameToComp.get(name);
    if (!comp) continue;
    const box = page.boxes.find((b) => b.componentId === comp.id);
    if (!box) continue;

    const dx = dossier.x - box.x;
    const dy = dossier.y - box.y;
    if (dx === 0 && dy === 0) continue;

    const oldX = box.x;
    const oldY = box.y;
    const oldW = box.w;
    const oldH = box.h;

    const topo = wireTopology();

    // Old port cell → new geometry + face
    const endMap = new Map();
    for (const pg of page.ports) {
      if (portOwner.get(pg.portId) !== comp.id) continue;
      const ox = pg.x;
      const oy = pg.y;
      const side = pg.side;
      pg.x += dx;
      pg.y += dy;
      endMap.set(pt(ox, oy), { x: pg.x, y: pg.y, side, ox, oy });
    }

    for (const w of page.wires) {
      for (const s of w.segments) {
        retargetSegment(s, endMap, dx, dy, topo);
      }
    }

    // Labels inside the old box chrome (stem pin text, title row notes).
    for (const lab of page.labels) {
      if (
        lab.x >= oldX &&
        lab.x < oldX + oldW &&
        lab.y >= oldY &&
        lab.y < oldY + oldH
      ) {
        lab.x += dx;
        lab.y += dy;
      }
    }

    for (const meta of endMap.values()) {
      translateLeafLabels(page.labels, meta, dx, dy);
    }

    box.x = dossier.x;
    box.y = dossier.y;
  }

  // Repair any non-axis-aligned hinges (e.g. N-face port slid sideways off stem).
  for (const w of page.wires || []) {
    explodeNonOrtho(w);
  }

  recomputePageBounds(page);
  page.meta = Object.assign({}, page.meta || {}, { policy: 'from-document' });
  return plan;
}

/**
 * @param {*} s segment (mutated)
 * @param {Map} endMap old port cell → new
 * @param {number} dx
 * @param {number} dy
 * @param {{portCells:Set, degree:Map}} topo pre-move topology
 */
function retargetSegment(s, endMap, dx, dy, topo) {
  const aKey = pt(s.x1, s.y1);
  const bKey = pt(s.x2, s.y2);
  const a = endMap.get(aKey);
  const b = endMap.get(bKey);

  if (a && b) {
    s.x1 = a.x;
    s.y1 = a.y;
    s.x2 = b.x;
    s.y2 = b.y;
    return;
  }

  if (a && !b) {
    applyPortEnd(s, 'a', a, dx, dy, topo);
    return;
  }
  if (b && !a) {
    applyPortEnd(s, 'b', b, dx, dy, topo);
  }
}

function applyPortEnd(s, which, meta, dx, dy, topo) {
  const freeX = which === 'a' ? s.x2 : s.x1;
  const freeY = which === 'a' ? s.y2 : s.y1;
  const freeKey = pt(freeX, freeY);

  // True leaf stub: free tip is not any port and not a multi-segment junction.
  // Degree is counted on pre-move geometry for this page state.
  const freeIsPort = topo.portCells.has(freeKey);
  const freeDeg = topo.degree.get(freeKey) || 0;
  const isLeafStub = !freeIsPort && freeDeg <= 1;

  if (isLeafStub) {
    s.x1 += dx;
    s.y1 += dy;
    s.x2 += dx;
    s.y2 += dy;
    return;
  }

  // Shared rail or stem elbow: hinge only the port vertex.
  if (which === 'a') {
    s.x1 = meta.x;
    s.y1 = meta.y;
  } else {
    s.x2 = meta.x;
    s.y2 = meta.y;
  }
}

/** Turn a diagonal hinge into H-then-V L via elbow at (x2, y1). */
function explodeNonOrtho(wire) {
  const out = [];
  for (const s of wire.segments) {
    if (s.x1 === s.x2 || s.y1 === s.y2) {
      out.push(s);
      continue;
    }
    // Prefer arriving on a vertical into the second endpoint (common for
    // N-face module ports hanging off a stem column).
    out.push({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y1 });
    out.push({ x1: s.x2, y1: s.y1, x2: s.x2, y2: s.y2 });
  }
  wire.segments = out;
}

/**
 * Move net labels that were anchored near a port's old leaf tip.
 * Spine places lab.x so mid ≈ stub tip for E (text just past tip).
 */
function translateLeafLabels(labels, meta, dx, dy) {
  const { ox, oy, side } = meta;
  for (const lab of labels) {
    if (lab.kind !== 'net') continue;
    let hit = false;
    if (side === 'S') {
      if (lab.y <= oy || lab.y > oy + 4) continue;
      const mid = lab.x + Math.floor(String(lab.text).length / 2);
      if (Math.abs(mid - ox) <= Math.max(String(lab.text).length, 2)) hit = true;
    } else if (side === 'E') {
      if (lab.y !== oy) continue;
      if (lab.x < ox || lab.x > ox + 12) continue;
      hit = true;
    } else if (side === 'W') {
      // Only true west leaf stubs (rare); bus rails have no tip label.
      if (lab.y !== oy) continue;
      const right = lab.x + String(lab.text).length;
      if (right > ox || lab.x < ox - 12) continue;
      hit = true;
    } else if (side === 'N') {
      if (lab.y >= oy || lab.y < oy - 4) continue;
      const mid = lab.x + Math.floor(String(lab.text).length / 2);
      if (Math.abs(mid - ox) <= Math.max(String(lab.text).length, 2)) hit = true;
    }
    if (hit) {
      lab.x += dx;
      lab.y += dy;
    }
  }
}

function recomputePageBounds(page) {
  let width = 0;
  let height = 0;
  const bump = (xx, yy) => {
    width = Math.max(width, xx + 1);
    height = Math.max(height, yy + 1);
  };
  for (const b of page.boxes) bump(b.x + b.w, b.y + b.h);
  for (const p of page.ports) bump(p.x, p.y);
  for (const w of page.wires) {
    for (const s of w.segments) bump(Math.max(s.x1, s.x2), Math.max(s.y1, s.y2));
  }
  for (const l of page.labels) bump(l.x + Math.max(l.text.length, 1), l.y);
  page.width = width + 2;
  page.height = height + 1;
}

module.exports = { layoutFromDocument, applyLayoutDocument };
