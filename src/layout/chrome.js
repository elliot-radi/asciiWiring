/**
 * Shared module chrome sizing (box w/h + title posture).
 *
 * Used by spine-v1 (bootstrap place) and from-document (HITL place) so
 * branch N/S pin-label rows and title clearance match. Paint
 * (classic.placePinLabels) reads titleVAlign / titleBottomInset.
 *
 * See docs/STATUS.md (chrome fork) and docs/GLYPHS.md.
 */

/**
 * @param {string} title component display name
 * @param {{ N: string[], E: string[], S: string[], W: string[] }} sides
 * @param {string} role bus | branch | passive | …
 * @returns {{ w, h, titleVAlign, titleBottomInset?, pinStart, style }}
 */
function sizeChrome(title, sides, role) {
  if (role === 'passive') {
    const pw = Math.max(title.length + 2, 5) + 2;
    return { w: pw, h: 3, titleVAlign: 'top', pinStart: 1, style: 'passive' };
  }

  const nE = (sides.E || []).length;
  const nW = (sides.W || []).length;
  const nN = (sides.N || []).length;
  const nS = (sides.S || []).length;
  const sideStack = Math.max(nE, nW, 0);

  const maxLab = (arr) =>
    Math.max(0, ...(arr || []).map((s) => String(s).length));
  const needEW = Math.max(
    nE ? maxLab(sides.E) + 5 : 0,
    nW ? maxLab(sides.W) + 5 : 0
  );
  const needNS = Math.max(
    nN ? maxLab(sides.N) + 4 : 0,
    nS ? maxLab(sides.S) + 4 : 0
  );
  const needTitle = title.length + 4;
  const innerW = Math.max(needTitle, needEW, needNS, 10);
  const w = innerW + 2;

  // Branch modules (N/S stem posture): title on bottom row interior.
  // Buses and others: title under top border (spine bus posture).
  if (role === 'branch') {
    // Interior top→bottom:
    //   [N pin label?]  [blank if N]  [E/W stack]  [pad if E/W]
    //   title  [blank if S]  [S pin label?]
    // One clear row between the component title and any N/S port label.
    // Title may sit flush on the top or bottom interior wall when that face
    // has no pin label (titleBottomInset 0 ⇒ title on y+h-2).
    const nLab = nN > 0 ? 1 : 0;
    const nGap = nN > 0 ? 1 : 0;
    const pinRows = Math.max(sideStack, 0);
    const pinPad = pinRows > 0 ? 1 : 0;
    const sGap = nS > 0 ? 1 : 0;
    const sLab = nS > 0 ? 1 : 0;
    const h = 1 + nLab + nGap + pinRows + pinPad + 1 + sGap + sLab + 1;
    return {
      w,
      h,
      titleVAlign: 'bottom',
      // inset 2 ⇒ title at y+h-4, blank y+h-3, S label y+h-2
      titleBottomInset: nS > 0 ? 2 : 0,
      pinStart: 1 + nLab + nGap,
      style: 'branch',
    };
  }

  // Bus / default: top, title, blank, pin stack (min 1), bottom
  const pinRows = Math.max(sideStack, 1);
  const h = 1 + 1 + 1 + pinRows + 1;
  return {
    w,
    h,
    titleVAlign: 'top',
    pinStart: 3, // first E/W pin row (y + 3) — matches spine bus firstPinY
    style: 'bus',
  };
}

module.exports = { sizeChrome };
