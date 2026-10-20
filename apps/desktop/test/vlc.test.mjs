import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { freePort, parseVlcStatus, readVlcStatus, watchVlc } from '../lib/vlc.mjs';

test("reads VLC's time and length, nothing while it has no length (issue #265)", () => {
  assert.deepEqual(parseVlcStatus('{"time":125,"length":5400,"state":"playing"}'), { position: 125, duration: 5400 });
  assert.deepEqual(parseVlcStatus('{"time":5500,"length":5400}'), { position: 5400, duration: 5400 });
  assert.equal(parseVlcStatus('{"time":0,"length":0,"state":"stopped"}'), null);
  assert.equal(parseVlcStatus('{"time":-1,"length":5400}'), null);
  assert.equal(parseVlcStatus('<html>'), null);
});

test('asks the web interface with the password, nothing when it refuses', async () => {
  const port = await freePort();
  const server = createServer((request, response) => {
    const ok = request.headers.authorization === `Basic ${Buffer.from(':secret').toString('base64')}`;
    response.writeHead(ok && request.url === '/requests/status.json' ? 200 : 401).end('{"time":60,"length":3600}');
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  try {
    assert.deepEqual(await readVlcStatus({ port, password: 'secret' }), { position: 60, duration: 3600 });
    assert.equal(await readVlcStatus({ port, password: 'wrong' }), null);
  } finally {
    server.close();
  }
  assert.equal(await readVlcStatus({ port, password: 'secret' }), null);
});

test('reports while VLC plays and once more when it closes', async () => {
  const child = new EventEmitter();
  const statuses = [null, { position: 10, duration: 3600 }, { position: 40, duration: 3600 }, { position: 75, duration: 3600 }, null];
  let tick = null;
  let cleared = false;
  const reports = [];
  watchVlc(child, { port: 1, password: 'x' }, (progress) => reports.push(progress), {
    read: async () => statuses.shift() ?? null,
    setTimer: (fn) => (tick = fn),
    clearTimer: () => (cleared = true),
  });
  for (let i = 0; i < 5; i++) await tick();
  // The first time, then only after a minute of playback.
  assert.deepEqual(reports, [
    { position: 10, duration: 3600, ended: false },
    { position: 75, duration: 3600, ended: false },
  ]);
  child.emit('exit', 0);
  assert.equal(cleared, true);
  assert.deepEqual(reports.at(-1), { position: 75, duration: 3600, ended: true });
  child.emit('error', new Error('late'));
  assert.equal(reports.length, 3);
});

test('reports nothing when VLC closes before playing', () => {
  const child = new EventEmitter();
  const reports = [];
  watchVlc(child, { port: 1, password: 'x' }, (progress) => reports.push(progress), { setTimer: () => 0, clearTimer: () => {} });
  child.emit('exit', 1);
  assert.deepEqual(reports, []);
});
