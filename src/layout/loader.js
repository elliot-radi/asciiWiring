const yaml = require('js-yaml');

function validateAndLoadLayout(yamlString, netlist) {
  // 1. Parse YAML
  let doc;
  try {
    doc = yaml.load(yamlString);
  } catch (e) {
    throw new Error('layout: malformed YAML');
  }

  if (doc == null || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('layout: malformed YAML');
  }

  // 2. Missing top-level components
  if (!('components' in doc)) {
    throw new Error('layout: missing components');
  }

  const { components } = doc;

  // 3. components is a map
  if (components == null || typeof components !== 'object' || Array.isArray(components)) {
    throw new Error('layout: components not a map');
  }

  // Build table component map by name
  const tableCompMap = new Map();
  for (const c of netlist.components) {
    tableCompMap.set(c.name, c);
  }

  // 4. Dossier for unknown component
  const layoutNames = Object.keys(components);
  for (const name of layoutNames) {
    if (!tableCompMap.has(name)) {
      throw new Error(`layout: unknown component ${name}`);
    }
  }

  // 5. Table component missing dossier
  for (const c of netlist.components) {
    if (!(c.name in components)) {
      throw new Error(`layout: missing component ${c.name}`);
    }
  }

  const roles = netlist.roles || {};
  const result = {};

  for (const [name, dossier] of Object.entries(components)) {
    const comp = tableCompMap.get(name);

    // Passives must appear in the layout (Mode B) but have no named pins
    // to bank (anonymous x ports are not listed in sides per §5).
    // Future: orientation key for passive axis (§7).

    // 6. Required fields x / y / sides
    for (const field of ['x', 'y', 'sides']) {
      if (!(field in dossier)) {
        throw new Error(`layout: ${name} missing ${field}`);
      }
    }

    // Reject unknown dossier fields (including reserved keys not yet enabled)
    const allowedFields = new Set(['x', 'y', 'sides']);
    for (const key of Object.keys(dossier)) {
      if (!allowedFields.has(key)) {
        throw new Error(`layout: ${name} unknown field ${key}`);
      }
    }

    // 7. x and y must be integers
    if (!Number.isInteger(dossier.x)) {
      throw new Error(`layout: ${name}.x not integer`);
    }
    if (!Number.isInteger(dossier.y)) {
      throw new Error(`layout: ${name}.y not integer`);
    }

    const sides = dossier.sides;

    // 8. sides missing any of N/E/S/W
    for (const face of ['N', 'E', 'S', 'W']) {
      if (!(face in sides)) {
        throw new Error(`layout: ${name}.sides missing ${face}`);
      }
    }

    // 9. sides has a key other than N/E/S/W
    for (const face of Object.keys(sides)) {
      if (!['N', 'E', 'S', 'W'].includes(face)) {
        throw new Error(`layout: ${name}.sides bad face ${face}`);
      }
    }

    // Collect named pins from the table for this component
    const tablePins = new Set(
      netlist.ports
        .filter((p) => p.componentId === comp.id && p.kind === 'named')
        .map((p) => p.label)
    );

    const dossierPins = new Set();

    for (const face of ['N', 'E', 'S', 'W']) {
      const list = sides[face];

      // 10. A face value is not a list
      if (!Array.isArray(list)) {
        throw new Error(`layout: ${name}.${face} not a list`);
      }

      for (const pin of list) {
        // 14. A pin list element is not a string
        if (typeof pin !== 'string') {
          throw new Error(`layout: ${name}.${face} bad pin`);
        }

        // 11. A pin appears that is not in the table column
        if (!tablePins.has(pin)) {
          throw new Error(`layout: ${name} unknown pin ${pin}`);
        }

        // 13. A pin appears more than once
        if (dossierPins.has(pin)) {
          throw new Error(`layout: ${name} duplicate pin ${pin}`);
        }
        dossierPins.add(pin);
      }
    }

    // 12. A table pin missing from the dossier
    for (const pin of tablePins) {
      if (!dossierPins.has(pin)) {
        throw new Error(`layout: ${name} missing pin ${pin}`);
      }
    }

    result[name] = {
      x: dossier.x,
      y: dossier.y,
      sides: {
        N: [...sides.N],
        E: [...sides.E],
        S: [...sides.S],
        W: [...sides.W],
      },
    };
  }

  return result;
}

module.exports = { validateAndLoadLayout };
