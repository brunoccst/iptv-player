#!/usr/bin/env node
// Checks the app's translations (DECISIONS.md#d-084). English is the source: every `t('…')` / `tn('…', '…', n)` call's
// English text is a key of each catalog in packages/shared/src/i18n/catalogs. Fails when:
//   - `t`/`tn` gets anything but string literals as its text (the text could not be found here);
//   - `t`/`tn` runs when a module loads (outside any function), where a language change would not reach it;
//   - a catalog misses a text, has an empty one, or keeps one no code uses any more;
//   - a translation uses a {placeholder} the English text does not have, or a plural lacks a form the language needs.
// Usage: node scripts/check-i18n.mjs [--write]   (npm run lint:i18n)
// --write adds missing texts to every catalog (empty, to translate), drops unused ones and sorts them.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

export const SOURCE_DIRS = ['apps/tv-app/src', 'apps/web-player/src', 'packages/shared/src'];
export const CATALOG_DIR = 'packages/shared/src/i18n/catalogs';
/** Plural forms each language's catalog must give for `tn` texts. */
export const PLURAL_FORMS = { 'pt-BR': ['one', 'other'], de: ['one', 'other'], 'sh-BA': ['one', 'few', 'other'] };

const isSource = (name) => /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts');

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'testing') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (isSource(entry.name)) yield path;
  }
}

const placeholders = (text) => new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]));
const isText = (node) => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));
const insideFunction = (node) => {
  for (let parent = node.parent; parent; parent = parent.parent) if (ts.isFunctionLike(parent) || ts.isClassElement(parent)) return true;
  return false;
};

/** The texts `t`/`tn` calls use in one file: `{ key, other?, where }`, and the problems found. */
export function extractTexts(code, file = 'file.tsx') {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const texts = [];
  const errors = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && (node.expression.text === 't' || node.expression.text === 'tn')) {
      const plural = node.expression.text === 'tn';
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const where = `${file}:${line}`;
      const [first, second] = node.arguments;
      if (!isText(first) || (plural && !isText(second))) errors.push(`${where}: ${node.expression.text}() needs its English text as a string literal`);
      else texts.push({ key: first.text, other: plural ? second.text : undefined, where });
      if (!insideFunction(node)) errors.push(`${where}: ${node.expression.text}() runs when the module loads; call it while drawing`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { texts, errors };
}

/** Compares the texts with one catalog. */
export function checkCatalog(language, catalog, texts) {
  const errors = [];
  const used = new Map();
  for (const text of texts) if (!used.has(text.key)) used.set(text.key, text);
  for (const [key, text] of used) {
    const entry = catalog[key];
    const allowed = new Set([...placeholders(key), ...(text.other !== undefined ? placeholders(text.other) : []), ...(text.other !== undefined ? ['count'] : [])]);
    if (entry === undefined) {
      errors.push(`${language}: missing "${key}" (${text.where})`);
      continue;
    }
    const values = text.other !== undefined ? (typeof entry === 'object' && entry ? entry : null) : typeof entry === 'string' ? { text: entry } : null;
    if (!values) {
      errors.push(`${language}: "${key}" must be ${text.other !== undefined ? 'plural forms {one, …, other}' : 'a text'}`);
      continue;
    }
    const forms = text.other !== undefined ? PLURAL_FORMS[language] ?? ['one', 'other'] : ['text'];
    for (const form of forms) if (!values[form]) errors.push(`${language}: "${key}" has no ${form === 'text' ? 'translation' : `"${form}" form`}`);
    for (const value of Object.values(values))
      for (const name of placeholders(String(value))) if (!allowed.has(name)) errors.push(`${language}: "${key}" uses {${name}}, which the English text does not have`);
  }
  for (const key of Object.keys(catalog)) if (!used.has(key)) errors.push(`${language}: "${key}" is not used any more`);
  return errors;
}

export function collect(root = '.') {
  const texts = [];
  const errors = [];
  for (const dir of SOURCE_DIRS)
    for (const path of walk(join(root, dir))) {
      const result = extractTexts(readFileSync(path, 'utf8'), relative(root, path));
      texts.push(...result.texts);
      errors.push(...result.errors);
    }
  return { texts, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const write = process.argv.includes('--write');
  const { texts, errors } = collect();
  for (const language of Object.keys(PLURAL_FORMS)) {
    const file = join(CATALOG_DIR, `${language}.json`);
    const catalog = JSON.parse(readFileSync(file, 'utf8'));
    if (write) {
      const next = {};
      const keys = [...new Set(texts.map((text) => text.key))].sort((a, b) => a.localeCompare(b, 'en'));
      for (const key of keys) {
        const plural = texts.find((text) => text.key === key).other !== undefined;
        next[key] = catalog[key] ?? (plural ? Object.fromEntries(PLURAL_FORMS[language].map((form) => [form, ''])) : '');
      }
      writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
      console.log(`${file}: ${keys.length} texts, ${keys.filter((key) => !next[key]).length} to translate.`);
      continue;
    }
    errors.push(...checkCatalog(language, catalog, texts));
  }
  if (write) process.exit(errors.length ? 1 : 0);
  if (errors.length) {
    console.error(`Translations (${errors.length} problems):\n${errors.map((error) => `  - ${error}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`Translations: ${new Set(texts.map((text) => text.key)).size} texts, every catalog complete.`);
}
