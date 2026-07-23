/**
 * Library API for asciiWiring renderer.
 */

const { parseDocument } = require('./parse');
const { buildNetlist } = require('./model');
const { classify } = require('./classify');
const { layoutSpineV1 } = require('./layout/spine-v1');
const { paintClassic } = require('./paint/classic');
const { loadLayout } = require('./layout/load');

function render(markdown, options = {}) {
  const ast = parseDocument(markdown);
  const netlist = classify(buildNetlist(ast));
  
  // Load layout document if provided
  let layoutDoc = null;
  if (options.layout && options.layout.file) {
    layoutDoc = loadLayout(options.layout.file, netlist);
  }
  
  const policy = (options.layout && options.layout.policy) || 'spine-v1';
  let plan;
  if (policy === 'spine-v1') plan = layoutSpineV1(netlist, layoutDoc);
  else throw new Error(`Unknown layout policy: ${policy}`);

  const profile = (options.paint && options.paint.profile) || 'classic';
  if (profile !== 'classic') throw new Error(`Unknown paint profile: ${profile}`);
  return paintClassic(plan, options);
}

function debugStages(markdown) {
  const ast = parseDocument(markdown);
  const netlist = buildNetlist(ast);
  const classified = classify(netlist);
  const plan = layoutSpineV1(classified);
  const art = paintClassic(plan);
  return { ast, netlist: classified, plan, art };
}

module.exports = {
  render,
  parseDocument,
  buildNetlist,
  classify,
  layoutSpineV1,
  paintClassic,
  debugStages,
};
