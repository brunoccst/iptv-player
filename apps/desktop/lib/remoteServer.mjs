// The computer as a sync hub (issue #268, DECISIONS.md#d-240): like the TV's remote server (PairingServer.kt, D-061),
// it listens on the home network on the first free port of a fixed range, at /remote. Each request body goes to the
// page, which opens it with a paired phone's key and answers (packages/shared/src/pairing/remote.ts).
import { createServer } from 'node:http';

/**
 * Starts the server on the first of `ports` that is free. `onRequest(body, reply)` gets each POST body to `path`;
 * `reply(status, body)` answers it (once; later calls do nothing). Unanswered requests get 504 after `answerTimeoutMs`.
 * Resolves with `{ port, close() }`; rejects when every port is taken.
 */
export async function startRemoteServer({ ports, path = '/remote', maxBody, answerTimeoutMs = 30_000, onRequest, host = '0.0.0.0' }) {
  const open = new Set();
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url?.split('?')[0] !== path) {
      response.writeHead(404).end();
      request.resume();
      return;
    }
    const length = Number(request.headers['content-length']);
    if (!(length > 0 && length <= maxBody)) {
      response.writeHead(413).end();
      request.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBody) request.destroy();
      else chunks.push(chunk);
    });
    request.on('end', () => {
      let done = false;
      const reply = (status, body = '') => {
        if (done) return;
        done = true;
        open.delete(reply);
        clearTimeout(timer);
        response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(body));
      };
      const timer = setTimeout(() => reply(504), answerTimeoutMs);
      open.add(reply);
      onRequest(Buffer.concat(chunks).toString('utf8'), reply);
    });
  });
  for (const port of ports) {
    const listening = await new Promise((resolve) => {
      const failed = () => resolve(false);
      server.once('error', failed);
      server.listen(port, host, () => {
        server.removeListener('error', failed);
        resolve(true);
      });
    });
    if (listening)
      return {
        port,
        close() {
          for (const reply of [...open]) reply(410);
          server.close();
        },
      };
  }
  throw new Error('Every port of the range is taken');
}
