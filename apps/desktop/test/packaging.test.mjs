import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';

// electron-builder packs only `dependencies` into the installed app, never `devDependencies`: a package the app
// imports but lists as a dev dependency works with `npm start` and fails on start once installed (FFmpeg did).
const here = (file) => new URL(`../${file}`, import.meta.url);
const pkg = JSON.parse(readFileSync(here('package.json'), 'utf8'));
const appFiles = [
  'main.mjs',
  'app.mjs',
  'rescue.mjs',
  'preload.cjs',
  'rescue-preload.cjs',
  ...readdirSync(here('lib'))
    .filter((f) => /\.[cm]?js$/.test(f))
    .map((f) => `lib/${f}`),
];

const packagesImported = (source) => {
  const names = new Set();
  for (const [, spec] of source.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)) {
    if (spec.startsWith('.') || spec.startsWith('node:') || builtinModules.includes(spec)) continue;
    names.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
  }
  return names;
};

test('every package the app imports goes into the installer', () => {
  for (const file of appFiles) {
    for (const name of packagesImported(readFileSync(here(file), 'utf8'))) {
      if (name === 'electron') continue; // Electron itself runs the app.
      assert.ok(pkg.dependencies?.[name], `${file} imports '${name}': move it to "dependencies" in package.json`);
    }
  }
});

test('the check finds imports', () => {
  assert.deepEqual(
    [
      ...packagesImported(
        "import a from 'ffmpeg-static';\nimport { b } from \"@scope/pkg/sub\";\nimport './x.mjs';\nconst c = require('node:fs');",
      ),
    ],
    ['ffmpeg-static', '@scope/pkg'],
  );
});

// A file the starter, the app or the rescue window loads that electron-builder leaves out of the installer breaks the
// installed app (D-251): `files` in electron-builder.config.cjs must name every one.
test('every file the app loads is in the installer', () => {
  const config = readFileSync(here('electron-builder.config.cjs'), 'utf8');
  const listed = [...(/files:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const covered = (file) =>
    listed.some((pattern) => pattern === file || (pattern.endsWith('/**') && file.startsWith(pattern.slice(0, -2))));
  assert.ok(listed.includes('main.mjs'), 'main.mjs is in files');
  for (const file of appFiles) assert.ok(covered(file), `${file} is not in "files" of electron-builder.config.cjs`);
  for (const file of appFiles.filter((f) => f.endsWith('.mjs') || f.endsWith('.cjs'))) {
    for (const [, spec] of readFileSync(here(file), 'utf8').matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](\.[^'"]+)['"]/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      assert.ok(covered(target), `${file} loads ${spec}, which is not in "files"`);
    }
  }
});

test('the starter imports nothing but Electron, so it cannot break before the rescue window can open', () => {
  const starter = readFileSync(here('main.mjs'), 'utf8');
  const staticImports = [...starter.matchAll(/^import\s.*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.deepEqual(staticImports, ['electron']);
  assert.match(starter, /import\(['"]\.\/app\.mjs['"]\)/);
  assert.match(starter, /import\(['"]\.\/rescue\.mjs['"]\)/);
});

test('the rescue window depends on Electron and Node only', () => {
  for (const file of ['rescue.mjs', 'rescue-preload.cjs']) {
    const source = readFileSync(here(file), 'utf8');
    for (const [, spec] of source.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)) {
      assert.ok(spec === 'electron' || spec === 'electron-updater' || spec.startsWith('node:'), `${file} imports ${spec}`);
    }
  }
});
