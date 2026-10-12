import { t } from '../i18n/i18n';

/**
 * The account's connection limit (issue #242, D-175): providers refuse a stream beyond `max_connections`, often with
 * a cryptic error, so the players ask the provider how many are in use before they open one, and warn when it is full.
 * The desktop timeline preview opens a second connection, so it only runs where the account has one to spare (issue #218).
 */

/** Streams the provider counts for this account right now (`active_cons`) and how many it allows. */
export interface ConnectionUse {
  active: number;
  max: number;
}

/** After the app closes its own stream, the provider can go on counting it for a while. */
export const OWN_STREAM_GRACE_MS = 60_000;
/** The check never holds a stream back longer than this; no answer means no warning. */
export const CONNECTION_CHECK_TIMEOUT_MS = 3000;

let enabled = true;
let open = 0;
let lastClosedAt = -Infinity;
/** The last check's count, taken before the app's own stream opened. */
let measured: ConnectionUse | null = null;

/** A player holds this while it streams from the provider (not a download); call the result when the stream closes. */
export function holdStreamConnection(now: () => number = Date.now): () => void {
  open++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    open--;
    lastClosedAt = now();
  };
}

/**
 * False while the app streams or has just stopped: the provider still counts that stream as in use, so zapping and the
 * next episode would warn about the app's own connection.
 */
export function connectionCheckNeeded(now = Date.now()): boolean {
  return enabled && open === 0 && now - lastClosedAt >= OWN_STREAM_GRACE_MS;
}

/**
 * Asks the provider (`read`) how many connections are in use. Resolves with them when the account is full (the
 * player warns), else null; an error, a missing count or no answer within `CONNECTION_CHECK_TIMEOUT_MS` is null too.
 */
export async function checkConnectionLimit(
  read: (signal: AbortSignal) => Promise<{ active: number | null; max: number | null }>,
  timeoutMs = CONNECTION_CHECK_TIMEOUT_MS,
): Promise<ConnectionUse | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  try {
    const asked = Promise.resolve()
      .then(() => read(controller.signal))
      .catch(() => null);
    const use = await Promise.race([asked, timeout]);
    if (!use || use.active === null || use.max === null || use.max <= 0) return null;
    measured = { active: use.active, max: use.max };
    return use.active >= use.max ? measured : null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether a second connection for a preview fits (issue #218): the account allows two or more, and the last check left room
 * for both the player's stream and the preview. `maxConnections` null (not reported) keeps previews on.
 */
export function spareConnection(maxConnections: number | null): boolean {
  if (maxConnections === null) return true;
  if (maxConnections < 2) return false;
  return !measured || measured.max !== maxConnections || measured.active + 2 <= maxConnections;
}

/** What the players say when the account is full. */
export function connectionLimitMessage(use: ConnectionUse): string {
  return t(
    'Your provider says {active} of the {max} streams your account allows are in use, probably on another device. Starting this one may be refused or stop the other one.',
    { active: use.active, max: use.max },
  );
}

/** Tests only: forgets streams and counts; `checks` false turns the check off (app tests that are not about it). */
export function resetConnectionLimit(checks = true) {
  enabled = checks;
  open = 0;
  lastClosedAt = -Infinity;
  measured = null;
}
