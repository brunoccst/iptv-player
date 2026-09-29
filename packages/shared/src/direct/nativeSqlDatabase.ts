import type { SqlDatabase, SqlValue } from './sqlLibrary';

/**
 * JSON text with every UTF-16 surrogate written as an escape: Expo hands text to native code as modified UTF-8, which
 * garbles characters outside the BMP (emoji). Surrogates only occur inside JSON strings, where escapes are valid.
 */
const surrogatesEscaped = (json: string) =>
  json.replace(/[\uD800-\uDFFF]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);

/**
 * `SqlDatabase` over calls that take and give JSON (D-121): TV/phone `TvMedia.dbRun` and `dbQuery` (Android's SQLite),
 * desktop `iptvDesktop.db` (SQLite in Electron's main process).
 */
export function createNativeSqlDatabase(native: {
  run(statements: string): Promise<void>;
  query(sql: string, params: string): Promise<string>;
}): SqlDatabase {
  return {
    run: (statements) => native.run(surrogatesEscaped(JSON.stringify(statements))),
    query: async (sql, params = []) => JSON.parse(await native.query(sql, surrogatesEscaped(JSON.stringify(params)))) as SqlValue[][],
  };
}
