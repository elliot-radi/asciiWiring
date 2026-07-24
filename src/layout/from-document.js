/**
 * Layout policy: from-document (rfc/004 place loop)
 *
 * Build module chrome from the place YAML dossier + table. page.wires stays
 * empty here; route-v1 fills them unless -m.
 *
 * Abandons spine+slide wire morph. Spine remains bootstrap only when no
 * layout file is supplied (see spine-v1). Chrome sizing: layout/chrome.js.
 *
 * See docs/LAYOUT.md and docs/rfc/004-hitl-place-loop-and-modules-only.md.
 */

const { portsForComponent } = require('../model');
const { sizeChrome } = require('./chrome');

/**
 * @param {object} netlist classified netlist
 * @param {object} layoutDoc name → { x, y, sides: {N,E,S,W} }
 * @returns {object} LayoutPlan (modules chrome only)
 */
function layoutFromDocument(netlist, layoutDoc) {
  const boxes = [];
  const portGeom = [];
  const labels = [];
  const portLabels = {};

  // Table column order for stable paint when boxes overlap edges.
  const ordered = [...netlist.components].sort((a, b) => a.columnIndex - b.columnIndex);

  for (const comp of ordered) {
    const dossier = layoutDoc[comp.name];
    if (!dossier) continue;

    const role = (netlist.roles && netlist.roles[comp.id]) || 'other';
    const chrome = sizeChrome(comp.name, dossier.sides, role);
    const box = {
      componentId: comp.id,
      x: dossier.x,
      y: dossier.y,
      w: chrome.w,
      h: chrome.h,
      title: comp.name,
    };
    if (chrome.titleVAlign) box.titleVAlign = chrome.titleVAlign;
    // Shift bottom title up one row when an S-face pin label needs the last interior.
    if (chrome.titleBottomInset) box.titleBottomInset = chrome.titleBottomInset;
    boxes.push(box);

    placePortsOnChrome({
      netlist,
      comp,
      dossier,
      box,
      chrome,
      portGeom,
      labels,
      portLabels,
    });
  }

  const page = {
    width: 1,
    height: 1,
    boxes,
    ports: portGeom,
    wires: [], // filled by route-v1 unless modules-only (-m)
    labels,
    meta: {
      policy: 'from-document',
      portLabels,
      modulesOnly: true, // cleared when route-v1 runs
    },
  };
  recomputePageBounds(page);
  return { pages: [page] };
}

function placePortsOnChrome(ctx) {
  const { netlist, comp, dossier, box, chrome, portGeom, labels, portLabels } = ctx;
  const named = portsForComponent(netlist, comp.id).filter(
    (p) => p.kind === 'named' && p.label
  );
  const byLabel = new Map(named.map((p) => [p.label, p]));

  for (const face of ['N', 'E', 'S', 'W']) {
    const bank = dossier.sides[face] || [];
    for (let i = 0; i < bank.length; i++) {
      const label = bank[i];
      const port = byLabel.get(label);
      if (!port) continue;

      const cell = faceCell(box, chrome, face, i, bank.length);
      portGeom.push({
        portId: port.id,
        x: cell.x,
        y: cell.y,
        side: face,
        marker: '●',
      });
      portLabels[port.id] = label;
      // N/S interior pin text is placed by paint (placePinLabels) now that
      // branch chrome reserves a south-label row when needed.
    }
  }

  // Trust loader census: every named pin is banked. Anonymous passive ports
  // have no face list — allow empty sides without PortGeom (paint chrome only).
}

/**
 * Map face bank index → border cell.
 * N/S: list order left → right; single pin → face mid (rfc/004 aesthetic).
 * E/W: list order top → bottom from chrome.pinStart.
 */
function faceCell(box, chrome, face, index, count) {
  if (face === 'N' || face === 'S') {
    const y = face === 'N' ? box.y : box.y + box.h - 1;
    const x = distributeNS(box, index, count);
    return { x, y };
  }
  // E / W
  const x = face === 'E' ? box.x + box.w - 1 : box.x;
  const y0 = box.y + chrome.pinStart;
  // Keep pins on vertical walls (not corners)
  const maxY = box.y + box.h - 2;
  let y = y0 + index;
  if (y > maxY) y = maxY;
  if (y < box.y + 1) y = box.y + 1;
  return { x, y };
}

/** N/S pin x: single pin → face mid (clamped off corners); else left→right. */
function distributeNS(box, index, count) {
  const lo = box.x + 1;
  const hi = box.x + box.w - 2;
  if (count <= 1 || hi <= lo) {
    const mid = box.x + Math.floor(box.w / 2);
    return Math.max(lo, Math.min(hi, mid));
  }
  const span = hi - lo;
  return lo + Math.round((index * span) / (count - 1));
}

function recomputePageBounds(page) {
  let width = 0;
  let height = 0;
  const bump = (xx, yy) => {
    width = Math.max(width, xx + 1);
    height = Math.max(height, yy + 1);
  };
  for (const b of page.boxes || []) bump(b.x + b.w, b.y + b.h);
  for (const p of page.ports || []) bump(p.x, p.y);
  for (const w of page.wires || []) {
    for (const s of w.segments) bump(Math.max(s.x1, s.x2), Math.max(s.y1, s.y2));
  }
  for (const l of page.labels || []) bump(l.x + Math.max(String(l.text).length, 1), l.y);
  page.width = width + 2;
  page.height = height + 1;
}

module.exports = { layoutFromDocument, sizeChrome, recomputePageBounds };
