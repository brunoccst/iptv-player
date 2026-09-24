import type { ApiClient } from '../api/apiClient';
import type { ConnectionStore } from '../stores/connectionStore';

type AnyFunction = (...args: never[]) => unknown;

/** Same shape as `ApiClient`; every call goes to the direct or the server client, per the saved connection (D-038). */
export function createHybridApiClient({
  server,
  direct,
  connection,
}: {
  server: ApiClient;
  direct: ApiClient;
  connection: ConnectionStore;
}): ApiClient {
  const pick = async () => {
    await connection.getState().load();
    return connection.getState().mode === 'server' ? server : direct;
  };

  const wrap = (path: string[], shape: object): object =>
    Object.fromEntries(
      Object.entries(shape).map(([key, value]) => [
        key,
        typeof value === 'function'
          ? async (...args: never[]) => {
              let target: unknown = await pick();
              for (const segment of [...path, key]) target = (target as Record<string, unknown>)[segment];
              return (target as AnyFunction)(...args);
            }
          : wrap([...path, key], value as object),
      ]),
    );

  return wrap([], server) as ApiClient;
}
