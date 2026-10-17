import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import ffmpeg from 'ffmpeg-static';
import { createTranscoder, parseProbe, transcodeArguments } from '../lib/transcoder.mjs';

const MKV_HEVC_EAC3 = `Input #0, matroska,webm, from 'http://x/movie/u/p/1.mkv':
  Duration: 01:58:20.12, start: 0.000000, bitrate: 14000 kb/s
  Stream #0:0(eng): Video: hevc (Main 10), yuv420p10le(tv, bt2020nc/bt2020/smpte2084), 3840x1600 [SAR 1:1 DAR 12:5], 23.98 fps (default)
  Stream #0:1(eng): Audio: eac3, 48000 Hz, 5.1(side), fltp, 640 kb/s (default)
  Stream #0:2(ger): Audio: ac3, 48000 Hz, stereo, fltp, 192 kb/s
  Stream #0:3(eng): Subtitle: subrip
  Stream #0:4: Video: mjpeg (Baseline), yuvj420p, 600x900, 90k tbr (attached pic)`;
const LIVE_TS = `Input #0, mpegts, from 'http://x/live/u/p/1.ts':
  Duration: N/A, start: 1234.5, bitrate: N/A
  Stream #0:0[0x100]: Video: h264 (High) ([27][0][0][0] / 0x001B), yuv420p(tv, bt709), 1920x1080, 25 fps
  Stream #0:1[0x101](pol): Audio: ac3 ([129][0][0][0] / 0x0081), 48000 Hz, stereo, fltp, 192 kb/s`;

test('reads length, video and audio tracks from what FFmpeg says', () => {
  assert.deepEqual(parseProbe(MKV_HEVC_EAC3), {
    duration: 7100.12,
    video: { codec: 'hevc', height: 1600, hdr: true },
    audio: [
      { codec: 'eac3', language: 'eng' },
      { codec: 'ac3', language: 'ger' },
    ],
  });
  assert.deepEqual(parseProbe(LIVE_TS), {
    duration: null,
    video: { codec: 'h264', height: 1080, hdr: false },
    audio: [{ codec: 'ac3', language: 'pol' }],
  });
});

test('converts what Chromium cannot decode and copies the rest', () => {
  const probe = parseProbe(MKV_HEVC_EAC3);
  const base = { url: 'http://x/1.mkv', userAgent: 'VLC', folder: '/tmp/t' };
  const full = transcodeArguments({ ...base, probe, at: 600.7, audio: 1, tonemap: true }).join(' ');
  assert.match(full, /-ss 600 -i http:\/\/x\/1\.mkv -map 0:v:0 -map 0:a:1/);
  assert.match(full, /tonemap=hable.*scale=-2:1080,format=yuv420p -c:v libx264/);
  assert.match(full, /-c:a aac -ac 2/);
  assert.match(full, /-hls_playlist_type event/);
  const copied = transcodeArguments({ ...base, probe, copyVideo: true }).join(' ');
  assert.match(copied, /-c:v copy -tag:v hvc1/);
  assert.doesNotMatch(copied, /-ss/);
  const live = transcodeArguments({ ...base, probe: parseProbe(LIVE_TS), live: true, at: 50, copyVideo: true }).join(' ');
  assert.doesNotMatch(live, /-ss/);
  assert.match(live, /-hls_list_size 10 -hls_flags delete_segments/);
  // AAC already plays: copied.
  const aac = transcodeArguments({ ...base, probe: { duration: 10, video: { codec: 'mpeg2video' }, audio: [{ codec: 'aac' }] } });
  assert.match(aac.join(' '), /-c:a copy/);
});

test('plays an HEVC and AC-3 file through H.264 and AAC, from the second asked for', { timeout: 120_000 }, async (t) => {
  if (!ffmpeg || !existsSync(ffmpeg)) return t.skip('no FFmpeg binary');
  const folder = mkdtempSync(path.join(tmpdir(), 'transcode-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const source = path.join(folder, 'movie.mkv');
  execFileSync(ffmpeg, [
    ...['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=20'],
    ...['-f', 'lavfi', '-i', 'sine=frequency=440:duration=20', '-c:v', 'libx265', '-preset', 'ultrafast', '-x265-params', 'log-level=none'],
    ...['-c:a', 'ac3', source],
  ]);
  let agent = '';
  const server = createServer((request, response) => {
    agent = request.headers['user-agent'] ?? '';
    const data = readFileSync(source);
    response.writeHead(200, { 'Content-Type': 'video/x-matroska', 'Content-Length': data.length }).end(data);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  // A host name, not an address: the static Linux FFmpeg crashes looking one up itself.
  const url = `http://localhost:${server.address().port}/movie/u/p/1.mkv`;

  const transcoder = createTranscoder({ ffmpeg, root: path.join(folder, 'out'), userAgent: 'VLC/3.0.21' });
  const probe = await transcoder.probe(url);
  assert.equal(agent, 'VLC/3.0.21');
  assert.deepEqual(probe.video, { codec: 'hevc', height: 360, hdr: false });
  assert.equal(probe.audio[0].codec, 'ac3');

  const started = await transcoder.start({ url, probe, at: 8 });
  assert.match(started.playlist, /^\/transcode\/[0-9a-f]{24}\/index\.m3u8$/);
  assert.equal(started.at, 8);
  assert.ok(Math.abs(started.duration - 20) < 0.5);
  const playlist = transcoder.file(started.playlist);
  assert.ok(playlist && existsSync(playlist));
  assert.match(readFileSync(playlist, 'utf8'), /init\.mp4[\s\S]*s00000\.m4s/);
  assert.equal(transcoder.file(started.playlist.replace('index.m3u8', '../../secret')), null);
  assert.equal(transcoder.file('/transcode/000000000000000000000000/index.m3u8'), null);
  // What the page gets is H.264 and AAC.
  const init = transcoder.file(started.playlist.replace('index.m3u8', 'init.mp4'));
  const text = (() => {
    try {
      execFileSync(ffmpeg, ['-hide_banner', '-i', init], { stdio: 'pipe' });
    } catch (error) {
      return String(error.stderr);
    }
    return '';
  })();
  assert.match(text, /Video: h264/);
  assert.match(text, /Audio: aac/);

  // A new start (a seek) ends the one before and removes its files.
  const again = await transcoder.start({ url, probe, at: 0, copyVideo: false });
  assert.equal(transcoder.file(started.playlist), null);
  assert.ok(!existsSync(path.dirname(playlist)));
  await transcoder.close();
  assert.equal(transcoder.file(again.playlist), null);
});
