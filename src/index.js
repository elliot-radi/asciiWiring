/**
 * Library API for asciiWiring renderer.
 */

const { parseDocument } = require('./parse');
const { buildNetlist } = require('./model');
const { classify } = require('./classify');
const { layoutSpineV1 } = require('./layout/spine-v1');
const { validateAndLoadLayout } = require('./layout/loader');
const { layoutFromDocument } = require('./layout/from-document');
const { routeV1 } = require('./layout/route-v1');
const { paintClassic } = require('./paint/classic');
const { emitLayoutYaml } = require('./layout/emit');

function place(netlist, options = {}) {
  const policy = (options.layout && options.layout.policy) || 'spine-v1';
  if (policy === 'spine-v1') {
    return layoutSpineV1(netlist);
  }
  if (policy === 'from-document') {
    const yamlString = options.layout && options.layout.layoutDocument;
    if (!yamlString) throw new Error('layout: from-document requires layoutDocument string');
    const layoutDoc = validateAndLoadLayout(yamlString, netlist);
    return layoutFromDocument(netlist, layoutDoc);
  }
  throw new Error(`Unknown layout policy: ${policy}`);
}

/** Place, then route under a layout file unless modules-only (-m). */
function placeThenRoute(netlist, options = {}) {
  const plan = place(netlist, options);
  const policy = (options.layout && options.layout.policy) || 'spine-v1';
  if (policy === 'from-document' && !options.modulesOnly) {
    routeV1(plan, netlist);
  }
  return plan;
}

function render(markdown, options = {}) {
  const ast = parseDocument(markdown);
  const netlist = classify(buildNetlist(ast));
  const plan = placeThenRoute(netlist, options);
  const profile = (options.paint && options.paint.profile) || 'classic';
  if (profile !== 'classic') throw new Error(`Unknown paint profile: ${profile}`);
  return paintClassic(plan, options);
}

/** Return layout YAML seeded from the selected place policy (default spine-v1). */
function emitLayout(markdown, options = {}) {
  const ast = parseDocument(markdown);
  const netlist = classify(buildNetlist(ast));
  // Bootstrap seed: always place with spine unless caller forces from-document
  // (rare). Ignore --layout file when emitting a fresh seed from auto place.
  const placeOpts =
    options.layout && options.layout.policy === 'from-document'
      ? options
      : {};
  const plan = place(netlist, placeOpts);
  return emitLayoutYaml(netlist, plan, options.emit);
}

function debugStages(markdown, options = {}) {
  const ast = parseDocument(markdown);
  const netlist = buildNetlist(ast);
  const classified = classify(netlist);
  const plan = placeThenRoute(classified, options);
  const art = paintClassic(plan);
  return { ast, netlist: classified, plan, art };
}

module.exports = {
  render,
  emitLayout,
  parseDocument,
  buildNetlist,
  classify,
  layoutSpineV1,
  routeV1,
  place,
  placeThenRoute,
  paintClassic,
  debugStages,
};
