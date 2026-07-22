/**
 * classic glyph profile + layout plan rasterizer.
 * See docs/SPEC.md §9
 */

const {
  createGrid,
  ensureSize,
  setChar,
  markWireH,
  markWireV,
  gridToString,
  inBounds,
} = require('./grid');

const G = {
  name: 'classic',
  box: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
  port: '●',
  wire: {
    h: '─',
    v: '│',
    teeE: '├',
    teeW: '┤',
    teeN: '┴',
    teeS: '┬',
    join4: '┼',
    hop: '\\',
  },
};

const PRI = {
  blank: 0,
  box: 1,
  wire: 2,
  join: 3,
  port: 4,
  text: 5,
};

function paintClassic(plan) {
  const page = plan.pages[0];
  if (!page) return '\n';

  const g = createGrid(Math.max(page.width, 1), Math.max(page.height, 1));
  const rank = Array.from({ length: g.height }, () => Array(g.width).fill(0));
  /** @type {('T'|'B'|'L'|'R'|'TL'|'TR'|'BL'|'BR'|null)[][]} */
  const border = Array.from({ length: g.height }, () => Array(g.width).fill(null));

  function put(x, y, ch, prio) {
    if (!inBounds(g, x, y)) {
      ensureSize(g, x + 1, y + 1);
      while (rank.length < g.height) {
        rank.push(Array(g.width).fill(0));
        border.push(Array(g.width).fill(null));
      }
      for (let yy = 0; yy < rank.length; yy++) {
        while (rank[yy].length < g.width) rank[yy].push(0);
        while (border[yy].length < g.width) border[yy].push(null);
      }
    }
    if (!inBounds(g, x, y)) return;
    if (prio >= rank[y][x]) {
      setChar(g, x, y, ch);
      rank[y][x] = prio;
    }
  }

  // 1. Boxes (+ border mask)
  for (const b of page.boxes) drawBox(g, put, border, b);

  // 2. Wire segments
  for (const w of page.wires) {
    for (const seg of w.segments) drawSegment(g, put, seg, w.netId);
  }

  // 3. Joins / hops / border attachments
  resolveJunctions(g, put, border);

  // 4. Port markers
  for (const p of page.ports) {
    if (p.marker === 'none') continue;
    if (p.marker && p.marker !== '●' && p.marker !== G.port) continue;
    put(p.x, p.y, G.port, PRI.port);
  }

  // 5. Free labels
  for (const lab of page.labels) {
    for (let i = 0; i < lab.text.length; i++) {
      put(lab.x + i, lab.y, lab.text[i], PRI.text);
    }
  }

  // 6. Pin labels
  placePinLabels(page, put);

  return gridToString(g);
}

function drawBox(g, put, border, b) {
  const { x, y, w, h, title } = b;
  if (w < 2 || h < 2) return;

  const mark = (cx, cy, kind) => {
    if (inBounds(g, cx, cy)) border[cy][cx] = kind;
  };

  put(x, y, G.box.tl, PRI.box);
  mark(x, y, 'TL');
  put(x + w - 1, y, G.box.tr, PRI.box);
  mark(x + w - 1, y, 'TR');
  put(x, y + h - 1, G.box.bl, PRI.box);
  mark(x, y + h - 1, 'BL');
  put(x + w - 1, y + h - 1, G.box.br, PRI.box);
  mark(x + w - 1, y + h - 1, 'BR');

  for (let i = 1; i < w - 1; i++) {
    put(x + i, y, G.box.h, PRI.box);
    mark(x + i, y, 'T');
    put(x + i, y + h - 1, G.box.h, PRI.box);
    mark(x + i, y + h - 1, 'B');
  }
  for (let j = 1; j < h - 1; j++) {
    put(x, y + j, G.box.v, PRI.box);
    mark(x, y + j, 'L');
    put(x + w - 1, y + j, G.box.v, PRI.box);
    mark(x + w - 1, y + j, 'R');
  }

  const t = ` ${title}`;
  const tx = x + 1;
  // Default top title (bus modules). Branch modules may set titleVAlign:'bottom'.
  const ty =
    b.titleVAlign === 'bottom' ? y + h - 2 : y + 1;
  for (let i = 0; i < t.length && i < w - 2; i++) {
    put(tx + i, ty, t[i], PRI.text);
  }
}

function drawSegment(g, put, seg, netId) {
  let { x1, y1, x2, y2 } = seg;
  if (y1 === y2) {
    const y = y1;
    const xa = Math.min(x1, x2);
    const xb = Math.max(x1, x2);
    for (let x = xa; x <= xb; x++) {
      markWireH(g, x, y, netId);
      put(x, y, G.wire.h, PRI.wire);
    }
  } else if (x1 === x2) {
    const x = x1;
    const ya = Math.min(y1, y2);
    const yb = Math.max(y1, y2);
    for (let y = ya; y <= yb; y++) {
      markWireV(g, x, y, netId);
      put(x, y, G.wire.v, PRI.wire);
    }
  } else {
    drawSegment(g, put, { x1, y1, x2, y2: y1 }, netId);
    drawSegment(g, put, { x1: x2, y1, x2, y2 }, netId);
  }
}

function resolveJunctions(g, put, border) {
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const c = g.cov[y][x];
      const b = border[y] ? border[y][x] : null;

      // Wire×wire
      if (c.h && c.v) {
        if (c.h === c.v) put(x, y, joinGlyph(g, x, y, c.h), PRI.join);
        else put(x, y, G.wire.hop, PRI.join);
        continue;
      }

      // Attachment of a lone wire into a box edge
      if (b && (c.h || c.v)) {
        const net = c.h || c.v;
        const attach = borderAttachGlyph(b, c);
        if (attach) {
          put(x, y, attach, PRI.join);
          continue;
        }
        // Also allow full joinGlyph if arms exist through the border cell
        const glyph = joinGlyph(g, x, y, net);
        if (glyph !== G.wire.h && glyph !== G.wire.v) {
          put(x, y, glyph, PRI.join);
        }
        continue;
      }

      // Free-field tees / elbows (single occupancy that still branches)
      if (c.h || c.v) {
        const net = c.h || c.v;
        const glyph = joinGlyph(g, x, y, net);
        if (glyph !== G.wire.h && glyph !== G.wire.v) {
          put(x, y, glyph, PRI.join);
        }
      }
    }
  }
}

/**
 * When a wire ends on / passes a box border, pick the schematic attachment char.
 * Top + vertical wire → ┴ (wire comes from above into cabinet)
 * Bottom + vertical → ┬
 * Left + horizontal → ├  (wire from west into box) — art often wants ┤? 
 *   art01: ├──────────┤ 10k west edge is ┤ meaning wire approaches from west
 *   So Left border + H wire → ┤
 * Right + H → ├
 */
function borderAttachGlyph(bKind, cov) {
  if (bKind === 'T' && cov.v) return G.wire.teeN; // ┴
  if (bKind === 'B' && cov.v) return G.wire.teeS; // ┬
  if (bKind === 'L' && cov.h) return G.wire.teeW; // ┤  (enter from west)
  if (bKind === 'R' && cov.h) return G.wire.teeE; // ├  (enter from east)
  return null;
}

function arm(g, x, y, netId, dx, dy) {
  const nx = x + dx;
  const ny = y + dy;
  if (!inBounds(g, nx, ny)) return false;
  const c = g.cov[ny][nx];
  return c.h === netId || c.v === netId;
}

function joinGlyph(g, x, y, netId) {
  const N = arm(g, x, y, netId, 0, -1);
  const S = arm(g, x, y, netId, 0, 1);
  const W = arm(g, x, y, netId, -1, 0);
  const E = arm(g, x, y, netId, 1, 0);
  const n = [N, S, W, E].filter(Boolean).length;
  if (n <= 1) {
    const c = g.cov[y][x];
    return c.v && !c.h ? G.wire.v : G.wire.h;
  }
  if (n === 2) {
    if (N && S) return G.wire.v;
    if (E && W) return G.wire.h;
    if (N && E) return '└';
    if (N && W) return '┘';
    if (S && E) return '┌';
    if (S && W) return '┐';
  }
  if (n === 3) {
    if (!N) return G.wire.teeS;
    if (!S) return G.wire.teeN;
    if (!W) return G.wire.teeE;
    if (!E) return G.wire.teeW;
  }
  return G.wire.join4;
}

function placePinLabels(page, put) {
  const map = (page.meta && page.meta.portLabels) || {};
  for (const p of page.ports) {
    const text = map[p.portId];
    if (!text) continue;
    if (p.side === 'E') {
      const start = p.x - 1 - text.length;
      for (let i = 0; i < text.length; i++) put(start + i, p.y, text[i], PRI.text);
    } else if (p.side === 'W') {
      const start = p.x + 1;
      const padded = ' ' + text;
      for (let i = 0; i < padded.length; i++) put(start + i, p.y, padded[i], PRI.text);
    } else if (p.side === 'N' || p.side === 'S') {
      // Module boxes with bottom titles already place N-label / free S-net text
      // via layout labels — drawing S pin text on title row got "BUTTON"+"GND"
      // smashed into "BUGNDN". Skip interior N/S pin text for those boxes.
      const box = page.boxes.find(
        (b) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h
      );
      if (!box || box.titleVAlign === 'bottom') continue;
      const tx = box.x + Math.max(1, Math.floor((box.w - text.length) / 2));
      const ty = p.side === 'N' ? box.y + 2 : box.y + box.h - 2;
      for (let i = 0; i < text.length; i++) put(tx + i, ty, text[i], PRI.text);
    }
  }
}

module.exports = { paintClassic, G };
