#!/usr/bin/env node
// Checks documentation/FEATURES-TECHNICAL.md against documentation/FEATURES.md (D-162), so every feature has its
// technical explanation and the two documents keep one structure. Fails when:
//   - the `## group` and `### feature` headings of the two documents differ (missing, extra, renamed or reordered);
//   - a technical section is empty, does not link to its feature (`FEATURES.md#<anchor>`), has no Mermaid graph
//     (a ```mermaid block) or has no `**Code:**` line;
//   - a path named on a `**Code:**` line does not exist in the repository.
// Usage: node scripts/check-features-technical.mjs [features.md] [features-technical.md]   (npm run lint:features)
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [featuresFile = 'documentation/FEATURES.md', technicalFile = 'documentation/FEATURES-TECHNICAL.md'] = process.argv.slice(2);

/** GitHub's heading anchor: lower case, punctuation dropped, spaces to hyphens. */
export function anchor(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** The `##` and `###` headings in order, each with its body (the lines up to the next heading). */
export function sections(markdown) {
  const result = [];
  let inFence = false;
  for (const [index, line] of markdown.split('\n').entries()) {
    if (line.startsWith('```')) inFence = !inFence;
    const match = !inFence && /^(#{2,3}) (.+)$/.exec(line);
    if (match) result.push({ level: match[1].length, title: match[2].trim(), line: index + 1, body: [] });
    else result.at(-1)?.body.push(line);
  }
  return result;
}

const label = (section) => `${'#'.repeat(section.level)} ${section.title}`;

export function checkFeaturesTechnical(features, technical, exists = (path) => existsSync(resolve(root, path))) {
  const errors = [];
  const wanted = sections(features);
  const found = sections(technical);
  const wantedLabels = wanted.map(label);
  const foundLabels = found.map(label);

  for (const [index, heading] of wantedLabels.entries())
    if (!foundLabels.includes(heading))
      errors.push(`${technicalFile}: "${heading}" (${featuresFile}:${wanted[index].line}) has no section`);
  for (const [index, heading] of foundLabels.entries())
    if (!wantedLabels.includes(heading))
      errors.push(`${technicalFile}:${found[index].line}: "${heading}" is not a heading of ${featuresFile}`);
  const common = (labels, other) => labels.filter((heading) => other.includes(heading));
  if (errors.length === 0 && common(wantedLabels, foundLabels).join('\n') !== common(foundLabels, wantedLabels).join('\n'))
    errors.push(`${technicalFile}: the sections are not in the order of ${featuresFile}`);

  for (const section of found) {
    if (section.level !== 3) continue;
    const where = `${technicalFile}:${section.line} (${section.title})`;
    const body = section.body.join('\n');
    if (!body.includes(`FEATURES.md#${anchor(section.title)}`))
      errors.push(`${where}: does not link to FEATURES.md#${anchor(section.title)}`);
    if (!section.body.some((line) => line.trim() === '```mermaid')) errors.push(`${where}: has no Mermaid graph`);
    const code = section.body.find((line) => line.startsWith('**Code:**'));
    if (!code) {
      errors.push(`${where}: has no **Code:** line`);
      continue;
    }
    let inFence = false;
    const prose = section.body.filter((line) => {
      if (line.startsWith('```')) inFence = !inFence;
      return !inFence && !line.startsWith('```') && line !== code && !line.includes('FEATURES.md#') && line.trim();
    });
    if (prose.length === 0) errors.push(`${where}: has no explanation`);
    for (const [, path] of code.matchAll(/`([^`]+)`/g)) if (!exists(path)) errors.push(`${where}: \`${path}\` does not exist`);
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = checkFeaturesTechnical(readFileSync(featuresFile, 'utf8'), readFileSync(technicalFile, 'utf8'));
  if (errors.length) {
    console.error(`Technical features (${technicalFile}):\n${errors.map((error) => `  - ${error}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`Technical features: ${technicalFile} matches ${featuresFile}.`);
}
