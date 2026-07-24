#!/usr/bin/env node
/**
 * CLI (transitional binary name; target: ascw)
 *
 *   node src/render.js [flags] TABLE.md [LAYOUT.yaml]
 *
 * Flags:
 *   --debug              stage summary JSON on stderr; art still on stdout
 *   --emit-layout        print bootstrap layout YAML instead of art
 *   -m, --modules-only   modules chrome only (no interconnect); default when
 *                        LAYOUT is present until a real router lands
 *   --layout FILE        deprecated alias for second positional LAYOUT.yaml
 *
 * See docs/rfc/004-hitl-place-loop-and-modules-only.md.
 */

const fs = require('fs');
const path = require('path');
const { render, debugStages, emitLayout } = require('./index');

function usage(code = 1) {
  const msg = `Usage: node src/render.js [options] TABLE.md [LAYOUT.yaml]

  Reads a Markdown wiring table and prints ASCII art.
  With no TABLE path, reads the table from stdin (layout still via flag/path).

  --debug              stage summary JSON on stderr; art still on stdout
  --emit-layout        print bootstrap layout YAML (spine PortGeom seed)
  -m, --modules-only   modules chrome only (no interconnect)
  --layout FILE        deprecated: same as second positional LAYOUT.yaml
`;
  process.stderr.write(msg);
  process.exit(code);
}

function main(argv) {
  let debug = false;
  let emit = false;
  let modulesOnly = false;
  let layoutFile = null;
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') usage(0);
    else if (a === '--debug') debug = true;
    else if (a === '--emit-layout') emit = true;
    else if (a === '-m' || a === '--modules-only') modulesOnly = true;
    else if (a === '--layout') {
      layoutFile = argv[++i];
      if (!layoutFile) {
        process.stderr.write('Missing argument for --layout\n');
        usage(1);
      }
    } else if (a.startsWith('-')) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      usage(1);
    } else {
      positionals.push(a);
    }
  }

  // Grammar: TABLE.md [LAYOUT.yaml]  — at most one extra free path = layout
  if (positionals.length > 2) usage(1);
  const tablePath = positionals[0] || null;
  if (positionals.length === 2) {
    if (layoutFile) {
      process.stderr.write('layout: pass LAYOUT.yaml as second path or --layout, not both\n');
      process.exit(1);
    }
    layoutFile = positionals[1];
  }

  if (modulesOnly && !layoutFile && !emit) {
    process.stderr.write('modules-only (-m) requires a LAYOUT.yaml\n');
    process.exit(1);
  }

  let text;
  if (tablePath) {
    text = fs.readFileSync(path.resolve(tablePath), 'utf8');
  } else {
    text = fs.readFileSync(0, 'utf8');
  }

  const options = {};
  if (layoutFile) {
    const layoutYaml = fs.readFileSync(path.resolve(layoutFile), 'utf8');
    options.layout = { policy: 'from-document', layoutDocument: layoutYaml };
  }
  // modulesOnly is informational until route is real; layout path already no-ops wires.
  if (modulesOnly) options.modulesOnly = true;

  try {
    if (emit) {
      // Seed from auto place; layout path ignored for emit (fresh bootstrap seed).
      process.stdout.write(emitLayout(text));
      return;
    }
    if (debug) {
      const stages = debugStages(text, options);
      const page = stages.plan.pages[0] || {};
      const summary = {
        components: stages.netlist.components.map((c) => ({
          name: c.name,
          role: stages.netlist.roles[c.id],
        })),
        nets: stages.netlist.nets.map((n) => ({
          name: n.name,
          floating: n.floating,
        })),
        ports: stages.netlist.ports.map((p) => ({
          id: p.id,
          component: stages.netlist.components.find((c) => c.id === p.componentId).name,
          net: stages.netlist.nets.find((n) => n.id === p.netId).name,
          kind: p.kind,
          label: p.label,
        })),
        boxes: (page.boxes || []).map((b) => ({
          title: b.title,
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
        })),
        policy: page.meta && page.meta.policy,
        wireCount: (page.wires || []).length,
      };
      process.stderr.write(JSON.stringify(summary, null, 2) + '\n');
      process.stdout.write(stages.art);
    } else {
      process.stdout.write(render(text, options));
    }
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(1);
  }
}

main(process.argv.slice(2));
