/**
 * Route stage v1 — interconnect from fixed port sites (rfc/004 Deliverable B).
 *
 * In:  LayoutPlan (boxes + ports already placed) + classified netlist
 * Out: mutates page.wires + exterior net labels; recomputes bounds
 *
 * Policy (MVP, not a maze):
 *   1. Short nets first (fewer named ports first).
 *   2. Direct H/V when ports align and faces look at each other.
 *   3. Else exit each face EXIT_CLEAR, elbow L between leave points (HV/VH).
 *   4. Greedy MST of pair routes until connected or no cheap edge left.
 *   5. Leftover singleton ports → stub + exterior net label.
 *   6. No box interior cross. Paint handles hop on foreign H∩V.
 *
 * Does not rewrite layout YAML or move ports.
 */

const { portsForNet, getNet } = require('../model');
const { recomputePageBounds } = require('./from-document');

const STUB_LEN = 2;
const EXIT_CLEAR = 2;

/**
 * @param {object} plan LayoutPlan from modules-from-dossier place
 * @param {object} netlist classified netlist
 * @returns {object} same plan, wires filled
 */
function routeV1(plan, netlist) {
  const page = plan.pages && plan.pages[0];
  if (!page) return plan;

  page.wires = [];
  // Keep any chrome labels from place (usually empty now); add exterior net labels.
  page.labels = (page.labels || []).filter((l) => l.kind !== 'net');

  const portById = new Map((page.ports || []).map((g) => [g.portId, g]));
  const blocked = buildBlocked(page.boxes || []);

  const nets = [...netlist.nets].sort((a, b) => {
    const na = namedSites(netlist, a.id, portById).length;
    const nb = namedSites(netlist, b.id, portById).length;
    if (na !== nb) return na - nb;
    return a.rowIndex - b.rowIndex;
  });

  for (const net of nets) {
    routeNet(page, netlist, net, portById, blocked);
  }

  page.meta = Object.assign({}, page.meta || {}, {
    policy: 'from-document',
    modulesOnly: false,
    router: 'route-v1',
  });
  recomputePageBounds(page);
  return plan;
}

function namedSites(netlist, netId, portById) {
  return portsForNet(netlist, netId)
    .filter((p) => p.kind === 'named')
    .map((p) => {
      const g = portById.get(p.id);
      if (!g) return null;
      return { port: p, g };
    })
    .filter(Boolean);
}

function routeNet(page, netlist, net, portById, blocked) {
  const sites = namedSites(netlist, net.id, portById);
  if (sites.length === 0) return;

  if (sites.length === 1) {
    emitStub(page, net, sites[0].g);
    return;
  }

  // Floating nets (°GND, °5V, °3.3V, …): same electrical net ≠ force a stem
  // tree across the page. Keep cheap collinear bus rails (ESP●─●ADS); every
  // other pin is a free stub + exterior net label (spine branch style).
  if (net.floating) {
    routeFloating(page, net, sites, blocked);
    return;
  }

  // Fixed nets: greedy MST of pair routes until connected.
  const parent = sites.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const unite = (i, j) => {
    const a = find(i);
    const b = find(j);
    if (a !== b) parent[a] = b;
  };

  const edges = [];
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      const path = routePair(sites[i].g, sites[j].g, blocked);
      if (!path) continue;
      edges.push({ i, j, cost: path.cost, segments: path.segments });
    }
  }
  edges.sort((a, b) => a.cost - b.cost || a.i - b.i || a.j - b.j);

  for (const e of edges) {
    if (find(e.i) === find(e.j)) continue;
    page.wires.push({ netId: net.id, segments: e.segments });
    unite(e.i, e.j);
  }

  // Leftover disconnected ports: leaf stub + exterior label
  for (let i = 0; i < sites.length; i++) {
    const root = find(i);
    let size = 0;
    for (let k = 0; k < sites.length; k++) if (find(k) === root) size++;
    if (size === 1) emitStub(page, net, sites[i].g);
  }
}

/** Floating: collinear facing rails only; all other sites get stubs. */
function routeFloating(page, net, sites, blocked) {
  const linked = new Set();
  const edges = [];
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      const path = tryDirect(sites[i].g, sites[j].g, blocked);
      if (!path) continue;
      edges.push({ i, j, cost: path.cost, segments: path.segments });
    }
  }
  edges.sort((a, b) => a.cost - b.cost || a.i - b.i || a.j - b.j);

  // Non-spanning: take every clear direct rail (usually one bus pair per net).
  // Ports may sit on more than one rail later; until then one link is enough.
  const parent = sites.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const unite = (i, j) => {
    const a = find(i);
    const b = find(j);
    if (a !== b) parent[a] = b;
  };
  for (const e of edges) {
    if (find(e.i) === find(e.j)) continue;
    page.wires.push({ netId: net.id, segments: e.segments });
    unite(e.i, e.j);
    linked.add(e.i);
    linked.add(e.j);
  }

  for (let i = 0; i < sites.length; i++) {
    if (!linked.has(i)) emitStub(page, net, sites[i].g);
  }
}

/**
 * @returns {{segments: object[], cost: number} | null}
 */
function routePair(ga, gb, blocked) {
  // 1. Direct collinear facing
  const direct = tryDirect(ga, gb, blocked);
  if (direct) return direct;

  // 2. Leave faces, L between leave points
  const la = leavePoint(ga, EXIT_CLEAR);
  const lb = leavePoint(gb, EXIT_CLEAR);
  if (!la || !lb) return null;

  // Escape runs (port → leave). Allow port cell on own box border.
  const escA = seg(ga.x, ga.y, la.x, la.y);
  const escB = seg(lb.x, lb.y, gb.x, gb.y);
  if (!segmentClear(escA, blocked, allowSet(ga, gb))) return null;
  if (!segmentClear(escB, blocked, allowSet(ga, gb))) return null;

  const mid = bestElbow(la, lb, blocked, allowSet(ga, gb));
  if (!mid) return null;

  const segments = [escA, ...mid.segments, escB].filter((s) => !isDegenerate(s));
  if (!segments.length) return null;
  return { segments, cost: mid.cost + EXIT_CLEAR * 2 };
}

function tryDirect(ga, gb, blocked) {
  const allow = allowSet(ga, gb);
  // Horizontal same row — classic bus backbone: left E meets right W
  if (ga.y === gb.y) {
    const left = ga.x <= gb.x ? ga : gb;
    const right = ga.x <= gb.x ? gb : ga;
    if (left.side === 'E' && right.side === 'W' && right.x > left.x) {
      const s = seg(left.x, left.y, right.x, right.y);
      if (segmentClear(s, blocked, allow)) {
        return { segments: [s], cost: Math.abs(right.x - left.x) };
      }
    }
  }
  // Vertical same column — top S meets bottom N
  if (ga.x === gb.x) {
    const top = ga.y <= gb.y ? ga : gb;
    const bot = ga.y <= gb.y ? gb : ga;
    if (top.side === 'S' && bot.side === 'N' && bot.y > top.y) {
      const s = seg(top.x, top.y, bot.x, bot.y);
      if (segmentClear(s, blocked, allow)) {
        return { segments: [s], cost: Math.abs(bot.y - top.y) };
      }
    }
  }
  return null;
}

function bestElbow(la, lb, blocked, allow) {
  // HV: horizontal then vertical via (lb.x, la.y)
  // VH: vertical then horizontal via (la.x, lb.y)
  const candidates = [];
  if (la.x !== lb.x && la.y !== lb.y) {
    candidates.push({
      name: 'HV',
      segs: [seg(la.x, la.y, lb.x, la.y), seg(lb.x, la.y, lb.x, lb.y)],
    });
    candidates.push({
      name: 'VH',
      segs: [seg(la.x, la.y, la.x, lb.y), seg(la.x, lb.y, lb.x, lb.y)],
    });
  } else if (la.y === lb.y) {
    candidates.push({ name: 'H', segs: [seg(la.x, la.y, lb.x, lb.y)] });
  } else {
    candidates.push({ name: 'V', segs: [seg(la.x, la.y, lb.x, lb.y)] });
  }

  let best = null;
  for (const c of candidates) {
    const segs = c.segs.filter((s) => !isDegenerate(s));
    if (!segs.every((s) => segmentClear(s, blocked, allow))) continue;
    const cost = segs.reduce(
      (n, s) => n + Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1),
      0
    );
    if (!best || cost < best.cost) best = { segments: segs, cost };
  }
  return best;
}

function leavePoint(g, clear) {
  const d = outward(g.side);
  if (!d) return null;
  return { x: g.x + d.ox * clear, y: g.y + d.oy * clear, side: g.side };
}

function outward(side) {
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

function emitStub(page, net, g) {
  const d = outward(g.side) || { ox: 1, oy: 0 };
  const x2 = g.x + d.ox * STUB_LEN;
  const y2 = g.y + d.oy * STUB_LEN;
  page.wires.push({
    netId: net.id,
    segments: [seg(g.x, g.y, x2, y2)],
  });
  // Exterior net label just past stub tip
  let lx = x2;
  let ly = y2;
  if (g.side === 'E') lx = x2 + 1;
  else if (g.side === 'W') lx = x2 - String(net.name).length;
  else if (g.side === 'S') {
    lx = x2 - Math.floor(String(net.name).length / 2);
    ly = y2;
  } else if (g.side === 'N') {
    lx = x2 - Math.floor(String(net.name).length / 2);
    ly = y2;
  }
  page.labels.push({
    text: net.name,
    x: Math.max(0, lx),
    y: Math.max(0, ly),
    kind: 'net',
  });
}

function buildBlocked(boxes) {
  // Set of "x,y" cells occupied by any box chrome (border + interior).
  const cells = new Set();
  for (const b of boxes) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        cells.add(x + ',' + y);
      }
    }
  }
  return cells;
}

function allowSet(ga, gb) {
  // Endpoints may sit on box borders (the pin cells themselves).
  return new Set([ga.x + ',' + ga.y, gb.x + ',' + gb.y]);
}

function segmentClear(s, blocked, allow) {
  const pts = cellsOnSegment(s);
  for (const k of pts) {
    if (allow && allow.has(k)) continue;
    if (blocked.has(k)) return false;
  }
  return true;
}

function cellsOnSegment(s) {
  const out = [];
  let { x1, y1, x2, y2 } = s;
  if (y1 === y2) {
    const y = y1;
    const a = Math.min(x1, x2);
    const b = Math.max(x1, x2);
    for (let x = a; x <= b; x++) out.push(x + ',' + y);
  } else if (x1 === x2) {
    const x = x1;
    const a = Math.min(y1, y2);
    const b = Math.max(y1, y2);
    for (let y = a; y <= b; y++) out.push(x + ',' + y);
  } else {
    // Should not happen — ortho only
    out.push(x1 + ',' + y1, x2 + ',' + y2);
  }
  return out;
}

function seg(x1, y1, x2, y2) {
  return { x1, y1, x2, y2 };
}

function isDegenerate(s) {
  return s.x1 === s.x2 && s.y1 === s.y2;
}

module.exports = { routeV1, STUB_LEN, EXIT_CLEAR };
