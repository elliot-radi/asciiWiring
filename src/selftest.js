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
  check('OLED is bus', roleOf(netlist, 'OLED') === 'bus');
  check('BUTTON is branch', roleOf(netlist, 'BUTTON') === 'branch');
  check('10kΩ is passive', roleOf(netlist, '10kΩ') === 'passive');
  check('art has ESP32-C3', art.includes('ESP32-C3'));
  check('art has OLED', art.includes('OLED'));
  check('art has BUTTON', art.includes('BUTTON'));
  check('art has 10kΩ', art.includes('10kΩ'));
  check('art has GPIO8', art.includes('GPIO8'));
  check('art has SDA', art.includes('SDA'));
  check('art has SCK (table spelling)', art.includes('SCK'));
  check('art has pullup tee topology marker', art.includes('├') && art.includes('10kΩ'));
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
  check('layout02 ESP32-C3 has 6 pins',
        layout['ESP32-C3'].sides.E.length === 6);
  check('layout02 ADS1115 has 9 pins',
        layout['ADS1115'].sides.E.length + layout['ADS1115'].sides.W.length === 9);

  // Bad layout: missing component ZMCT103C
  let bad = layout2.replace(/  ZMCT103C:.*/s, '');
  try {
    validateAndLoadLayout(bad, netlist);
    check('missing component throws', false);
  } catch (e) {
    check('missing component throws', /layout: missing component ZMCT103C/.test(e.message));
  }

  // Bad layout: duplicate pin
  bad = layout2.replace('E: [3V3, GND', 'E: [3V3, GND, GPIO8');
  try {
    validateAndLoadLayout(bad, netlist);
    check('duplicate pin throws', false);
  } catch (e) {
    check('duplicate pin throws', /layout: ESP32-C3 duplicate pin GPIO8/.test(e.message));
  }

  // Bad layout: unknown pin
  bad = layout2.replace('E: [3V3, GND', 'E: [FOOBAR, 3V3, GND');
  try {
    validateAndLoadLayout(bad, netlist);
    check('unknown pin throws', false);
  } catch (e) {
    check('unknown pin throws', /layout: ESP32-C3 unknown pin FOOBAR/.test(e.message));
  }
}

console.log('\nfrom-document policy tests');
{
  const table2 = fs.readFileSync(path.join(root, 'examples/table02.md'), 'utf8');
  const layout2 = fs.readFileSync(path.join(root, 'examples/layout02.yaml'), 'utf8');
  const spineArt = render(table2);
  const art = render(table2, {
    layout: { policy: 'from-document', layoutDocument: layout2 },
  });
  check('from-document identity vs spine when YAML matches spine', art === spineArt);
  check('from-document art has ESP32-C3', art.includes('ESP32-C3'));
  check('from-document art has ADS1115', art.includes('ADS1115'));
  check('from-document art has RELAY', art.includes('RELAY'));
  check('from-document art has ZMCT103C', art.includes('ZMCT103C'));
  check('from-document has I2C backbone', art.includes('GPIO8') && art.includes('SDA'));
  check('from-document has 3V3-VDD run', art.includes('3V3') && art.includes('VDD'));
  check('from-document has branch IN pin', art.includes('IN'));

  // Leaf stubs (S-face GND drop + E-face short stubs) must ride with box Δx/Δy.
  // Regression: only the port vertex moved; free stub tip + net label stayed put.
  {
    // layout02 has RELAY at x:12; shift left like the hand trial at x:8
    const shifted = layout2.replace(
      /(RELAY:\n\s+x:\s*)\d+/,
      '$18'
    );
    const artShift = render(table2, {
      layout: { policy: 'from-document', layoutDocument: shifted },
    });
    const lines = artShift.split('\n');
    // Find RELAY south ● row and the GND label should share column under it.
    let relayS = -1;
    let relayCol = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/RELAY/.test(lines[i])) {
        // south border with ● is next few lines in classic paint
        for (let j = i; j < Math.min(i + 4, lines.length); j++) {
          const m = lines[j].match(/└[─┐]*●/);
          if (m) {
            relayS = j;
            relayCol = lines[j].indexOf('●');
            break;
          }
        }
        break;
      }
    }
    let gndUnder = false;
    if (relayS >= 0 && relayCol >= 0) {
      for (let j = relayS + 1; j < Math.min(relayS + 4, lines.length); j++) {
        const row = lines[j];
        // GND label centered roughly on port column
        const g = row.indexOf('GND');
        if (g >= 0 && Math.abs(g + 1 - relayCol) <= 2) gndUnder = true;
        // vertical wire under port
        if (row[relayCol] === '│') gndUnder = true;
      }
    }
    check('from-document RELAY -x keeps GND leaf under S pin', gndUnder);
    check('from-document RELAY -x keeps PUMP_IN on E stub', /NO.*PUMP_IN/.test(artShift));
  }

  // ADS +3x must stretch W-face rails from ESP (not leave a gap / slide both ends).
  {
    const adsShift = layout2.replace(/(ADS1115:\n\s+x:\s*)\d+/, '$127');
    const artAds = render(table2, {
      layout: { policy: 'from-document', layoutDocument: adsShift },
    });
    // Continuous H glyph run: pin dot must touch a rail, not "●  ─"
    check(
      'from-document ADS +x keeps rail on ESP E dots',
      /3V3 ●─/.test(artAds) && /GPIO8 ●─/.test(artAds)
    );
    check(
      'from-document ADS +x still reaches VDD/SDA',
      /● VDD/.test(artAds) && /● SDA/.test(artAds)
    );
    // Short AIN leaf stubs (not length-5 corridor)
    check(
      'from-document AIN stubs short (TPO near pin)',
      /AIN0 ●──TPO/.test(artAds) || /AIN0 ●─+TPO/.test(artAds)
    );
  }

  // Compact HITL trial (/tmp/l.yaml class): move ADS +x, RELAY −y/−x, ZMCT −x/−y.
  // Hinge-only used to collapse face-normal stems and park H on the N wall.
  {
    let compact = layout2
      .replace(/(ADS1115:\n\s+x:\s*)\d+/, '$127')
      .replace(/(RELAY:\n\s+x:\s*)\d+/, '$11')
      .replace(/(RELAY:\n\s+x:\s*1\n\s+y:\s*)\d+/, '$113')
      .replace(/(ZMCT103C:\n\s+x:\s*)\d+/, '$128')
      .replace(/(ZMCT103C:\n\s+x:\s*28\n\s+y:\s*)\d+/, '$115');
    const artC = render(table2, {
      layout: { policy: 'from-document', layoutDocument: compact },
    });
    // IN N-face: stem │ at least one row above the ● on RELAY crown.
    const linesC = artC.split('\n');
    let inRow = -1;
    let inCol = -1;
    for (let i = 0; i < linesC.length; i++) {
      if (!/│\s*IN\s*│/.test(linesC[i])) continue;
      // crown is the prior border row with ●
      for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
        const m = linesC[j].match(/┌─*●─*┐/);
        if (!m) continue;
        inRow = j;
        inCol = linesC[j].indexOf('●');
        break;
      }
      break;
    }
    let stemClear = false;
    if (inRow > 0 && inCol >= 0) {
      const above = linesC[inRow - 1] || '';
      const ch = above[inCol] || '';
      stemClear = ch === '│' || ch === '┤' || ch === '├' || ch === '┘' || ch === '┐';
    }
    check('from-document compact RELAY −y keeps IN stem clearance', stemClear);

    // AIN3 E exit: must not be "●┐" glued — at least one ─ before corner
    check(
      'from-document compact ADS keeps AIN3 outward run',
      /AIN3 ●─+[┐└]/.test(artC) || /AIN3 ●─┐/.test(artC)
    );

    // ZMCT OUT: horizontal approach must not share the N border row (● is on
    // border; H channel sits above). Look for ┌──● or similar with mid-row ─
    // above the box crown, not "──●──" as the north wall itself.
    let outOk = false;
    for (let i = 0; i < linesC.length; i++) {
      if (!/OUT/.test(linesC[i])) continue;
      // N border of ZMCT is typically the prior row with ●
      const crown = linesC[i - 1] || '';
      const outCol = crown.indexOf('●');
      if (outCol < 0) continue;
      // cell above ● should be wire or space from inserted stem, not empty wall-only
      const above = linesC[i - 2] || '';
      const ch = above[outCol] || ' ';
      outOk = ch === '│' || ch === '┘' || ch === '┐' || ch === '┤' || ch === '├';
      // and crown should not be a continuous H through the port as only path
      // (wall collision looked like ──●── with no stem above)
      if (!outOk && /┌.*●.*┐/.test(crown) && ch === ' ') {
        outOk = false;
      }
      break;
    }
    check('from-document compact ZMCT OUT clears N wall', outOk);
  }
}

console.log('\nemit-layout tests');
{
  const { emitLayout, render } = require('./index');
  const { validateAndLoadLayout } = require('./layout/loader');
  const { parseDocument, buildNetlist, classify } = require('./index');
  const table2 = fs.readFileSync(path.join(root, 'examples/table02.md'), 'utf8');
  const layout2text = fs.readFileSync(path.join(root, 'examples/layout02.yaml'), 'utf8');
  const netlist = classify(buildNetlist(parseDocument(table2)));

  const emitted = emitLayout(table2);
  check('emit-layout produces components key', /components:/.test(emitted));

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

  const spineArt = render(table2);
  const roundTrip = render(table2, {
    layout: { policy: 'from-document', layoutDocument: emitted },
  });
  check('emit-layout → from-document identity vs spine', roundTrip === spineArt);

  // table01 has a passive with empty sides — must still emit + load
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
  check(
    'emit-layout table01 → from-document identity',
    render(table1, { layout: { policy: 'from-document', layoutDocument: em1 } }) ===
      render(table1)
  );
}

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nall passed');
