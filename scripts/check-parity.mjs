#!/usr/bin/env node
// Checks documentation/PARITY.md against the backlog (DECISIONS.md#d-080), so a feature missing from one app is never
// forgotten. Fails when:
//   - a table row has an app cell without ✅ (has it), ➖ (does not apply) or ⏳ (missing);
//   - a row marks an app ⏳ without naming an open backlog item "Parity: …" (in the row, as "Parity: <title>");
//   - that backlog item is not an open item (`- [ ] **Parity: <title>**`) in documentation/NEXT-STEPS.md;
//   - an open "Parity: …" backlog item is not named in any row (done items move to Done, or the table is stale).
// Usage: node scripts/check-parity.mjs [parity.md] [next-steps.md]   (npm run lint:parity)
import { readFileSync } from 'node:fs';

const [parityFile = 'documentation/PARITY.md', backlogFile = 'documentation/NEXT-STEPS.md'] = process.argv.slice(2);
const MARKS = ['✅', '➖', '⏳'];
/** Columns holding an app (after the first, the row's name): the header cells naming TV, phone, web. */
const APP_HEADER = /^(TV|Phone|Web)\b/;

export function checkParity(parity, backlog) {
  const errors = [];
  const open = new Set([...backlog.matchAll(/^- \[ \] \*\*Parity: ([^*]+)\*\*/gm)].map((match) => match[1].trim().toLowerCase()));
  const named = new Set();
  let appColumns = null;
  let table = '';

  for (const [index, line] of parity.split('\n').entries()) {
    if (line.startsWith('## ')) table = line.slice(3).trim();
    if (!line.startsWith('|')) {
      appColumns = null;
      continue;
    }
    const cells = line
      .slice(1, line.endsWith('|') ? -1 : undefined)
      .split('|')
      .map((cell) => cell.trim());
    if (cells.every((cell) => /^-+$/.test(cell))) continue;
    if (!appColumns) {
      // Header row: remember which columns are apps.
      appColumns = cells.flatMap((cell, column) => (APP_HEADER.test(cell) ? [column] : []));
      continue;
    }
    // The Looks table describes how things look, not whether an app has them.
    if (table === 'Looks') continue;
    const where = `${parityFile}:${index + 1} (${cells[0]})`;
    for (const column of appColumns) {
      const cell = cells[column] ?? '';
      if (!MARKS.some((mark) => cell.includes(mark))) errors.push(`${where}: column ${column + 1} has no ✅, ➖ or ⏳`);
    }
    const references = [...line.matchAll(/Parity: ([^|)\]]+?)(?=\s*(?:\||\)|\]|$))/g)].map((match) => match[1].trim().toLowerCase());
    references.forEach((title) => named.add(title));
    if (appColumns.some((column) => (cells[column] ?? '').includes('⏳'))) {
      if (references.length === 0) errors.push(`${where}: an app is marked ⏳ but the row names no backlog item "Parity: …"`);
      for (const title of references)
        if (!open.has(title)) errors.push(`${where}: "Parity: ${title}" is not an open item in ${backlogFile}`);
    }
  }
  for (const title of open)
    if (!named.has(title)) errors.push(`${backlogFile}: open item "Parity: ${title}" is not named in ${parityFile}`);
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = checkParity(readFileSync(parityFile, 'utf8'), readFileSync(backlogFile, 'utf8'));
  if (errors.length) {
    console.error(`App parity (${parityFile}):\n${errors.map((error) => `  - ${error}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`App parity: ${parityFile} and the backlog agree.`);
}
