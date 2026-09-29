import { DatabaseSync } from 'node:sqlite';
import type { SqlDatabase, SqlValue } from '../direct/sqlLibrary';

/** `SqlDatabase` on Node's built-in SQLite, for tests (the apps use Android's through native code, D-121). */
export function createNodeSqlDatabase(path = ':memory:'): SqlDatabase & { close(): void } {
  const db = new DatabaseSync(path);
  return {
    async run(statements) {
      db.exec('BEGIN');
      try {
        for (const { sql, rows } of statements) {
          const statement = db.prepare(sql);
          for (const row of rows ?? [[]]) statement.run(...row);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async query(sql, params = []) {
      const statement = db.prepare(sql);
      statement.setReturnArrays(true);
      return statement.all(...params) as unknown as SqlValue[][];
    },
    close: () => db.close(),
  };
}
