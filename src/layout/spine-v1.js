/**
 * Layout policy spine-v1
 * See docs/ARCHITECTURE.md, docs/table01-walkthrough.md, examples/art02.md
 */

const {
  portsForComponent,
  portsForNet,
  getComponent,
  getNet,
} = require('../model');

const GAP_BUSES = 9;
const STEM_RUN = 4;

function layoutSpineV1(netlist, layoutDoc = null) {
  // Extract layout overrides if provided
  const components = layoutDoc?.components || {};
  const pinOrders = layoutDoc?.pinOrder || {};
  const sides = layoutDoc?.sides || {};
  const hasLayout = layoutDoc !== null;
  const byRole = (role) =>
    netlist.components.filter((c) => netlist.roles[c.id] === role);

  const buses = byRole('bus').sort((a, b) => a.columnIndex - b.columnIndex);
  const branches = byRole('branch').sort((a, b) => a.columnIndex - b.columnIndex);
  const passives = byRole('passive');

  if (buses.length === 0) {
    throw new Error('spine-v1: need at least one bus component');
  }

  const busIds = new Set(buses.map((b) => b.id));
  const { netY, firstPinY } = assignNetRows(netlist, buses, busIds);

  const boxMeta = {};
  for (const bus of buses) {
    const ports = portsForComponent(netlist, bus.id).filter((p) => p.kind === 'named');
    const pinLabels = ports.map((p) => p.label || '');
    const title = bus.name;
    const innerW = Math.max(title.length + 4, ...pinLabels.map((l) => l.length + 5), 12);
    const w = innerW + 2;
    const pinYs = ports.map((p) => netY[p.netId]).filter((y) => y != null);
    const maxPinY = pinYs.length ? Math.max(...pinYs) : firstPinY;
    boxMeta[bus.id] = { w, h: maxPinY + 2, ports };
  }

  const boxes = [];
  const portGeom = [];
  const wires = [];
  const labels = [];
  const portLabels = {};

  let x = 1;
  const busPlaced = [];
  for (let bi = 0; bi < buses.length; bi++) {
    const bus = buses[bi];
    const meta = boxMeta[bus.id];
    
    // Use layout position if provided, otherwise auto-place
    const layoutPos = components[bus.name];
    const box = {
      componentId: bus.id,
      x: hasLayout && layoutPos ? layoutPos.x : x,
      y: hasLayout && layoutPos ? layoutPos.y : 0,
      w: meta.w,
      h: meta.h,
      title: bus.name,
    };
    boxes.push(box);
    busPlaced.push({ bus, box, meta, index: bi });

    for (const p of meta.ports) {
      const py = netY[p.netId];
      if (py == null) continue;
      const side = hasLayout 
        ? (sides[bus.name]?.[p.label || p.id] || sideForBusPort(buses, busIds, bi, p, netlist))
        : sideForBusPort(buses, busIds, bi, p, netlist);
      const px = side === 'E' ? box.x + box.w - 1 : box.x;
      portGeom.push({ portId: p.id, x: px, y: py, side, marker: '●' });
      if (p.label) portLabels[p.id] = p.label;
    }
    
    // Update x only for non-layout mode
    if (!hasLayout) x += meta.w + GAP_BUSES;
  }

  for (const net of netlist.nets) {
    const geoms = portsForNet(netlist, net.id)
      .filter((p) => {
        const c = getComponent(netlist, p.componentId);
        return c && busIds.has(c.id) && p.kind === 'named';
      })
      .map((p) => portGeom.find((g) => g.portId === p.id))
      .filter(Boolean)
      .sort((a, b) => a.x - b.x);

    for (let i = 0; i < geoms.length - 1; i++) {
      const a = geoms[i];
      const b = geoms[i + 1];
      if (a.y !== b.y) continue;
      wires.push({
        netId: net.id,
        segments: [{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }],
      });
    }
  }

  layoutBranchesAndPassives({
    netlist,
    buses: busPlaced,
    branches,
    passives,
    boxes,
    portGeom,
    wires,
    labels,
    portLabels,
    hasLayout,
    components,
    pinOrders,
    sides,
  });

  layoutDanglingStubs({ netlist, portGeom, wires, labels });

  let width = 0;
  let height = 0;
  const bump = (xx, yy) => {
    width = Math.max(width, xx + 1);
    height = Math.max(height, yy + 1);
  };
  for (const b of boxes) bump(b.x + b.w, b.y + b.h);
  for (const p of portGeom) bump(p.x, p.y);
  for (const w of wires) {
    for (const s of w.segments) {
      bump(Math.max(s.x1, s.x2), Math.max(s.y1, s.y2));
    }
  }
  for (const l of labels) bump(l.x + Math.max(l.text.length, 1), l.y);

  return {
    pages: [
      {
        width: width + 2,
        height: height + 1,
        boxes,
        ports: portGeom,
        wires,
        labels,
        meta: {
          netChannelY: { ...netY },
          policy: 'spine-v1',
          portLabels,
        },
      },
    ],
  };
}

function sideForBusPort(buses, busIds, bi, port, netlist) {
  const namedOnNet = portsForNet(netlist, port.netId).filter((p) => p.kind === 'named');
  const busOwners = new Set(
    namedOnNet
      .map((p) => getComponent(netlist, p.componentId))
      .filter((c) => c && busIds.has(c.id))
      .map((c) => c.id)
  );
  const shared = busOwners.size >= 2;
  const first = bi === 0;
  const last = bi === buses.length - 1;
  if (shared) {
    if (first) return 'E';
    if (last) return 'W';
    return 'E';
  }
  return 'E';
}

function assignNetRows(netlist, buses, busIds) {
  const firstPinY = 3;
  const netY = {};

  const info = {};
  for (const net of netlist.nets) {
    const named = portsForNet(netlist, net.id).filter((p) => p.kind === 'named');
    const onBuses = new Set(
      named
        .map((p) => getComponent(netlist, p.componentId))
        .filter((c) => c && busIds.has(c.id))
        .map((c) => c.id)
    );
    const touchesNonBus = named.some((p) => {
      const c = getComponent(netlist, p.componentId);
      return c && !busIds.has(c.id);
    });
    info[net.id] = { named, onBuses, busCount: onBuses.size, touchesNonBus };
  }

  const shared = netlist.nets.filter((n) => info[n.id].busCount >= 2);
  shared.sort((a, b) => scoreShared(a) - scoreShared(b) || a.rowIndex - b.rowIndex);

  function scoreShared(net) {
    let s = 0;
    if (net.floating) s -= 80;
    if (net.floating && /3\.?3|3v3|vdd|vcc/i.test(net.name)) s -= 15;
    if (net.floating && /5v/i.test(net.name)) s -= 8;
    if (net.floating && /gnd|ground|vss/i.test(net.name)) s -= 5;
    if (/i2c data|sda/i.test(net.name)) s += 10;
    if (/i2c clock|scl/i.test(net.name)) s += 11;
    if (/addr/i.test(net.name)) s += 12;
    return s + net.rowIndex * 0.01;
  }

  let y = firstPinY;
  for (const net of shared) netY[net.id] = y++;

  const cursor = {};
  for (const bus of buses) {
    let maxShared = firstPinY - 1;
    for (const net of shared) {
      if (info[net.id].onBuses.has(bus.id) && netY[net.id] != null) {
        maxShared = Math.max(maxShared, netY[net.id]);
      }
    }
    cursor[bus.id] = maxShared + 1;
  }

  const exclusive = netlist.nets.filter((n) => info[n.id].busCount === 1);
  exclusive.sort((a, b) => {
    const as = info[a.id].touchesNonBus ? 1 : 0;
    const bs = info[b.id].touchesNonBus ? 1 : 0;
    if (as !== bs) return as - bs;
    return a.rowIndex - b.rowIndex;
  });

  for (const net of exclusive) {
    const busId = [...info[net.id].onBuses][0];
    netY[net.id] = cursor[busId]++;
  }

  return { netY, firstPinY };
}

function layoutBranchesAndPassives(ctx) {
  const {
    netlist,
    buses,
    branches,
    passives,
    boxes,
    portGeom,
    wires,
    labels,
    portLabels,
    hasLayout,
    components,
    pinOrders,
    sides,
  } = ctx;

  const hostBottom = {};
  for (const bp of buses) hostBottom[bp.bus.id] = bp.box.y + bp.box.h;

  // Place left-host branches first so right-host modules can sit alongside
  // without inheriting a tall left stack (art02: RELAY left, ZMCT right).
  const ordered = [...branches].sort((a, b) => {
    const ha = hostBusX(netlist, buses, a);
    const hb = hostBusX(netlist, buses, b);
    if (ha !== hb) return ha - hb;
    return a.columnIndex - b.columnIndex;
  });

  for (const branch of ordered) {
    placeBranchModule({
      netlist,
      branch,
      buses,
      passives,
      boxes,
      portGeom,
      wires,
      labels,
      portLabels,
      hostBottom,
    });
  }
}

function hostBusX(netlist, buses, branch) {
  const namedFixed = portsForComponent(netlist, branch.id).filter((p) => {
    if (p.kind !== 'named') return false;
    const n = getNet(netlist, p.netId);
    return n && !n.floating;
  });
  for (const p of namedFixed) {
    for (const bp of buses) {
      if (
        portsForNet(netlist, p.netId).some(
          (q) => q.kind === 'named' && q.componentId === bp.bus.id
        )
      ) {
        return bp.box.x;
      }
    }
  }
  return 0;
}

function placeBranchModule(ctx) {
  const {
    netlist,
    branch,
    buses,
    passives,
    boxes,
    portGeom,
    wires,
    labels,
    portLabels,
    hostBottom,
    hasLayout,
    components,
    pinOrders,
    sides,
  } = ctx;

  const bPorts = portsForComponent(netlist, branch.id);
  const named = bPorts.filter((p) => p.kind === 'named');
  const namedFixed = named.filter((p) => {
    const n = getNet(netlist, p.netId);
    return n && !n.floating;
  });
  const namedFloat = named.filter((p) => {
    const n = getNet(netlist, p.netId);
    return n && n.floating;
  });

  let stemPort = null;
  let stemNet = null;
  let host = null;
  let busPort = null;

  for (const p of namedFixed) {
    for (const bp of buses) {
      const bpPort = portsForNet(netlist, p.netId).find(
        (q) => q.kind === 'named' && q.componentId === bp.bus.id
      );
      if (bpPort) {
        stemPort = p;
        stemNet = getNet(netlist, p.netId);
        host = bp;
        busPort = bpPort;
        break;
      }
    }
    if (stemPort) break;
  }
  if (!stemPort || !stemNet || !host) return;

  const busPortG = portGeom.find((g) => g.portId === busPort.id);
  if (!busPortG) return;

  const dropDir = busPortG.side === 'W' ? -1 : 1;
  const stemX = busPortG.x + dropDir * STEM_RUN;
  const stemTop = busPortG.y;

  wires.push({
    netId: stemNet.id,
    segments: [{ x1: busPortG.x, y1: stemTop, x2: stemX, y2: stemTop }],
  });

  namedFloat.sort(
    (a, b) =>
      floatScore(getNet(netlist, a.netId).name) -
      floatScore(getNet(netlist, b.netId).name)
  );
  const southPort =
    namedFloat.find((p) => /gnd|ground|vss/i.test(getNet(netlist, p.netId).name)) || null;

  const eastCandidates = [
    ...namedFixed.filter((p) => p.id !== stemPort.id),
    ...namedFloat.filter((p) => !southPort || p.id !== southPort.id),
  ];
  eastCandidates.sort((a, b) => {
    const na = getNet(netlist, a.netId).name;
    const nb = getNet(netlist, b.netId).name;
    return floatScore(na) - floatScore(nb);
  });

  const title = branch.name;
  const eastLabs = eastCandidates.map((p) => p.label || '');
  const maxEast = Math.max(0, ...eastLabs.map((s) => s.length));
  const stemLab = stemPort.label || '';
  const innerW = Math.max(title.length + 4, maxEast + 5, stemLab.length + 4, 10);
  const brW = innerW + 2;

  // Apply pinOrder if provided
  const branchPinOrder = hasLayout ? (pinOrders[branch.name] || null) : null;
  if (branchPinOrder) {
    const orderedPorts = branchPinOrder.map(name =>
      eastCandidates.find(p => p.label === name)
    ).filter(Boolean);
    // Add any remaining ports not in pinOrder
    const orderedIds = new Set(orderedPorts.map(p => p.id));
    const remaining = eastCandidates.filter(p => !orderedIds.has(p.id));
    eastCandidates.length = 0;
    eastCandidates.push(...orderedPorts, ...remaining);
  }

  // Module chrome: top, optional stem row, east pins, pad, title, bottom.
  // Compact simple branch (BUTTON): stem●, label, title, south● — fewer blanks.
  const nEast = eastCandidates.length;
  const simple = nEast === 0;
  const brH = simple
    ? 1 + 1 + 1 + 1 // top, label/blank, title, bottom
    : 1 + 1 + nEast + 1 + 1 + 1;

  // Under this host only — different-host modules keep independent depths
  // so RELAY (MCU) and ZMCT (ADC) can sit side-by-side (art02).
  const yUnder = hostBottom[host.bus.id];
  const teeY = yUnder + 2;

  const netPassives = passives.filter((pas) =>
    portsForComponent(netlist, pas.id).some((p) => p.netId === stemNet.id)
  );
  const pas = netPassives[0];
  if (pas) {
    placePassiveOnStem({
      netlist,
      pas,
      stemNet,
      stemX,
      stemTopY: stemTop,
      teeY,
      dropDir,
      boxes,
      portGeom,
      wires,
      labels,
    });
  } else {
    wires.push({
      netId: stemNet.id,
      segments: [{ x1: stemX, y1: stemTop, x2: stemX, y2: teeY }],
    });
  }

  const brTop = teeY + (pas ? 3 : 2);
  
  // Use layout position if provided
  const layoutPos = hasLayout ? components[branch.name] : null;
  let brX = layoutPos ? layoutPos.x : Math.max(0, stemX - Math.floor(brW / 2));
  let brY = layoutPos ? layoutPos.y : brTop;
  
  // If no layout position, use collision avoidance
  if (!layoutPos) {
    // Keep clear of other branch/module boxes and their east stub labels (~12 cols).
    for (const other of boxes) {
      if (other.y + other.h + 2 <= brTop) continue;
      if (other.x + other.w + 12 <= brX || other.x >= brX + brW) continue;
      brX = other.x + other.w + 14;
    }
    if (stemX < brX + 1) brX = Math.max(0, stemX - 2);
    if (stemX > brX + brW - 2) brX = Math.max(0, stemX - brW + 3);
  }

  const brBox = {
    componentId: branch.id,
    x: brX,
    y: brY,
    w: brW,
    h: brH,
    title,
    titleVAlign: 'bottom',
  };
  boxes.push(brBox);

  const stemDotX = clamp(stemX, brBox.x + 1, brBox.x + brBox.w - 2);
  portGeom.push({
    portId: stemPort.id,
    x: stemDotX,
    y: brBox.y,
    side: 'N',
    marker: '●',
  });
  if (stemPort.label) portLabels[stemPort.id] = stemPort.label;

  wires.push({
    netId: stemNet.id,
    segments: [{ x1: stemX, y1: teeY, x2: stemX, y2: brBox.y }],
  });
  if (stemDotX !== stemX) {
    wires.push({
      netId: stemNet.id,
      segments: [{ x1: stemX, y1: brBox.y, x2: stemDotX, y2: brBox.y }],
    });
  }

  // Stem pin text just under north border (IN / OUT)
  if (stemPort.label) {
    const t = stemPort.label;
    labels.push({
      text: t,
      x: brBox.x + Math.max(1, Math.floor((brW - t.length) / 2)),
      y: brBox.y + 1,
      kind: 'note',
    });
  }

  // East pins start one row below stem-label row
  let ey = brBox.y + 2;
  const branchSides = hasLayout ? (sides[branch.name] || {}) : {};
  
  for (const ep of eastCandidates) {
    const net = getNet(netlist, ep.netId);
    const epSide = branchSides[ep.label || ep.id] || 'E';
    const px = epSide === 'E' ? brBox.x + brBox.w - 1 : brBox.x;
    portGeom.push({
      portId: ep.id,
      x: px,
      y: ey,
      side: epSide,
      marker: '●',
    });
    if (ep.label) portLabels[ep.id] = ep.label;

    const owners = portsForNet(netlist, ep.netId).filter((q) => q.kind === 'named');
    // Leaf stubs: exclusive net, or floating not shared as a rail across modules
    // Shared °5V across RELAY+ZMCT: only stub if we want a free label at each
    // module; art02 shows 5V at each module — allow multi-owner floating stubs.
    const stubLeaf = net.floating || owners.length === 1;
    if (stubLeaf) {
      const x2 = epSide === 'E' ? px + 2 : px - 2;
      wires.push({
        netId: net.id,
        segments: [{ x1: px, y1: ey, x2, y2: ey }],
      });
      labels.push({
        text: net.name,
        x: epSide === 'E' ? x2 + 1 : Math.max(0, x2 - net.name.length),
        y: ey,
        kind: "net",
      });
    }
    ey++;
  }

  let bottom = brBox.y + brBox.h;
  if (southPort) {
    const fnet = getNet(netlist, southPort.netId);
    const sy = brBox.y + brBox.h - 1;
    const sx = stemDotX;
    portGeom.push({
      portId: southPort.id,
      x: sx,
      y: sy,
      side: 'S',
      marker: '●',
    });
    if (southPort.label) portLabels[southPort.id] = southPort.label;
    const leafY = brBox.y + brBox.h + 1;
    wires.push({
      netId: fnet.id,
      segments: [{ x1: sx, y1: sy, x2: sx, y2: leafY }],
    });
    labels.push({
      text: fnet.name,
      x: sx - Math.floor(fnet.name.length / 2),
      y: leafY,
      kind: 'net',
    });
    bottom = leafY;
  }

  hostBottom[host.bus.id] = Math.max(hostBottom[host.bus.id], bottom + 2);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function floatScore(name) {
  if (/gnd|ground|vss/i.test(name)) return 0;
  if (/pump|load/i.test(name)) return 1;
  if (/5v|vcc|vdd|3\.3/i.test(name)) return 2;
  return 3;
}

function placePassiveOnStem(ctx) {
  const {
    netlist,
    pas,
    stemNet,
    stemX,
    stemTopY,
    teeY,
    dropDir,
    boxes,
    portGeom,
    wires,
    labels,
  } = ctx;

  const pasName = pas.name;
  const pw = Math.max(pasName.length + 2, 5) + 2;
  const gap = 10;
  const px = dropDir > 0 ? stemX + gap : stemX - gap - pw;
  const rTop = teeY - 1;
  const passiveBox = {
    componentId: pas.id,
    x: Math.max(0, px),
    y: rTop,
    w: pw,
    h: 3,
    title: pasName,
  };
  boxes.push(passiveBox);

  const pasPorts = portsForComponent(netlist, pas.id);
  const onStem = pasPorts.find((p) => p.netId === stemNet.id);
  const other = pasPorts.find((p) => p.netId !== stemNet.id);

  if (onStem) {
    const side = dropDir > 0 ? 'W' : 'E';
    const ox = side === 'W' ? passiveBox.x : passiveBox.x + passiveBox.w - 1;
    portGeom.push({ portId: onStem.id, x: ox, y: teeY, side, marker: 'none' });
  }
  if (other) {
    const cx = passiveBox.x + Math.floor(pw / 2);
    portGeom.push({
      portId: other.id,
      x: cx,
      y: passiveBox.y,
      side: 'N',
      marker: 'none',
    });
    const otherNet = getNet(netlist, other.netId);
    labels.push({
      text: otherNet.name,
      x: cx - Math.floor(otherNet.name.length / 2),
      y: passiveBox.y - 2,
      kind: 'net',
    });
    wires.push({
      netId: otherNet.id,
      segments: [{ x1: cx, y1: passiveBox.y - 2, x2: cx, y2: passiveBox.y }],
    });
  }

  wires.push({
    netId: stemNet.id,
    segments: [{ x1: stemX, y1: stemTopY, x2: stemX, y2: teeY }],
  });
  const attachX = dropDir > 0 ? passiveBox.x : passiveBox.x + passiveBox.w - 1;
  wires.push({
    netId: stemNet.id,
    segments: [{ x1: stemX, y1: teeY, x2: attachX, y2: teeY }],
  });
}

function layoutDanglingStubs(ctx) {
  const { netlist, portGeom, wires, labels } = ctx;

  for (const net of netlist.nets) {
    const named = portsForNet(netlist, net.id).filter((p) => p.kind === 'named');
    if (named.length !== 1) continue;
    if (wires.some((w) => w.netId === net.id)) continue;

    const p = named[0];
    const g = portGeom.find((pg) => pg.portId === p.id);
    if (!g) continue;

    const stubLen = 5;
    let x2 = g.x;
    let y2 = g.y;
    let lx = g.x;
    if (g.side === 'E') {
      x2 = g.x + stubLen;
      lx = x2 + 1;
    } else if (g.side === 'W') {
      x2 = g.x - stubLen;
      lx = x2 - net.name.length;
    } else if (g.side === 'S') {
      y2 = g.y + stubLen;
      lx = x2 - Math.floor(net.name.length / 2);
    } else {
      x2 = g.x + stubLen;
      lx = x2 + 1;
    }

    wires.push({
      netId: net.id,
      segments: [{ x1: g.x, y1: g.y, x2, y2 }],
    });
    labels.push({
      text: net.name,
      x: Math.max(0, lx),
      y: y2,
      kind: 'net',
    });
  }
}

module.exports = { layoutSpineV1 };
