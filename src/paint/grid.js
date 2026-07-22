/**
 * Character grid with net-aware wire cells for joins vs hops.
 */

function createGrid(width, height) {
  const chars = Array.from({ length: height }, () => Array(width).fill(' '));
  // wireCoverage[y][x] = { h: netId|null, v: netId|null }
  const wire = Array.from({ length: height }, () =>
    Array.from({ height: width }, () => null)
  );
  // fix: wire cells
  const cov = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ h: null, v: null }))
  );
  return { width, height, chars, cov };
}

function inBounds(g, x, y) {
  return x >= 0 && y >= 0 && x < g.width && y < g.height;
}

function setChar(g, x, y, ch, priority = 0) {
  if (!inBounds(g, x, y)) return;
  // priorities stored loosely: higher wins if we track - for v1 last-write with rank map outside
  g.chars[y][x] = ch;
}

function getChar(g, x, y) {
  if (!inBounds(g, x, y)) return ' ';
  return g.chars[y][x];
}

function ensureSize(g, width, height) {
  while (g.height < height) {
    g.chars.push(Array(g.width).fill(' '));
    g.cov.push(Array.from({ length: g.width }, () => ({ h: null, v: null })));
    g.height++;
  }
  if (width > g.width) {
    for (let y = 0; y < g.height; y++) {
      while (g.chars[y].length < width) g.chars[y].push(' ');
      while (g.cov[y].length < width) g.cov[y].push({ h: null, v: null });
    }
    g.width = width;
  }
}

function markWireH(g, x, y, netId) {
  if (!inBounds(g, x, y)) return;
  g.cov[y][x].h = netId;
}

function markWireV(g, x, y, netId) {
  if (!inBounds(g, x, y)) return;
  g.cov[y][x].v = netId;
}

function gridToString(g) {
  return g.chars
    .map((row) => row.join('').replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '') + '\n';
}

module.exports = {
  createGrid,
  inBounds,
  setChar,
  getChar,
  ensureSize,
  markWireH,
  markWireV,
  gridToString,
};
