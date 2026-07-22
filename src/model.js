/**
 * AstDocument → electrical netlist (IR).
 * See docs/ARCHITECTURE.md §3.2
 */

function buildNetlist(ast) {
  const components = ast.components.map((name, columnIndex) => ({
    id: `c${columnIndex}`,
    name,
    columnIndex,
  }));

  const nets = ast.nets.map((n, rowIndex) => ({
    id: `n${rowIndex}`,
    name: n.name,
    floating: n.floating,
    rowIndex,
  }));

  const ports = [];
  let p = 0;
  for (let ni = 0; ni < ast.nets.length; ni++) {
    const net = nets[ni];
    const cells = ast.nets[ni].cells;
    for (let ci = 0; ci < components.length; ci++) {
      const cell = cells[ci];
      if (cell == null) continue;
      const anonymous = cell.toLowerCase() === 'x';
      ports.push({
        id: `p${p++}`,
        componentId: components[ci].id,
        netId: net.id,
        kind: anonymous ? 'anonymous' : 'named',
        label: anonymous ? undefined : cell,
      });
    }
  }

  return {
    components,
    nets,
    ports,
    abbreviations: { ...ast.abbreviations },
  };
}

function portsForComponent(netlist, componentId) {
  return netlist.ports.filter((p) => p.componentId === componentId);
}

function portsForNet(netlist, netId) {
  return netlist.ports.filter((p) => p.netId === netId);
}

function getComponent(netlist, id) {
  return netlist.components.find((c) => c.id === id);
}

function getNet(netlist, id) {
  return netlist.nets.find((n) => n.id === id);
}

module.exports = {
  buildNetlist,
  portsForComponent,
  portsForNet,
  getComponent,
  getNet,
};
