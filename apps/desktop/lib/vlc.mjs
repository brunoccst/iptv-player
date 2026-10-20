// Where VLC stops becomes the title's progress (issue #265, DECISIONS.md#d-191): VLC runs with its web interface on a
// local port and a random password; the app asks it every few seconds for the time and length while it plays and
// hands the last ones to the page when VLC closes (and now and then while it plays, in case the app closes first).
import { randomBytes } from 'node:crypto';
import { createServer, request } from 'node:http';

const POLL_MS = 3_000;
/** While VLC plays, the page also saves every this many seconds of playback. */
const SAVE_EVERY_SECONDS = 60;

/** A free local port for VLC's web interface. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Port and password for one VLC. */
export async function vlcControl() {
  return { port: await freePort(), password: randomBytes(18).toString('base64url') };
}

/** Time and length (seconds) from VLC's `/requests/status.json`; null while nothing plays or the length is unknown. */
export function parseVlcStatus(text) {
  let status;
  try {
    status = JSON.parse(text);
  } catch {
    return null;
  }
  const time = Number(status?.time);
  const length = Number(status?.length);
  if (!Number.isFinite(time) || !Number.isFinite(length) || length <= 0 || time < 0) return null;
  return { position: Math.min(time, length), duration: length };
}

/** Asks VLC's web interface for its status; null when it does not answer. */
export function readVlcStatus({ port, password }) {
  return new Promise((resolve) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path: '/requests/status.json',
        headers: { Authorization: `Basic ${Buffer.from(`:${password}`).toString('base64')}` },
        timeout: 2_000,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => resolve(response.statusCode === 200 ? parseVlcStatus(body) : null));
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
    req.end();
  });
}

/**
 * Follows one VLC process: `report({ position, duration, ended })` with the latest time it played, every
 * SAVE_EVERY_SECONDS of playback and once when VLC closes (`ended`). `read` and the timers are for tests.
 */
export function watchVlc(
  child,
  control,
  report,
  { read = readVlcStatus, setTimer = setInterval, clearTimer = clearInterval, pollMs = POLL_MS } = {},
) {
  let last = null;
  let reported = null;
  let polling = false;
  const timer = setTimer(async () => {
    if (polling) return;
    polling = true;
    const status = await read(control);
    polling = false;
    if (!status) return;
    last = status;
    if (reported === null || Math.abs(status.position - reported) >= SAVE_EVERY_SECONDS) {
      reported = status.position;
      report({ ...status, ended: false });
    }
  }, pollMs);
  const done = () => {
    clearTimer(timer);
    if (last) report({ ...last, ended: true });
    last = null;
  };
  child.once('exit', done);
  child.once('error', done);
}
