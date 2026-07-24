/**
 * Library API for asciiWiring renderer.
 */

const { parseDocument } = require('./parse');
const { buildNetlist } = require('./model');
const { classify } = require('./classify');
const { layoutSpineV1 } = require('./layout/spine-v1');
const { validateAndLoadLayout } = require('./layout/loader');
const { layoutFromDocument } = require('./layout/from-document');
const { paintClassic } = require('./paint/classic');

function render(markdown, options = {}) {
  const ast = parseDocument(markdown);
  const netlist = classify(buildNetlist(ast));
  const policy = (options.layout && options.layout.policy) || 'spine-v1';
  let plan;
  if (policy === 'spine-v1') {
    plan = layoutSpineV1(netlist);
  } else if (policy === 'from-document') {
    const yamlString = options.layout && options.layout.layoutDocument;
    if (!yamlString) throw new Error('layout: from-document requires layoutDocument string');
    const layoutDoc = validateAndLoadLayout(yamlString, netlist);
    plan = layoutFromDocument(netlist, layoutDoc);
  } else throw new Error(`Unknown layout policy: ${policy}`);

  const profile = (options.paint && options.paint.profile) || 'classic';
  if (profile !== 'classic') throw new Error(`Unknown paint profile: ${profile}`);
  return paintClassic(plan, options);
}

function debugStages(markdown, options = {}) {
  const ast = parseDocument(markdown);
  const netlist = buildNetlist(ast);
  const classified = classify(netlist);
  const policy = (options.layout && options.layout.policy) || 'spine-v1';
  let plan;
  if (policy === 'spine-v1') {
    plan = layoutSpineV1(classified);
  } else if (policy === 'from-document') {
    const yamlString = options.layout && options.layout.layoutDocument;
    if (!yamlString) throw new Error('layout: from-document requires layoutDocument string');
    const layoutDoc = validateAndLoadLayout(yamlString, netlist);
    plan = layoutFromDocument(netlist, layoutDoc);
  } else throw new Error(`Unknown layout policy: ${policy}`);
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
