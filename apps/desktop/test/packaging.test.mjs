import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { test } from 'node:test';

// electron-builder packs only `dependencies` into the installed app, never `devDependencies`: a package the app
// imports but lists as a dev dependency works with `npm start` and fails on start once installed (FFmpeg did).
const here = (file) => new URL(`../${file}`, import.meta.url);
const pkg = JSON.parse(readFileSync(here('package.json'), 'utf8'));
const appFiles = [
  'main.mjs',
  'preload.cjs',
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
