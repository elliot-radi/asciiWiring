/**
 * Parse Markdown wiring documents → AstDocument.
 * See docs/SPEC.md, docs/ARCHITECTURE.md §3.1
 */

function parseDocument(text) {
  if (typeof text !== 'string') throw new Error('parseDocument expects a string');
  const rawLines = text.split(/\r?\n/);

  const table = extractTable(rawLines);
  if (!table) throw new Error('No Markdown table found');

  const { headers, body } = table;
  if (headers.length < 2) {
    throw new Error('Table needs a Signal column and at least one component column');
  }

  const signalHeader = headers[0].toLowerCase();
  if (signalHeader && !['signal', 'net', 'node'].includes(signalHeader)) {
    // Allow custom first headers with a warning-level note later; v1 accepts common names.
  }

  const components = headers.slice(1).map((h) => h.trim());
  if (components.some((c) => !c)) {
    throw new Error('Empty component header');
  }

  const nets = [];
  const seen = new Set();
  for (const cells of body) {
    const padded = [...cells];
    while (padded.length < headers.length) padded.push('');
    const rawName = (padded[0] || '').trim();
    if (!rawName) continue;

    const floating = rawName.startsWith('°');
    const name = floating ? rawName.slice(1).trim() : rawName;
    if (!name) continue;
    if (seen.has(name)) {
      throw new Error(`Duplicate net name: ${name}`);
    }
    seen.add(name);

    const compCells = padded.slice(1, 1 + components.length).map((c) => {
      const t = (c || '').trim();
      return t === '' ? null : t;
    });

    nets.push({ rawName, name, floating, cells: compCells });
  }

  const abbreviations = parseAbbreviations(rawLines);

  return {
    components,
    nets,
    abbreviations,
    sourceHints: { startLine: table.startLine, endLine: table.endLine },
  };
}

function extractTable(rawLines) {
  let start = -1;
  let end = -1;
  for (let i = 0; i < rawLines.length; i++) {
    const t = rawLines[i].trim();
    if (t.startsWith('|') && t.endsWith('|')) {
      if (start < 0) start = i;
      end = i;
    } else if (start >= 0) {
      break; // first contiguous table only (v1)
    }
  }
  if (start < 0) return null;

  const rows = [];
  for (let i = start; i <= end; i++) {
    const line = rawLines[i].trim();
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    rows.push(cells);
  }
  if (rows.length < 2) throw new Error('Table needs header + separator/data');

  const headers = rows[0];
  let dataStart = 1;
  if (rows[1] && rows[1].every((c) => /^[-:\s]+$/.test(c))) {
    dataStart = 2;
  }
  return {
    headers,
    body: rows.slice(dataStart),
    startLine: start,
    endLine: end,
  };
}

function parseAbbreviations(rawLines) {
  const out = {};
  let i = rawLines.findIndex((l) => l.trim().toLowerCase() === 'abbreviations:');
  if (i < 0) return out;
  for (i += 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line.trim()) {
      // allow blank lines inside block
      continue;
    }
    const m = line.match(/^\s*(\S+)\s*≝\s*"(.+)"\s*$/);
    if (m) out[m[1]] = m[2];
    else if (/^\s*\|/.test(line)) break; // next table
    else if (/^[A-Za-z]/.test(line.trim()) && !line.includes('≝')) break;
  }
  return out;
}

module.exports = { parseDocument };
