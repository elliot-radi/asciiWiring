#!/usr/bin/env node
/**
 * Minimal structural smoke tests for table01.
 * Run: node src/selftest.js
 */

const fs = require('fs');
const path = require('path');
const { debugStages, render } = require('./index');

const root = path.join(__dirname, '..');
const table = fs.readFileSync(path.join(root, 'examples/table01.md'), 'utf8');

let failed = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    console.error(`  FAIL ${name}`);
    failed++;
  }
}

function roleOf(netlist, name) {
  const c = netlist.components.find((x) => x.name === name);
  return c && netlist.roles[c.id];
}

console.log('table01 structural tests');
{
  const { netlist, art } = debugStages(table);
  check('ESP32-C3 is bus', roleOf(netlist, 'ESP32-C3') === 'bus');
  check('SSD1306 OLED is bus', roleOf(netlist, 'SSD1306 OLED') === 'bus');
  check('BUTTON is branch', roleOf(netlist, 'BUTTON') === 'branch');
  check('R1 is passive', roleOf(netlist, 'R1') === 'passive');
  check('art has ESP32-C3', art.includes('ESP32-C3'));
  check('art has SSD1306 OLED', art.includes('SSD1306 OLED'));
  check('art has BUTTON', art.includes('BUTTON'));
  check('art has R1', art.includes('R1'));
  check('art has GPIO8', art.includes('GPIO8'));
  check('art has SDA', art.includes('SDA'));
  check('art has SCK (table spelling)', art.includes('SCK'));
  check('art has pullup tee topology marker', art.includes('├') && art.includes('R1'));
  check('art has free GND label', /\bGND\b/.test(art));
  check('art has free 3.3V label', art.includes('3.3V'));
  check('render() stable', render(table) === art);
}

console.log('\ntable02 structural tests');
{
  const table2 = fs.readFileSync(path.join(root, 'examples/table02.md'), 'utf8');
  const { netlist, art } = debugStages(table2);
  check('ESP32-C3 is bus', roleOf(netlist, 'ESP32-C3') === 'bus');
  check('ADS1115 is bus', roleOf(netlist, 'ADS1115') === 'bus');
  check('ZMCT103C is branch', roleOf(netlist, 'ZMCT103C') === 'branch');
  check('RELAY is branch', roleOf(netlist, 'RELAY') === 'branch');
  check('art has ADS1115', art.includes('ADS1115'));
  check('art has ZMCT103C', art.includes('ZMCT103C'));
  check('art has RELAY', art.includes('RELAY'));
  check('art has sense stubs TPO/TPU/AMB', art.includes('TPO') && art.includes('TPU') && art.includes('AMB'));
  check('art has I2C pins', art.includes('GPIO8') && art.includes('SDA'));
  check('art has RELAY_CMD host GPIO3', art.includes('GPIO3'));
  check('art has dry-contact nets', art.includes('PUMP_IN') && art.includes('PUMP_OUT'));
  check('art has NO/COM pins or relay body', art.includes('NO') || art.includes('RELAY'));
  check('render() stable', render(table2) === art);
}

console.log('\nlayout loader tests');
{
  const table2 = fs.readFileSync(path.join(root, 'examples/table02.md'), 'utf8');
  const layout2 = fs.readFileSync(path.join(root, 'examples/layout02.yaml'), 'utf8');
  const { parseDocument, buildNetlist, classify } = require('./index');
  const { validateAndLoadLayout } = require('./layout/loader');
  const netlist = classify(buildNetlist(parseDocument(table2)));

  const layout = validateAndLoadLayout(layout2, netlist);
  check('layout02 has 4 components', Object.keys(layout).length === 4);
  check('layout02 ESP32-C3 has 6 pins', layout['ESP32-C3'].sides.E.length === 6);
  check(
    'layout02 ADS1115 has 9 pins',
    layout['ADS1115'].sides.E.length + layout['ADS1115'].sides.W.length === 9
  );

  // Bad layout: missing component ZMCT103C
  let bad = layout2.replace(/  ZMCT103C:[\s\S]*/, '');
  try {
    validateAndLoadLayout(bad, netlist);
    check('missing component throws', false);
  } catch (e) {
    check('missing component throws', /layout: missing component ZMCT103C/.test(e.message));
  }

  bad = layout2.replace('E: [3V3, GND', 'E: [3V3, GND, GPIO8');
  try {
    validateAndLoadLayout(bad, netlist);
    check('duplicate pin throws', false);
  } catch (e) {
    check('duplicate pin throws', /layout: ESP32-C3 duplicate pin GPIO8/.test(e.message));
  }

  bad = layout2.replace('E: [3V3, GND', 'E: [FOOBAR, 3V3, GND');
  try {
    validateAndLoadLayout(bad, netlist);
    check('unknown pin throws', false);
  } catch (e) {
    check('unknown pin throws', /layout: ESP32-C3 unknown pin FOOBAR/.test(e.message));
  }
}

console.log('\nfrom-document modules-only tests');
{
  const table2 = fs.readFileSync(path.join(root, 'examples/table02.md'), 'utf8');
  const layout2 = fs.readFileSync(path.join(root, 'examples/layout02.yaml'), 'utf8');
  const optsM = {
    layout: { policy: 'from-document', layoutDocument: layout2 },
    modulesOnly: true,
  };
  const { plan, art } = debugStages(table2, optsM);
  const page = plan.pages[0];

  check('from-document policy meta', page.meta && page.meta.policy === 'from-document');
  check('from-document -m wires empty', (page.wires || []).length === 0);
  check('from-document art has ESP32-C3', art.includes('ESP32-C3'));
  check('from-document art has ADS1115', art.includes('ADS1115'));
  check('from-document art has RELAY', art.includes('RELAY'));
  check('from-document art has ZMCT103C', art.includes('ZMCT103C'));
  check('from-document pin labels on chrome', art.includes('GPIO8') && art.includes('SDA'));
  check('from-document branch N label IN', art.includes('IN'));
  check('from-document has pin dots', art.includes('●'));
  check('from-document no exterior PUMP_IN stub', !art.includes('PUMP_IN'));
  check('from-document no exterior TPO stub', !art.includes('TPO'));

  // S-face interior pin names on branch chrome (from-document path)
  check('from-document RELAY shows S pin name GND', /│\s*GND\s*│/.test(art));
  check('from-document ZMCT shows S pin name GND', /│\s*GND\s*│/.test(art));
  check(
    'from-document branch title not smashed with S label',
    !/GNDRELAY|RELAYGND|GNDZMCT|ZMCTGND/.test(art.replace(/\s/g, ''))
  );

  // Chrome fork closed for bootstrap path too (shared sizeChrome).
  {
    const spineArt = render(table2);
    check('spine RELAY shows S pin name GND', /│\s*GND\s*│/.test(spineArt));
    check(
      'spine branch title not smashed with S label',
      !/GNDRELAY|RELAYGND|GNDZMCT|ZMCTGND/.test(spineArt.replace(/\s/g, ''))
    );
    // Untouched emit under -m should match spine module box heights (chrome).
    const { emitLayout, debugStages: dbg } = require('./index');
    const em = emitLayout(table2);
    const spineBoxes = dbg(table2).plan.pages[0].boxes
      .filter((b) => b.titleVAlign === 'bottom')
      .map((b) => ({ t: b.title, h: b.h, inset: b.titleBottomInset || 0 }))
      .sort((a, b) => a.t.localeCompare(b.t));
    const docBoxes = dbg(table2, {
      layout: { policy: 'from-document', layoutDocument: em },
      modulesOnly: true,
    }).plan.pages[0].boxes
      .filter((b) => b.titleVAlign === 'bottom')
      .map((b) => ({ t: b.title, h: b.h, inset: b.titleBottomInset || 0 }))
      .sort((a, b) => a.t.localeCompare(b.t));
    check(
      'chrome parity spine vs emit-from-document branch h/inset',
      JSON.stringify(spineBoxes) === JSON.stringify(docBoxes)
    );
  }

  // Authored x/y honored: RELAY slides left
  {
    const shifted = layout2.replace(/(RELAY:\n\s+x:\s*)\d+/, '$18');
    const { plan: p2, art: artShift } = debugStages(table2, {
      layout: { policy: 'from-document', layoutDocument: shifted },
      modulesOnly: true,
    });
    const relayBox = p2.pages[0].boxes.find((b) => b.title === 'RELAY');
    check('from-document RELAY x from dossier', relayBox && relayBox.x === 8);
    check('from-document RELAY still painted after slide', artShift.includes('RELAY'));
    check('from-document slide keeps wires empty under -m', (p2.pages[0].wires || []).length === 0);
  }

  // Face bank restamp: move RELAY IN from N → W
  {
    const restamp = layout2.replace(
      /RELAY:\n\s+x:\s*\d+\n\s+y:\s*\d+\n\s+sides:\n\s+N: \[IN\]\n\s+E: \[NO, COM, 5V\]\n\s+S: \[GND\]\n\s+W: \[\]/,
      'RELAY:\n    x: 12\n    y: 14\n    sides:\n      N: []\n      E: [NO, COM, 5V]\n      S: [GND]\n      W: [IN]'
    );
    const { plan: p3 } = debugStages(table2, {
      layout: { policy: 'from-document', layoutDocument: restamp },
      modulesOnly: true,
    });
    const portById = new Map(p3.pages[0].ports.map((g) => [g.portId, g]));
    const { parseDocument, buildNetlist, classify } = require('./index');
    const netlist = classify(buildNetlist(parseDocument(table2)));
    const inPort = netlist.ports.find(
      (p) =>
        p.label === 'IN' &&
        netlist.components.find((c) => c.id === p.componentId).name === 'RELAY'
    );
    const g = inPort && portById.get(inPort.id);
    check('from-document face restamp IN → W', g && g.side === 'W');
  }

  // Compact packing: modules at new origins, still chrome-only under -m
  {
    const compact = layout2
      .replace(/(ADS1115:\n\s+x:\s*)\d+/, '$127')
      .replace(/(RELAY:\n\s+x:\s*)\d+/, '$11')
      .replace(/(RELAY:\n\s+x:\s*1\n\s+y:\s*)\d+/, '$113')
      .replace(/(ZMCT103C:\n\s+x:\s*)\d+/, '$128')
      .replace(/(ZMCT103C:\n\s+x:\s*28\n\s+y:\s*)\d+/, '$115');
    const { plan: pC, art: artC } = debugStages(table2, {
      layout: { policy: 'from-document', layoutDocument: compact },
      modulesOnly: true,
    });
    const byTitle = Object.fromEntries(pC.pages[0].boxes.map((b) => [b.title, b]));
    check('from-document compact ADS x', byTitle.ADS1115 && byTitle.ADS1115.x === 27);
    check(
      'from-document compact RELAY origin',
      byTitle.RELAY && byTitle.RELAY.x === 1 && byTitle.RELAY.y === 13
    );
    check(
      'from-document compact ZMCT origin',
      byTitle.ZMCT103C && byTitle.ZMCT103C.x === 28 && byTitle.ZMCT103C.y === 15
    );
    check('from-document compact -m still empty wires', (pC.pages[0].wires || []).length === 0);
    check('from-document compact paints all titles', artC.includes('RELAY') && artC.includes('ZMCT103C'));
  }
}

console.log('\nroute-v1 under layout02 tests');
{
  const table2 = fs.readFileSync(path.join(root, 'examples/table02.md'), 'utf8');
  const layout2 = fs.readFileSync(path.join(root, 'examples/layout02.yaml'), 'utf8');
  const opts = { layout: { policy: 'from-document', layoutDocument: layout2 } };
  const { plan, art } = debugStages(table2, opts);
  const page = plan.pages[0];
  const mArt = render(table2, { ...opts, modulesOnly: true });

  check('route-v1 meta router', page.meta && page.meta.router === 'route-v1');
  check('route-v1 has wires', (page.wires || []).length > 0);
  check('route-v1 not modules-only art', art !== mArt);
  check(
    'route-v1 -m still chrome only',
    (debugStages(table2, { ...opts, modulesOnly: true }).plan.pages[0].wires || []).length === 0
  );
  check('route-v1 I2C backbone H', /GPIO8 ●─+● SDA/.test(art) || /GPIO8 ●.*● SDA/.test(art));
  check('route-v1 3.3V rail', /3V3 ●─+● VDD/.test(art) || /3V3 ●.*● VDD/.test(art));
  check('route-v1 leaf PUMP_IN', art.includes('PUMP_IN'));
  check('route-v1 leaf TPO', art.includes('TPO'));
  const wireNets = new Set((page.wires || []).map((w) => w.netId));
  check('route-v1 multiple nets routed', wireNets.size >= 6);
  check('route-v1 floating GND keeps ESP–ADS rail', /GND ●─+● GND/.test(art));
  check('route-v1 floating branch still labeled GND near RELAY', /GND/.test(art));
  check('route-v1 paints RELAY+ZMCT', art.includes('RELAY') && art.includes('ZMCT103C'));
}

console.log('\nemit-layout tests');
{
  const { emitLayout, render, parseDocument, buildNetlist, classify } = require('./index');
  const { validateAndLoadLayout } = require('./layout/loader');
  const table2 = fs.readFileSync(path.join(root, 'examples/table02.md'), 'utf8');
  const layout2text = fs.readFileSync(path.join(root, 'examples/layout02.yaml'), 'utf8');
  const netlist = classify(buildNetlist(parseDocument(table2)));

  const emitted = emitLayout(table2);
  check('emit-layout produces components key', /components:/.test(emitted));
  {
    const keys = [...emitted.matchAll(/^\s{2}([A-Za-z0-9_.\"-]+):\s*$/gm)].map(
      (m) => m[1].replace(/^"|"$/g, '')
    );
    check(
      'emit-layout spatial order ESP32, ADS, RELAY, ZMCT',
      keys.join(',') === 'ESP32-C3,ADS1115,RELAY,ZMCT103C'
    );
  }

  let loaded;
  try {
    loaded = validateAndLoadLayout(emitted, netlist);
    check('emit-layout validates via loader', true);
  } catch (e) {
    check('emit-layout validates via loader', false);
    console.error('   ', e.message);
  }

  if (loaded) {
    const hand = validateAndLoadLayout(layout2text, netlist);
    const names = Object.keys(hand).sort();
    check(
      'emit-layout same component set as layout02',
      names.join(',') === Object.keys(loaded).sort().join(',')
    );
    let match = true;
    for (const n of names) {
      if (hand[n].x !== loaded[n].x || hand[n].y !== loaded[n].y) match = false;
      for (const f of ['N', 'E', 'S', 'W']) {
        if (hand[n].sides[f].join('|') !== loaded[n].sides[f].join('|')) match = false;
      }
    }
    check('emit-layout structural match vs layout02 (x/y/sides)', match);
  }

  const modulesArt = render(table2, {
    layout: { policy: 'from-document', layoutDocument: emitted },
    modulesOnly: true,
  });
  const { plan: emitPlan } = require('./index').debugStages(table2, {
    layout: { policy: 'from-document', layoutDocument: emitted },
    modulesOnly: true,
  });
  check(
    'emit-layout → from-document -m wires empty',
    (emitPlan.pages[0].wires || []).length === 0
  );
  check('emit-layout → from-document paints titles', modulesArt.includes('ESP32-C3'));
  check(
    'emit-layout → from-document not spine full art',
    modulesArt !== render(table2)
  );
  const routedArt = render(table2, {
    layout: { policy: 'from-document', layoutDocument: emitted },
  });
  check(
    'emit-layout → from-document default routes',
    routedArt !== modulesArt && /●─/.test(routedArt)
  );

  const table1 = fs.readFileSync(path.join(root, 'examples/table01.md'), 'utf8');
  const em1 = emitLayout(table1);
  const nl1 = classify(buildNetlist(parseDocument(table1)));
  try {
    validateAndLoadLayout(em1, nl1);
    check('emit-layout table01 (passive empty sides) validates', true);
  } catch (e) {
    check('emit-layout table01 (passive empty sides) validates', false);
    console.error('   ', e.message);
  }
  const art1mod = render(table1, {
    layout: { policy: 'from-document', layoutDocument: em1 },
    modulesOnly: true,
  });
  check('emit-layout table01 → modules art has passive', art1mod.includes('R1'));
  check('emit-layout table01 → modules art has BUTTON', art1mod.includes('BUTTON'));
  check(
    'emit-layout table01 → not spine identity',
    art1mod !== render(table1)
  );
}

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nall passed');
