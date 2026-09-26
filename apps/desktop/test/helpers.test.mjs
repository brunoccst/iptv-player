import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { asPlayer, contentType, isNewer, keyFile, releaseVersion, staticFile, withCors } from '../lib/helpers.mjs';

const root = path.resolve('/app/web');

test('serves only files inside the web folder', () => {
  assert.equal(staticFile(root, '/'), path.join(root, 'index.html'));
  assert.equal(staticFile(root, '/assets/app.js?v=1'), path.join(root, 'assets', 'app.js'));
  assert.equal(staticFile(root, '/a%20b.png'), path.join(root, 'a b.png'));
  assert.equal(staticFile(root, '/../secret.txt'), path.join(root, 'secret.txt'));
  assert.equal(staticFile(root, '/%2e%2e/%2e%2e/etc/passwd'), path.join(root, 'etc', 'passwd'));
  assert.equal(staticFile(root, '/..%2f..%2fetc%2fpasswd'), null);
  assert.equal(staticFile(root, '/%E0%A4%A'), null);
  assert.equal(contentType('x/index.html'), 'text/html; charset=utf-8');
  assert.equal(contentType('sw.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentType('movie.bin'), 'application/octet-stream');
});

test('lets the app read provider answers and sends them as a player', () => {
  const origin = 'http://127.0.0.1:47831';
  assert.deepEqual(withCors({ 'Content-Type': ['video/mp2t'], 'access-control-allow-origin': ['https://x'] }, origin), {
    'Content-Type': ['video/mp2t'],
    'Access-Control-Allow-Origin': [origin],
    'Access-Control-Allow-Methods': ['GET, HEAD, OPTIONS'],
    'Access-Control-Allow-Headers': ['*'],
    'Access-Control-Expose-Headers': ['*'],
  });
  assert.deepEqual(asPlayer({ Accept: '*/*', 'User-Agent': 'Chrome', Origin: origin, Referer: origin + '/' }, 'VLC/3.0.21'), {
    Accept: '*/*',
    'User-Agent': 'VLC/3.0.21',
  });
});

test('stores each key in its own file with a safe name', () => {
  assert.equal(keyFile('iptv-player:library:movies'), 'iptv-player%3Alibrary%3Amovies.txt');
  assert.equal(keyFile('../x'), '%2E.%2Fx.txt');
  assert.equal(keyFile('a/b\\c*'), 'a%2Fb%5Cc%2A.txt');
});

test('reads the release version and compares versions', () => {
  assert.equal(releaseVersion('Desktop app 1.2.3. Built from abc (push), version 12.'), '1.2.3');
  assert.equal(releaseVersion('Built from abc'), null);
  assert.equal(isNewer('1.2.4', '1.2.3'), true);
  assert.equal(isNewer('1.10.0', '1.9.9'), true);
  assert.equal(isNewer('2.0.0', '10.0.0'), false);
  assert.equal(isNewer('1.2.3', '1.2.3'), false);
  assert.equal(isNewer(null, '1.0.0'), false);
});
