/**
 * Derive layout roles: bus | branch | passive | other.
 * See docs/SPEC.md §8
 */

const { portsForComponent, getNet } = require('./model');

function classify(netlist) {
  const roles = {};
  for (const comp of netlist.components) {
    roles[comp.id] = roleFor(netlist, comp.id);
  }
  return { ...netlist, roles };
}

function roleFor(netlist, componentId) {
  const ports = portsForComponent(netlist, componentId);
  if (ports.length === 0) return 'other';

  const named = ports.filter((p) => p.kind === 'named');
  const anon = ports.filter((p) => p.kind === 'anonymous');
  const anonNets = new Set(anon.map((p) => p.netId));

  // Passive: anonymous terminals on ≥2 distinct nets
  if (anonNets.size >= 2 && named.length === 0) return 'passive';

  const fixedNamed = named.filter((p) => {
    const n = getNet(netlist, p.netId);
    return n && !n.floating;
  });
  const fixedNets = new Set(fixedNamed.map((p) => p.netId));

  // Bus: named pins on ≥2 *fixed* nets (floating power doesn't make a branch a bus).
  // OLED still qualifies via I2C DATA + I2C CLOCK even when VCC/GND are °floating.
  if (fixedNets.size >= 2) return 'bus';

  // Degenerate / incomplete passive
  if (anonNets.size >= 1 && named.length === 0) return 'other';

  return 'branch';
}

module.exports = { classify, roleFor };
