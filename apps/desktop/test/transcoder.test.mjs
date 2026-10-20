import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import ffmpeg from 'ffmpeg-static';
import {
  createRelay,
  createTranscoder,
  frameArguments,
  masterPlaylist,
  parseProbe,
  readable,
  transcodeArguments,
} from '../lib/transcoder.mjs';

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
  // Both audio tracks, each its own rendition (issue #270).
  assert.match(full, /-ss 600 -i http:\/\/x\/1\.mkv -map 0:v:0 -map 0:a:0 -map 0:a:1 -sn/);
  assert.match(full, /tonemap=hable.*scale=-2:1080,format=yuv420p -c:v libx264/);
  assert.match(full, /-c:a:0 aac -ac:a:0 2 -b:a:0 192k -c:a:1 aac -ac:a:1 2/);
  assert.match(full, /-hls_segment_filename \/tmp\/t\/%v\/s%05d\.m4s/);
  assert.match(full, /-hls_playlist_type event/);
  assert.match(
    full,
    /-var_stream_map v:0,agroup:audio,name:video a:0,agroup:audio,name:audio0 a:1,agroup:audio,name:audio1 \/tmp\/t\/%v\/index\.m3u8$/,
  );
  const copied = transcodeArguments({ ...base, probe, copyVideo: true }).join(' ');
  assert.match(copied, /-c:v copy -tag:v hvc1/);
  assert.doesNotMatch(copied, /-ss/);
  const live = transcodeArguments({ ...base, probe: parseProbe(LIVE_TS), live: true, at: 50, copyVideo: true }).join(' ');
  assert.doesNotMatch(live, /-ss/);
  assert.match(live, /-hls_list_size 10 -hls_flags delete_segments/);
  // AAC already plays: copied.
  const aac = transcodeArguments({ ...base, probe: { duration: 10, video: { codec: 'mpeg2video' }, audio: [{ codec: 'aac' }] } });
  assert.match(aac.join(' '), /-c:a copy/);
  assert.match(aac.join(' '), /-map 0:a:0 -sn .* \/tmp\/t\/index\.m3u8$/);
  assert.doesNotMatch(aac.join(' '), /var_stream_map/);
  // AAC among other tracks: that one is copied, the rest converted.
  const mixed = { duration: 10, video: { codec: 'h264' }, audio: [{ codec: 'ac3' }, { codec: 'aac' }] };
  assert.match(transcodeArguments({ ...base, probe: mixed, copyVideo: true }).join(' '), /-c:a:0 aac .* -c:a:1 copy/);
});

test('names each converted audio track by its language, the chosen one first to play (issue #270)', () => {
  const probe = {
    duration: 10,
    video: null,
    audio: [
      { codec: 'ac3', language: 'eng' },
      { codec: 'dts', language: null },
      { codec: 'aac', language: 'por' },
    ],
  };
  const text = masterPlaylist(probe, 2);
  assert.match(text, /NAME="eng",LANGUAGE="eng",DEFAULT=NO,AUTOSELECT=YES,URI="audio0\/index\.m3u8"/);
  assert.match(text, /NAME="Track 2",DEFAULT=NO,AUTOSELECT=YES,URI="audio1\/index\.m3u8"/);
  assert.match(text, /NAME="por",LANGUAGE="por",DEFAULT=YES/);
  assert.match(text, /#EXT-X-STREAM-INF:BANDWIDTH=\d+,AUDIO="audio"\nvideo\/index\.m3u8\n$/);
  // A track number past the list: the first.
  assert.match(masterPlaylist(probe, 9), /NAME="eng",LANGUAGE="eng",DEFAULT=YES/);
});

test('takes one timeline picture, and reads only provider streams and downloads', () => {
  const args = frameArguments({ url: 'http://relay/a', at: 61.9, hdr: true, tonemap: true }).join(' ');
  assert.match(
    args,
    /-ss 61 -i http:\/\/relay\/a -map 0:v:0 -frames:v 1 -vf zscale=.*,scale=-2:216,format=yuvj420p -f image2pipe -c:v mjpeg/,
  );
  assert.doesNotMatch(frameArguments({ url: 'x', at: 1, hdr: true, tonemap: false }).join(' '), /zscale/);
  assert.ok(readable('https://panel/movie/u/p/1.mkv'));
  assert.ok(readable('/__offline__/movie-1/file'));
  assert.ok(readable('/__offline__/episode-2/index.m3u8'));
  assert.ok(!readable('/__offline__/movie-1/../../etc'));
  assert.ok(!readable('file:///etc/passwd'));
  assert.ok(!readable('/etc/passwd'));
});

test('hands FFmpeg a download piece after piece from the page (issue #270)', async (t) => {
  const bytes = Buffer.from(Array.from({ length: 25 }, (_, i) => i));
  const asked = [];
  // Like the Service Worker: at most 10 bytes per answer.
  const readPage = async (pagePath, start) => {
    asked.push([pagePath, start]);
    if (pagePath.endsWith('index.m3u8'))
      return {
        status: 200,
        contentType: 'application/vnd.apple.mpegurl',
        total: null,
        data: Buffer.from('#EXTM3U\n/__offline__/movie-1/r/0\n'),
      };
    if (!pagePath.startsWith('/__offline__/movie-1/')) return { status: 404, contentType: null, total: null, data: Buffer.alloc(0) };
    return { status: 206, contentType: 'video/x-matroska', total: bytes.length, data: bytes.subarray(start, start + 10) };
  };
  const relay = await createRelay({ userAgent: 'VLC', readPage });
  t.after(() => relay.close());
  const file = relay.local('/__offline__/movie-1/file');
  const whole = await fetch(file);
  assert.equal(whole.status, 200);
  assert.deepEqual(Buffer.from(await whole.arrayBuffer()), bytes);
  const part = await fetch(file, { headers: { Range: 'bytes=7-21' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 7-21/25');
  assert.deepEqual(Buffer.from(await part.arrayBuffer()), bytes.subarray(7, 22));
  assert.equal((await fetch(file, { headers: { Range: 'bytes=30-' } })).status, 416);
  const playlist = relay.local('/__offline__/movie-1/index.m3u8');
  // Parts named from the root stay on the relay address.
  const token = /\/([0-9a-f]{24})\//.exec(playlist)[1];
  assert.equal(await (await fetch(playlist)).text(), `#EXTM3U\n/${token}/__offline__/movie-1/r/0\n`);
  // Relative parts of a download's playlist stay on the relay; nothing outside downloads is asked for.
  assert.equal((await fetch(playlist.replace('index.m3u8', 'r/3'))).status, 200);
  assert.equal((await fetch(playlist.replace('/__offline__/movie-1/index.m3u8', '/secret'))).status, 404);
  assert.ok(asked.every(([pagePath]) => pagePath.startsWith('/__offline__/')));
  assert.throws(() => relay.local('/elsewhere'), /Invalid URL/);
});

test('plays an HEVC and AC-3 file through H.264 and AAC, from the second asked for', { timeout: 120_000 }, async (t) => {
  if (!ffmpeg || !existsSync(ffmpeg)) return t.skip('no FFmpeg binary');
  const folder = mkdtempSync(path.join(tmpdir(), 'transcode-'));
  t.after(() => rmSync(folder, { recursive: true, force: true, maxRetries: 5 }));
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
  // Also when an assertion fails: a running FFmpeg or the relay would keep the test process open.
  t.after(() => transcoder.close());
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

test('converts every audio track of a download and takes timeline pictures (issue #270)', { timeout: 120_000 }, async (t) => {
  if (!ffmpeg || !existsSync(ffmpeg)) return t.skip('no FFmpeg binary');
  const folder = mkdtempSync(path.join(tmpdir(), 'transcode-'));
  t.after(() => rmSync(folder, { recursive: true, force: true, maxRetries: 5 }));
  const source = path.join(folder, 'movie.mkv');
  execFileSync(ffmpeg, [
    ...['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=12'],
    ...['-f', 'lavfi', '-i', 'sine=frequency=440:duration=12', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=12'],
    ...['-map', '0', '-map', '1', '-map', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'ac3'],
    ...['-metadata:s:a:0', 'language=eng', '-metadata:s:a:1', 'language=por', source],
  ]);
  const data = readFileSync(source);
  // The page's Service Worker answers one chunk at a time.
  const readPage = async (pagePath, start) =>
    pagePath === '/__offline__/movie-1/file'
      ? { status: 206, contentType: 'video/x-matroska', total: data.length, data: data.subarray(start, start + 256 * 1024) }
      : { status: 404, contentType: null, total: null, data: Buffer.alloc(0) };
  const transcoder = createTranscoder({ ffmpeg, root: path.join(folder, 'out'), userAgent: 'VLC/3.0.21', readPage });
  t.after(() => transcoder.close());
  const url = '/__offline__/movie-1/file';
  const probe = await transcoder.probe(url);
  assert.deepEqual(
    probe.audio.map((track) => track.language),
    ['eng', 'por'],
  );
  const started = await transcoder.start({ url, probe, at: 4, copyVideo: true, audio: 1 });
  const master = readFileSync(transcoder.file(started.playlist), 'utf8');
  assert.match(master, /NAME="por",LANGUAGE="por",DEFAULT=YES,AUTOSELECT=YES,URI="audio1\/index\.m3u8"/);
  const audio1 = transcoder.file(started.playlist.replace('index.m3u8', 'audio1/index.m3u8'));
  assert.match(readFileSync(audio1, 'utf8'), /s00000\.m4s/);
  const init = readdirSync(path.dirname(audio1)).find((name) => /^init(_\d+)?\.mp4$/.test(name));
  assert.ok(transcoder.file(started.playlist.replace('index.m3u8', `audio1/${init}`)));
  assert.equal(transcoder.file(started.playlist.replace('index.m3u8', 'audio8/index.m3u8')), null);

  const jpeg = await transcoder.frame({ url, at: 6 });
  assert.ok(jpeg && jpeg[0] === 0xff && jpeg[1] === 0xd8, 'a JPEG');
  await transcoder.close();
});
