#!/usr/bin/env node
/**
 * CLI: node src/render.js [--debug] [--layout file.yaml] [--emit-layout] [file.md]
 * Reads Markdown wiring table; writes ASCII art (or layout YAML) to stdout.
 */

const fs = require('fs');
const path = require('path');
const { render, debugStages, emitLayout } = require('./index');

function usage(code = 1) {
  const msg = `Usage: node src/render.js [options] [file.md]

  Reads a Markdown wiring table and prints ASCII art.
  With no file, reads stdin.

  --debug         stage summary JSON on stderr; art still on stdout
  --layout FILE   load layout sidecar YAML (policy: from-document)
  --emit-layout   print bootstrap layout YAML (from spine-v1 PortGeom) instead of art
`;
  process.stderr.write(msg);
  process.exit(code);
}

function main(argv) {
  let debug = false;
  let emit = false;
  let layoutFile = null;
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') usage(0);
    else if (a === '--debug') debug = true;
    else if (a === '--emit-layout') emit = true;
    else if (a === '--layout') {
      layoutFile = argv[++i];
      if (!layoutFile) {
        process.stderr.write('Missing argument for --layout\n');
        usage(1);
      }
    } else if (a.startsWith('-')) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      usage(1);
    } else files.push(a);
  }
  if (files.length > 1) usage(1);

  let text;
  if (files.length === 1) {
    const fp = path.resolve(files[0]);
    text = fs.readFileSync(fp, 'utf8');
  } else {
    text = fs.readFileSync(0, 'utf8');
  }

  const options = {};
  if (layoutFile) {
    const layoutYaml = fs.readFileSync(path.resolve(layoutFile), 'utf8');
    options.layout = { policy: 'from-document', layoutDocument: layoutYaml };
  }

  try {
    if (emit) {
      // Seed from auto place; --layout is ignored for emit (fresh bootstrap seed).
      process.stdout.write(emitLayout(text));
      return;
    }
    if (debug) {
      const stages = debugStages(text, options);
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
        boxes: stages.plan.pages[0].boxes.map((b) => ({
          title: b.title,
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
        })),
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
