import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { openLibraryDb } from '../lib/libraryDb.mjs';

test('the library database runs statements in one transaction and answers rows as JSON (D-121)', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'iptv-db-'));
  try {
    const file = path.join(folder, 'library.db');
    const db = openLibraryDb(file);
    db.run(
      JSON.stringify([
        { sql: 'CREATE TABLE t (id INTEGER, name TEXT, rating REAL)' },
        {
          sql: 'INSERT INTO t (id, name, rating) VALUES (?, ?, ?)',
          rows: [
            [1, 'Über \\ "quoted"', 7.5],
            [2, 'war 😀', null],
          ],
        },
      ]),
    );
    // Numbers stay numbers (LIMIT needs an integer); text keeps every character.
    assert.deepEqual(JSON.parse(db.query('SELECT id, name, rating FROM t WHERE id > ? ORDER BY id LIMIT ?', '[0, 5]')), [
      [1, 'Über \\ "quoted"', 7.5],
      [2, 'war 😀', null],
    ]);

    // A failing statement undoes the whole call.
    assert.throws(() =>
      db.run(JSON.stringify([{ sql: 'INSERT INTO t (id) VALUES (?)', rows: [[3]] }, { sql: 'INSERT INTO missing VALUES (1)' }])),
    );
    assert.deepEqual(JSON.parse(db.query('SELECT COUNT(*) FROM t', '[]')), [[2]]);

    // Saved in the file: a new start finds it.
    db.close();
    const reopened = openLibraryDb(file);
    assert.deepEqual(JSON.parse(reopened.query('SELECT name FROM t WHERE id = ?', '[2]')), [['war 😀']]);
    reopened.close();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
