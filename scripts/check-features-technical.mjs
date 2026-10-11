#!/usr/bin/env node
// Checks documentation/FEATURES.md and its code index documentation/FEATURES-TECHNICAL.md (D-079, D-143). Fails when:
//   - a `### feature` of FEATURES.md has no `**Apps:**` line marking TV, Phone and Desktop with ✅ (has it),
//     ➖ (does not apply) or ⏳ (missing), or marks one ⏳ without naming the GitHub issue that adds it (`#123`);
//   - the `## group` headings and feature rows of the index differ from FEATURES.md (missing, extra, renamed or
//     reordered), or a row does not link to its feature (`FEATURES.md#<anchor>`) or names no code path;
//   - a code path in the index does not exist in the repository.
// Usage: node scripts/check-features-technical.mjs [features.md] [features-technical.md]   (npm run lint:features)
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [featuresFile = 'documentation/FEATURES.md', technicalFile = 'documentation/FEATURES-TECHNICAL.md'] = process.argv.slice(2);
const APPS = ['TV', 'Phone', 'Desktop'];
const MARKS = ['✅', '➖', '⏳'];

/** GitHub's heading anchor: lower case, punctuation dropped, spaces to hyphens. */
export function anchor(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** FEATURES.md's `##` groups and `###` features in order, each feature with its body lines. */
export function featureHeadings(markdown) {
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

/** The index's `##` groups and feature rows (`| [Title](FEATURES.md#anchor) | paths |`) in order. */
export function indexEntries(markdown) {
  const result = [];
  for (const [index, line] of markdown.split('\n').entries()) {
    const group = /^## (.+)$/.exec(line);
    if (group) result.push({ level: 2, title: group[1].trim(), line: index + 1 });
    const row = /^\| \[(.+?)\]\(([^)]*)\) \|(.*)\|\s*$/.exec(line);
    if (row) result.push({ level: 3, title: row[1].trim(), link: row[2], code: row[3], line: index + 1 });
  }
  return result;
}

const label = (entry) => `${'#'.repeat(entry.level)} ${entry.title}`;

export function checkAppsLines(features) {
  const errors = [];
  for (const section of featureHeadings(features)) {
    if (section.level !== 3) continue;
    const where = `${featuresFile}:${section.line} (${section.title})`;
    const apps = section.body.find((line) => line.startsWith('**Apps:**'));
    if (!apps) {
      errors.push(`${where}: has no **Apps:** line`);
      continue;
    }
    const marks = APPS.map((app) => new RegExp(`\\b${app} (${MARKS.join('|')})`).exec(apps)?.[1]);
    APPS.forEach((app, index) => {
      if (!marks[index]) errors.push(`${where}: **Apps:** does not mark ${app} with ✅, ➖ or ⏳`);
    });
    if (marks.includes('⏳') && !/#\d+/.test(apps)) errors.push(`${where}: an app is ⏳ but **Apps:** names no issue (#…)`);
  }
  return errors;
}

export function checkFeaturesTechnical(features, technical, exists = (path) => existsSync(resolve(root, path))) {
  const errors = checkAppsLines(features);
  const wanted = featureHeadings(features);
  const found = indexEntries(technical);
  const wantedLabels = wanted.map(label);
  const foundLabels = found.map(label);

  for (const [index, heading] of wantedLabels.entries())
    if (!foundLabels.includes(heading)) errors.push(`${technicalFile}: "${heading}" (${featuresFile}:${wanted[index].line}) has no entry`);
  for (const [index, heading] of foundLabels.entries())
    if (!wantedLabels.includes(heading))
      errors.push(`${technicalFile}:${found[index].line}: "${heading}" is not a heading of ${featuresFile}`);
  const common = (labels, other) => labels.filter((heading) => other.includes(heading));
  if (common(wantedLabels, foundLabels).join('\n') !== common(foundLabels, wantedLabels).join('\n'))
    errors.push(`${technicalFile}: the entries are not in the order of ${featuresFile}`);

  for (const entry of found) {
    if (entry.level !== 3) continue;
    const where = `${technicalFile}:${entry.line} (${entry.title})`;
    if (entry.link !== `FEATURES.md#${anchor(entry.title)}`) errors.push(`${where}: does not link to FEATURES.md#${anchor(entry.title)}`);
    const paths = [...entry.code.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    if (paths.length === 0) errors.push(`${where}: names no code path`);
    for (const path of paths) if (!exists(path)) errors.push(`${where}: \`${path}\` does not exist`);
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = checkFeaturesTechnical(readFileSync(featuresFile, 'utf8'), readFileSync(technicalFile, 'utf8'));
  if (errors.length) {
    console.error(`Features (${featuresFile}, ${technicalFile}):\n${errors.map((error) => `  - ${error}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`Features: every feature marks its apps, and ${technicalFile} indexes them all.`);
}
