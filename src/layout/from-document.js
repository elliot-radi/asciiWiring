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

  // Rigid hinge alone collapses face-normal approaches (RELAY −y / ADS +x) and
  // parks H on N walls (ZMCT OUT). Restore min outward run, then tidy orphan
  // tips left by sliding teeY corridors past a re-centered face pin.
  ensureOutwardClearances(page, wireTopology, 2);
  for (const w of page.wires || []) {
    explodeNonOrtho(w);
  }
  pruneWireGeometry(page);

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

function outwardOf(side) {
  switch (side) {
    case 'N':
      return { ox: 0, oy: -1 };
    case 'S':
      return { ox: 0, oy: 1 };
    case 'E':
      return { ox: 1, oy: 0 };
    case 'W':
      return { ox: -1, oy: 0 };
    default:
      return null;
  }
}

function netSegments(wires) {
  const out = [];
  for (const w of wires) for (const s of w.segments) out.push(s);
  return out;
}

/**
 * After rigid hinges, keep ≥ minClear cells of face-normal exit on non-leaf
 * ports. Slide collinear approaches; wall-line arrivals get a new stub + wall
 * channel lift. Operates across all wire records sharing a netId.
 */
function ensureOutwardClearances(page, wireTopologyFn, minClear) {
  for (const pg of page.ports || []) {
    const dir = outwardOf(pg.side);
    if (!dir) continue;
    const { ox, oy } = dir;
    const px = pg.x;
    const py = pg.y;
    const elbow = { x: px + ox * minClear, y: py + oy * minClear };
    const topo = wireTopologyFn();

    const incidents = [];
    for (const w of page.wires || []) {
      for (const s of w.segments) {
        let which = null;
        if (s.x1 === px && s.y1 === py) which = 'a';
        else if (s.x2 === px && s.y2 === py) which = 'b';
        if (!which) continue;
        const fx = which === 'a' ? s.x2 : s.x1;
        const fy = which === 'a' ? s.y2 : s.y1;
        const freeKey = pt(fx, fy);
        const freeIsPort = topo.portCells.has(freeKey);
        const freeDeg = topo.degree.get(freeKey) || 0;
        if (!freeIsPort && freeDeg <= 1) continue; // leaf stub
        incidents.push({ w, s, which, fx, fy });
      }
    }
    if (incidents.length === 0) continue;

    let good = false;
    for (const hit of incidents) {
      const dx = hit.fx - px;
      const dy = hit.fy - py;
      const dist = dx * ox + dy * oy;
      const lat = dx * -oy + dy * ox;
      if (lat === 0 && dist >= minClear) good = true;
    }
    if (good) continue;

    let approach = null;
    for (const hit of incidents) {
      const dx = hit.fx - px;
      const dy = hit.fy - py;
      const dist = dx * ox + dy * oy;
      const lat = dx * -oy + dy * ox;
      if (lat === 0 && dist > 0) {
        approach = hit;
        break;
      }
    }

    const netWires = (page.wires || []).filter(
      (w) => w.netId === incidents[0].w.netId
    );

    if (approach) {
      const oldJ = { x: approach.fx, y: approach.fy };
      slideElbow(netWires, oldJ, elbow, px, py);
      if (approach.which === 'a') {
        approach.s.x2 = elbow.x;
        approach.s.y2 = elbow.y;
      } else {
        approach.s.x1 = elbow.x;
        approach.s.y1 = elbow.y;
      }
      continue;
    }

    const hostWire = incidents[0].w;
    for (const hit of incidents) {
      if (hit.which === 'a') {
        hit.s.x1 = elbow.x;
        hit.s.y1 = elbow.y;
      } else {
        hit.s.x2 = elbow.x;
        hit.s.y2 = elbow.y;
      }
    }
    slideWallChannel(netWires, px, py, ox, oy, elbow, topo);
    hostWire.segments.push({ x1: px, y1: py, x2: elbow.x, y2: elbow.y });
  }
}

function slideElbow(netWires, oldJ, elbow, px, py) {
  if (oldJ.x === elbow.x && oldJ.y === elbow.y) return;
  const ddx = elbow.x - oldJ.x;
  const ddy = elbow.y - oldJ.y;
  const segs = netSegments(netWires);

  const ride = new Set([pt(oldJ.x, oldJ.y)]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of segs) {
      const ends = [
        [s.x1, s.y1],
        [s.x2, s.y2],
      ];
      for (let e = 0; e < 2; e++) {
        const [x, y] = ends[e];
        const [xo, yo] = ends[1 - e];
        if (!ride.has(pt(x, y))) continue;
        const along =
          ddy !== 0
            ? y === oldJ.y && yo === oldJ.y
            : x === oldJ.x && xo === oldJ.x;
        if (along && !ride.has(pt(xo, yo))) {
          if (xo === px && yo === py) continue;
          ride.add(pt(xo, yo));
          grew = true;
        }
      }
    }
  }

  for (const s of segs) {
    for (const [x, y, ox_, oy_] of [
      [s.x1, s.y1, s.x2, s.y2],
      [s.x2, s.y2, s.x1, s.y1],
    ]) {
      if (x === px && y === py) continue;
      if (ddy !== 0 && y === oldJ.y && oy_ !== oldJ.y) ride.add(pt(x, y));
      if (ddx !== 0 && x === oldJ.x && ox_ !== oldJ.x) ride.add(pt(x, y));
    }
  }

  for (const s of segs) {
    if (!(s.x1 === px && s.y1 === py) && ride.has(pt(s.x1, s.y1))) {
      s.x1 += ddx;
      s.y1 += ddy;
    }
    if (!(s.x2 === px && s.y2 === py) && ride.has(pt(s.x2, s.y2))) {
      s.x2 += ddx;
      s.y2 += ddy;
    }
  }
}

function slideWallChannel(netWires, px, py, ox, oy, elbow, topo) {
  const slideY = oy !== 0;
  for (const s of netSegments(netWires)) {
    for (const end of ['a', 'b']) {
      const x = end === 'a' ? s.x1 : s.x2;
      const y = end === 'a' ? s.y1 : s.y2;
      if (x === px && y === py) continue;
      if (topo.portCells.has(pt(x, y))) continue;
      const onWall = slideY ? y === py : x === px;
      if (!onWall) continue;
      if (slideY) {
        if (end === 'a') s.y1 = elbow.y;
        else s.y2 = elbow.y;
      } else if (end === 'a') s.x1 = elbow.x;
      else s.x2 = elbow.x;
    }
  }
}

/**
 * Per-net cleanup after clearance slides:
 *  1. split every segment at every other endpoint that lies on its interior
 *     (so T-junctions.share vertices instead of “crossing mid-span”)
 *  2. merge collinear runs through pure degree-2 joints
 *  3. drop orphan arms: free tip deg1 whose other end is a junction (deg≥2);
 *     leave leaf stubs (port ↔ free tip, both deg1)
 */
function pruneWireGeometry(page) {
  const byNet = new Map();
  for (const w of page.wires || []) {
    if (!byNet.has(w.netId)) byNet.set(w.netId, []);
    byNet.get(w.netId).push(w);
  }
  const portCells = new Set((page.ports || []).map((g) => pt(g.x, g.y)));

  for (const wires of byNet.values()) {
    let segs = netSegments(wires).map((s) => ({ ...s }));
    segs = splitAtInteriorJoints(segs);
    segs = dedupeSegments(segs);
    segs = mergeCollinearDeg2(segs);
    segs = segs.filter((s) => !(s.x1 === s.x2 && s.y1 === s.y2));
    segs = dropOrphanArms(segs, portCells);
    wires[0].segments = segs;
    for (let i = 1; i < wires.length; i++) wires[i].segments = [];
  }
  page.wires = (page.wires || []).filter((w) => w.segments.length > 0);
}

function splitAtInteriorJoints(segs) {
  // Collect candidate split points: every endpoint of every segment.
  const joints = [];
  const seen = new Set();
  for (const s of segs) {
    for (const p of [
      [s.x1, s.y1],
      [s.x2, s.y2],
    ]) {
      const k = pt(p[0], p[1]);
      if (!seen.has(k)) {
        seen.add(k);
        joints.push({ x: p[0], y: p[1] });
      }
    }
  }
  const out = [];
  for (const s of segs) {
    out.push(...splitSegByPoints(s, joints));
  }
  return out;
}

function splitSegByPoints(s, joints) {
  if (s.x1 === s.x2 && s.y1 === s.y2) return [];
  const horiz = s.y1 === s.y2;
  const vert = s.x1 === s.x2;
  if (!horiz && !vert) return [{ ...s }];

  const marks = [];
  if (horiz) {
    const y = s.y1;
    const lo = Math.min(s.x1, s.x2);
    const hi = Math.max(s.x1, s.x2);
    for (const j of joints) {
      if (j.y === y && j.x > lo && j.x < hi) marks.push(j.x);
    }
    marks.sort((a, b) => a - b);
    const xs = [s.x1 < s.x2 ? lo : hi, ...marks, s.x1 < s.x2 ? hi : lo];
    // Keep order from x1 toward x2
    if (s.x1 > s.x2) {
      // marks ascending; rebuild left-to-right then reverse chaining
      const ordered = [lo, ...marks, hi];
      const pieces = [];
      for (let i = ordered.length - 1; i > 0; i--) {
        if (ordered[i] !== ordered[i - 1])
          pieces.push({ x1: ordered[i], y1: y, x2: ordered[i - 1], y2: y });
      }
      return pieces;
    }
    const ordered = [lo, ...marks, hi];
    const pieces = [];
    for (let i = 0; i < ordered.length - 1; i++) {
      if (ordered[i] !== ordered[i + 1])
        pieces.push({ x1: ordered[i], y1: y, x2: ordered[i + 1], y2: y });
    }
    return pieces;
  }

  // vertical
  const vx = s.x1;
  const vlo = Math.min(s.y1, s.y2);
  const vhi = Math.max(s.y1, s.y2);
  const yMarks = [];
  for (const j of joints) {
    if (j.x === vx && j.y > vlo && j.y < vhi) yMarks.push(j.y);
  }
  yMarks.sort((a, b) => a - b);
  const yOrdered = [vlo, ...yMarks, vhi];
  if (s.y1 > s.y2) {
    const pieces = [];
    for (let i = yOrdered.length - 1; i > 0; i--) {
      if (yOrdered[i] !== yOrdered[i - 1])
        pieces.push({ x1: vx, y1: yOrdered[i], x2: vx, y2: yOrdered[i - 1] });
    }
    return pieces;
  }
  const vPieces = [];
  for (let i = 0; i < yOrdered.length - 1; i++) {
    if (yOrdered[i] !== yOrdered[i + 1])
      vPieces.push({ x1: vx, y1: yOrdered[i], x2: vx, y2: yOrdered[i + 1] });
  }
  return vPieces;
}

function endpointDegree(segs) {
  const deg = new Map();
  const bump = (x, y) => {
    const k = pt(x, y);
    deg.set(k, (deg.get(k) || 0) + 1);
  };
  for (const s of segs) {
    bump(s.x1, s.y1);
    bump(s.x2, s.y2);
  }
  return deg;
}

/** Direction-insensitive unique key for an axis-aligned segment. */
function segKey(s) {
  const a = pt(s.x1, s.y1);
  const b = pt(s.x2, s.y2);
  return a < b ? a + '|' + b : b + '|' + a;
}

function dedupeSegments(segs) {
  const seen = new Set();
  const out = [];
  for (const s of segs) {
    if (s.x1 === s.x2 && s.y1 === s.y2) continue;
    const k = segKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function mergeCollinearDeg2(segs) {
  const out = segs.map((s) => ({ ...s }));
  let changed = true;
  while (changed) {
    changed = false;
    const deg = endpointDegree(out);
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const sh = sharedEndpoint(out[i], out[j]);
        if (!sh) continue;
        if ((deg.get(pt(sh.x, sh.y)) || 0) !== 2) continue;
        const m = tryMergeCollinear(out[i], out[j]);
        if (!m) continue;
        out[i] = m;
        out.splice(j, 1);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return out;
}

function sharedEndpoint(a, b) {
  for (const p of [
    { x: a.x1, y: a.y1 },
    { x: a.x2, y: a.y2 },
  ]) {
    for (const q of [
      { x: b.x1, y: b.y1 },
      { x: b.x2, y: b.y2 },
    ]) {
      if (p.x === q.x && p.y === q.y) return p;
    }
  }
  return null;
}

function tryMergeCollinear(a, b) {
  const aH = a.y1 === a.y2;
  const aV = a.x1 === a.x2;
  const bH = b.y1 === b.y2;
  const bV = b.x1 === b.x2;
  if (aH && bH && a.y1 === b.y1) {
    const xs = [a.x1, a.x2, b.x1, b.x2];
    return { x1: Math.min(...xs), y1: a.y1, x2: Math.max(...xs), y2: a.y1 };
  }
  if (aV && bV && a.x1 === b.x1) {
    const ys = [a.y1, a.y2, b.y1, b.y2];
    return { x1: a.x1, y1: Math.min(...ys), x2: a.x1, y2: Math.max(...ys) };
  }
  return null;
}

function dropOrphanArms(segs, portCells) {
  const out = segs.map((s) => ({ ...s }));
  let changed = true;
  while (changed) {
    changed = false;
    const deg = endpointDegree(out);
    for (let i = out.length - 1; i >= 0; i--) {
      const s = out[i];
      const ends = [
        { x: s.x1, y: s.y1 },
        { x: s.x2, y: s.y2 },
      ];
      for (let e = 0; e < 2; e++) {
        const tip = ends[e];
        const oth = ends[1 - e];
        if (portCells.has(pt(tip.x, tip.y))) continue;
        if ((deg.get(pt(tip.x, tip.y)) || 0) !== 1) continue;
        if ((deg.get(pt(oth.x, oth.y)) || 0) < 2) continue;
        // orphan spur into a T/elbow → drop
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return out;
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
