#!/usr/bin/env node
/**
 * CLI: node src/render.js [--debug] [--layout file.yaml] [file.md]
 * Reads Markdown wiring table; writes ASCII art to stdout.
 */

const fs = require('fs');
const path = require('path');
const { render, debugStages } = require('./index');

function usage(code = 1) {
  const msg = `Usage: node src/render.js [--debug] [--layout file.yaml] [file.md]

  Reads a Markdown wiring table and prints ASCII art.
  With no file, reads stdin.
  --debug  print stage summaries as JSON on stderr; art still on stdout
  --layout file.yaml  use hand-edited layout sidecar for placement
`;
  process.stderr.write(msg);
  process.exit(code);
}

function main(argv) {
  let debug = false;
  let layoutFile = null;
  const files = [];
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--help' || a === '-h') usage(0);
    else if (a === '--debug') {
      debug = true;
      i++;
    } else if (a === '--layout') {
      layoutFile = argv[i + 1];
      i += 2;
    } else if (a.startsWith('-')) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      usage(1);
    } else {
      files.push(a);
      i++;
    }
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
    options.layout = { file: path.resolve(layoutFile) };
  }

  try {
    if (debug) {
      const stages = debugStages(text);
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
