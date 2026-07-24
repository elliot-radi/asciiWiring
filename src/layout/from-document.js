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
 *   1. layoutSpineV1(netlist) - full place+route quality
 *   2. Rigid-move boxes whose dossier x/y differ:
 *        - ports owned by that component
 *        - wire segment ends that sat on those port cells
 *        - labels whose origin sat on the pre-move box footprint
 *        - S-face exterior net labels just below that footprint
 *
 * Non-identity moves are best-effort (endpoint retarget). Identity path is the bar.
 *
 * See docs/LAYOUT.md and ARCHITECTURE.md.
 */

const { layoutSpineV1 } = require('./spine-v1');

function layoutFromDocument(netlist, layoutDoc) {
  const plan = layoutSpineV1(netlist);
  return applyLayoutDocument(plan, netlist, layoutDoc);
}

function applyLayoutDocument(plan, netlist, layoutDoc) {
  const page = plan.pages[0];
  if (!page) return plan;

  const nameToComp = new Map(netlist.components.map((c) => [c.name, c]));
  const portOwner = new Map(netlist.ports.map((p) => [p.id, p.componentId]));
  const pt = (x, y) => x + ',' + y;

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

    const endMap = new Map();
    for (const pg of page.ports) {
      if (portOwner.get(pg.portId) !== comp.id) continue;
      const ox = pg.x;
      const oy = pg.y;
      pg.x += dx;
      pg.y += dy;
      endMap.set(pt(ox, oy), { x: pg.x, y: pg.y });
    }

    for (const w of page.wires) {
      for (const s of w.segments) {
        const a = endMap.get(pt(s.x1, s.y1));
        if (a) {
          s.x1 = a.x;
          s.y1 = a.y;
        }
        const b = endMap.get(pt(s.x2, s.y2));
        if (b) {
          s.x2 = b.x;
          s.y2 = b.y;
        }
      }
    }

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

    for (const pg of page.ports) {
      if (portOwner.get(pg.portId) !== comp.id) continue;
      if (pg.side !== 'S') continue;
      const oldPortX = pg.x - dx;
      const oldPortY = pg.y - dy;
      for (const lab of page.labels) {
        if (lab.kind !== 'net') continue;
        if (lab.y <= oldPortY || lab.y > oldPortY + 4) continue;
        const mid = lab.x + Math.floor(lab.text.length / 2);
        if (Math.abs(mid - oldPortX) <= Math.max(lab.text.length, 2)) {
          lab.x += dx;
          lab.y += dy;
        }
      }
    }

    box.x = dossier.x;
    box.y = dossier.y;
  }

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
  page.meta = Object.assign({}, page.meta || {}, { policy: 'from-document' });

  return plan;
}

module.exports = { layoutFromDocument, applyLayoutDocument };
