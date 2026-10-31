import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { startRemoteServer } from '../lib/remoteServer.mjs';

const post = async (port, path, body) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', body });
  return { status: response.status, body: await response.text() };
};

test('takes the first free port of the range and hands each request to the page (issue #268)', async () => {
  const taken = createServer();
  await new Promise((resolve) => taken.listen(0, '127.0.0.1', resolve));
  const busy = taken.address().port;
  const seen = [];
  const remote = await startRemoteServer({
    ports: [busy, busy + 1, busy + 2],
    host: '127.0.0.1',
    maxBody: 100,
    onRequest: (body, reply) => {
      seen.push(body);
      reply(200, `got ${body}`);
      reply(500, 'twice');
    },
  });
  try {
    assert.notEqual(remote.port, busy);
    assert.deepEqual(await post(remote.port, '/remote', 'hello'), { status: 200, body: 'got hello' });
    assert.equal((await post(remote.port, '/pair', 'hello')).status, 404);
    assert.equal((await post(remote.port, '/remote', 'x'.repeat(101))).status, 413);
    assert.deepEqual(seen, ['hello']);
  } finally {
    remote.close();
    taken.close();
  }
});

test('answers 504 when the page does not, and 410 to what is open when it stops', async () => {
  let remote;
  remote = await startRemoteServer({ ports: [38190, 38191], host: '127.0.0.1', maxBody: 100, answerTimeoutMs: 50, onRequest: () => {} });
  try {
    assert.equal((await post(remote.port, '/remote', 'late')).status, 504);
  } finally {
    remote.close();
  }
  const closing = await startRemoteServer({
    ports: [38192, 38193],
    host: '127.0.0.1',
    maxBody: 100,
    onRequest: () => setTimeout(() => closing.close(), 10),
  });
  assert.equal((await post(closing.port, '/remote', 'bye')).status, 410);
});
