/**
 * Layout document loader
 * Loads YAML sidecar files with validation.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Load a layout YAML file and validate structure.
 * @param {string} filePath - Path to layout YAML file
 * @param {object} netlist - Netlist IR (for validation)
 * @returns {object} Parsed layout document
 */
function loadLayout(filePath, netlist) {
  const absPath = path.resolve(filePath);
  
  if (!fs.existsSync(absPath)) {
    throw new Error(`Layout file not found: ${absPath}`);
  }

  const content = fs.readFileSync(absPath, 'utf8');
  let doc;
  
  try {
    doc = yaml.load(content);
  } catch (err) {
    throw new Error(`Invalid YAML in ${filePath}: ${err.message}`);
  }

  if (!doc || typeof doc !== 'object') {
    throw new Error(`Layout file must be a YAML document (object): ${filePath}`);
  }

  // Validate components
  const components = doc.components || {};
  for (const [name, pos] of Object.entries(components)) {
    if (!pos || typeof pos !== 'object') {
      throw new Error(`components.${name} must be an object with x/y`);
    }
    if (typeof pos.x !== 'number' || typeof pos.y !== 'number') {
      throw new Error(`components.${name}.x and .y must be numbers`);
    }
    // Check component exists in netlist
    const exists = netlist.components.some(c => c.name === name);
    if (!exists) {
      console.warn(`Warning: components.${name} not found in table`);
    }
  }

  // Validate pinOrder
  const pinOrder = doc.pinOrder || {};
  for (const [name, order] of Object.entries(pinOrder)) {
    if (!Array.isArray(order)) {
      throw new Error(`pinOrder.${name} must be an array of pin names`);
    }
  }

  // Validate sides
  const sides = doc.sides || {};
  const validSides = new Set(['N', 'E', 'S', 'W', 'n', 'e', 's', 'w']);
  for (const [compName, pinSides] of Object.entries(sides)) {
    if (!pinSides || typeof pinSides !== 'object') {
      throw new Error(`sides.${compName} must be an object`);
    }
    for (const [pinName, side] of Object.entries(pinSides)) {
      if (typeof side !== 'string') {
        throw new Error(`sides.${compName}.${pinName} must be a string (N/E/S/W)`);
      }
      const normalized = side.toUpperCase();
      if (!validSides.has(normalized)) {
        throw new Error(`sides.${compName}.${pinName}: invalid side '${side}' (must be N/E/S/W)`);
      }
    }
  }

  return {
    components,
    pinOrder,
    sides,
    groups: doc.groups || {},
  };
}

module.exports = { loadLayout };
