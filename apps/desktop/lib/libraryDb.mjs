// The library database of the desktop app (D-121): SQLite built into Electron's Node, so the app carries no database
// library. The page sends SQL with parameters as JSON and gets rows back as JSON, the same two calls as the TV app's
// native module; all library logic is in @iptv/shared (sqlLibrary.ts).
import { availableParallelism } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

/** Opens `file` on first use. `run` and `query` take and give JSON text, like the TV app's `dbRun` and `dbQuery`. */
export function openLibraryDb(file) {
  let db = null;
  const open = () => {
    if (!db) {
      db = new DatabaseSync(file);
      db.exec('PRAGMA journal_mode = WAL');
      // For big library updates (D-134): safe with WAL (a power cut can lose the last commit, never the database), a
      // larger page cache, and helper threads for SQLite's sorts, one per core.
      db.exec('PRAGMA synchronous = NORMAL');
      db.exec('PRAGMA cache_size = -16384');
      db.exec(`PRAGMA threads = ${availableParallelism()}`);
    }
    return db;
  };
  return {
    /** `[{ sql, rows? }]`: each statement once per row of parameters (once without rows), all in one transaction. */
    run(statementsJson) {
      const statements = JSON.parse(statementsJson);
      const database = open();
      database.exec('BEGIN');
      try {
        for (const { sql, rows } of statements) {
          const statement = database.prepare(sql);
          for (const row of rows ?? [[]]) statement.run(...row);
        }
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    /** The rows as a JSON array of arrays. */
    query(sql, paramsJson) {
      const statement = open().prepare(sql);
      statement.setReturnArrays(true);
      return JSON.stringify(statement.all(...JSON.parse(paramsJson)));
    },
    close() {
      db?.close();
      db = null;
    },
  };
}
