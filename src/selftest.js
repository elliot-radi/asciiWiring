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

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nall passed');
