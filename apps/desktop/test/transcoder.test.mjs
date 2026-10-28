import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import ffmpeg from 'ffmpeg-static';
import {
  createRelay,
  createTranscoder,
  encoderTestArguments,
  frameArguments,
  hardwareEncoders,
  masterPlaylist,
  parseProbe,
  readable,
  startTime,
  subtitlePlaylist,
  subtitleSegment,
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
    subtitles: [{ codec: 'subrip', language: 'eng', title: null, text: true }],
  });
  assert.deepEqual(parseProbe(LIVE_TS), {
    duration: null,
    video: { codec: 'h264', height: 1080, hdr: false },
    audio: [{ codec: 'ac3', language: 'pol' }],
    subtitles: [],
  });
});

test('reads subtitle tracks with their titles; pictures cannot be shown converted (D-236)', () => {
  const probe = parseProbe(`Input #0, matroska,webm, from 'http://x/series/u/p/9.mkv':
  Metadata:
    title           : Jujutsu Kaisen S01E03
  Duration: 00:23:55.00, start: 0.000000, bitrate: 3000 kb/s
  Stream #0:0: Video: hevc (Main 10), yuv420p10le(tv), 1920x1080, 23.98 fps (default)
  Stream #0:1(jpn): Audio: eac3, 48000 Hz, stereo, fltp, 224 kb/s (default)
    Metadata:
      title           : Japanese
  Stream #0:2(eng): Subtitle: ass (default)
    Metadata:
      title           : English
  Stream #0:3(por): Subtitle: ass
    Metadata:
      title           : Português (Brasil)
      BPS             : 120
  Stream #0:4(ger): Subtitle: hdmv_pgs_subtitle
  Stream #0:5: Attachment: ttf
    Metadata:
      filename        : font.ttf`);
  assert.deepEqual(probe.audio, [{ codec: 'eac3', language: 'jpn' }]);
  assert.deepEqual(probe.subtitles, [
    { codec: 'ass', language: 'eng', title: 'English', text: true },
    { codec: 'ass', language: 'por', title: 'Português (Brasil)', text: true },
    { codec: 'hdmv_pgs_subtitle', language: 'ger', title: null, text: false },
  ]);
  const base = { url: 'http://x/9.mkv', userAgent: 'VLC', folder: '/tmp/t', probe };
  const args = transcodeArguments({ ...base, copyVideo: true }).join(' ');
  // One audio track and subtitles: the video in its own folder, each text track a WebVTT file; the picture one left out.
  assert.match(args, /-hls_segment_filename \/tmp\/t\/video\/s%05d\.m4s .* \/tmp\/t\/video\/index\.m3u8 -map 0:s:0 -c:s webvtt/);
  assert.match(args, /-map 0:s:1 -c:s webvtt -avoid_negative_ts disabled -flush_packets 1 -f webvtt \/tmp\/t\/text1\.vtt$/);
  assert.doesNotMatch(args, /0:s:2|text2/);
  assert.doesNotMatch(transcodeArguments({ ...base, live: true }).join(' '), /webvtt/);
  // A copied video from part way starts at a key frame, with the file's own times, and says where (start.txt).
  const later = transcodeArguments({ ...base, copyVideo: true, at: 300.5 }).join(' ');
  assert.match(later, /-noaccurate_seek -copyts -ss 300 -i /);
  assert.match(later, /-map 0:v:0 -c:v copy -frames:v 1 -flush_packets 1 -f framecrc \/tmp\/t\/start\.txt/);
  assert.doesNotMatch(transcodeArguments({ ...base, at: 300.5 }).join(' '), /copyts|start\.txt/);

  const playlist = masterPlaylist(probe, 0);
  assert.doesNotMatch(playlist, /TYPE=AUDIO/);
  assert.match(playlist, /TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="eng",DEFAULT=NO,AUTOSELECT=NO,URI="text0\/index\.m3u8"/);
  assert.match(playlist, /NAME="Português \(Brasil\)",LANGUAGE="por",.*URI="text1\/index\.m3u8"/);
  assert.match(playlist, /#EXT-X-STREAM-INF:BANDWIDTH=\d+,SUBTITLES="subs"\nvideo\/index\.m3u8\n$/);
  assert.doesNotMatch(masterPlaylist(probe, 0, true), /SUBTITLES/);
});

test("cuts a growing WebVTT file into the video's segments (D-236)", () => {
  const video = ['#EXTM3U', '#EXT-X-MAP:URI="init.mp4"', '#EXTINF:4.004000,', 's00000.m4s', '#EXTINF:4.000000,', 's00001.m4s'];
  const vtt =
    'WEBVTT\n\n00:-1.-500 --> 00:00.-200\nbefore\n\n00:01.000 --> 00:02.000\none\n\n00:04.500 --> 00:06.000 line:90%\ntwo\nlines\n\n';
  // The newest segment waits for the next one; all are listed once the video ends.
  assert.match(subtitlePlaylist(video.join('\n')), /PLAYLIST-TYPE:EVENT\n#EXTINF:4\.004000,\ns00000\.vtt\n$/);
  assert.match(
    subtitlePlaylist([...video, '#EXT-X-ENDLIST'].join('\n')),
    /s00000\.vtt\n#EXTINF:4\.000000,\ns00001\.vtt\n#EXT-X-ENDLIST\n$/,
  );
  assert.equal(subtitleSegment(video.join('\n'), vtt, 's00000.vtt'), 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\none\n');
  assert.equal(subtitleSegment(video.join('\n'), vtt, 's00001.vtt'), 'WEBVTT\n\n00:00:04.500 --> 00:00:06.000 line:90%\ntwo\nlines\n');
  assert.equal(subtitleSegment(video.join('\n'), vtt, 's00002.vtt'), null);
  // A copied video that starts 0.5 s into the file: every cue that much earlier.
  assert.match(subtitleSegment(video.join('\n'), vtt, 's00000.vtt', 0.5), /00:00:00\.500 --> 00:00:01\.500\none\n\n00:00:04\.000/);
  assert.equal(
    startTime('#software: Lavf60\n#tb 0: 1/1000\n#media_type 0: video\n0,       9920,      10000,       40,    10990, 0x8f\n'),
    10,
  );
  assert.equal(startTime(''), null);
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
    /-var_stream_map v:0,agroup:audio,name:video a:0,agroup:audio,name:audio0 a:1,agroup:audio,name:audio1 \/tmp\/t\/%v\/index\.m3u8 -map 0:s:0 -c:s webvtt .*\/tmp\/t\/text0\.vtt$/,
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

test('converts with a hardware encoder up to 2160 lines, in software up to 1080 (issue #274)', () => {
  assert.deepEqual(hardwareEncoders('win32'), ['h264_nvenc', 'h264_qsv', 'h264_amf']);
  assert.deepEqual(hardwareEncoders('darwin'), ['h264_videotoolbox']);
  const base = { url: 'http://x/1.mkv', userAgent: 'VLC', folder: '/tmp/t' };
  const wide = parseProbe(MKV_HEVC_EAC3);
  const nvenc = transcodeArguments({ ...base, probe: wide, tonemap: true, encoder: 'h264_nvenc' }).join(' ');
  assert.match(nvenc, /tonemap=hable[^ ]*,format=nv12 -c:v h264_nvenc .*-forced-idr 1 -force_key_frames expr:gte\(t,n_forced\*4\)/);
  assert.doesNotMatch(nvenc, /scale=-2:/);
  const eightK = { ...wide, video: { codec: 'hevc', height: 4320, hdr: false } };
  assert.match(transcodeArguments({ ...base, probe: eightK, encoder: 'h264_qsv' }).join(' '), /scale=-2:2160,format=nv12 -c:v h264_qsv/);
  assert.match(
    transcodeArguments({ ...base, probe: eightK, encoder: 'h264_videotoolbox' }).join(' '),
    /-c:v h264_videotoolbox -realtime 1 -b:v 20M/,
  );
  assert.match(transcodeArguments({ ...base, probe: eightK }).join(' '), /scale=-2:1080,format=yuv420p -c:v libx264/);
  // The test picture goes through the same encoder arguments, into nothing.
  assert.match(encoderTestArguments('h264_amf').join(' '), /-f lavfi -i testsrc2=.* -c:v h264_amf -usage lowlatency .* -f null -$/);
});

test(
  'falls back to software when the hardware encoder fails, for the test picture or a real video (issue #274)',
  { timeout: 120_000 },
  async (t) => {
    if (!ffmpeg || !existsSync(ffmpeg) || process.platform === 'win32') return t.skip('no FFmpeg binary, or no shell');
    const folder = mkdtempSync(path.join(tmpdir(), 'transcode-'));
    t.after(() => rmSync(folder, { recursive: true, force: true, maxRetries: 5 }));
    const source = path.join(folder, 'movie.mkv');
    execFileSync(ffmpeg, [
      ...['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=12'],
      ...['-c:v', 'libx265', '-preset', 'ultrafast', '-x265-params', 'log-level=none', '-an', source],
    ]);
    // "h264_fake" is listed and passes the test picture, but no real video converts with it.
    const wrapper = path.join(folder, 'ffmpeg.sh');
    writeFileSync(
      wrapper,
      `#!/bin/sh\ncase "$*" in *-encoders*) echo " V..... h264_fake  Fake"; echo " V..... h264_gone  Gone"; exit 0;; esac\n` +
        `case "$*" in *h264_gone*) exit 1;; *"-f null"*) exit 0;; esac\nexec "${ffmpeg}" "$@"\n`,
    );
    chmodSync(wrapper, 0o755);
    const server = createServer((request, response) => {
      const data = readFileSync(source);
      response.writeHead(200, { 'Content-Type': 'video/x-matroska', 'Content-Length': data.length }).end(data);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());
    const url = `http://localhost:${server.address().port}/movie/u/p/1.mkv`;
    const logs = [];
    const transcoder = createTranscoder({
      ffmpeg: wrapper,
      root: path.join(folder, 'out'),
      userAgent: 'VLC',
      // Gone fails the test picture, missing is not listed, fake passes it.
      encoders: ['h264_gone', 'h264_missing', 'h264_fake'],
      onLog: (line) => logs.push(line),
    });
    t.after(() => transcoder.close());
    const probe = { duration: 12, video: { codec: 'hevc', height: 360, hdr: false }, audio: [] };
    const started = await transcoder.start({ url, probe });
    assert.equal(started.encoder, 'libx264');
    assert.match(readFileSync(transcoder.file(started.playlist), 'utf8'), /s00000\.m4s/);
    assert.match(logs.join('\n'), /^h264_fake failed, converting in software/);
    // From then on in software straight away.
    assert.equal((await transcoder.start({ url, probe, at: 4 })).encoder, 'libx264');
    assert.equal(logs.length, 1);
    // Video Chromium decodes is copied: no encoder.
    assert.equal((await transcoder.start({ url, probe, copyVideo: true })).encoder, null);
  },
);

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

test(
  'keeps text subtitles, timed to a copied video that starts at the key frame before the second asked for (D-236)',
  { timeout: 120_000 },
  async (t) => {
    if (!ffmpeg || !existsSync(ffmpeg)) return t.skip('no FFmpeg binary');
    const folder = mkdtempSync(path.join(tmpdir(), 'transcode-'));
    t.after(() => rmSync(folder, { recursive: true, force: true, maxRetries: 5 }));
    const cues = (word) =>
      Array.from(
        { length: 9 },
        (_, i) =>
          `${i + 1}\n00:00:${String(2 * i + 2).padStart(2, '0')},000 --> 00:00:${String(2 * i + 3).padStart(2, '0')},000\n${word} ${2 * i + 2}\n`,
      ).join('\n');
    writeFileSync(path.join(folder, 'en.srt'), cues('english'));
    writeFileSync(path.join(folder, 'pt.srt'), cues('português'));
    const source = path.join(folder, 'episode.mkv');
    // Key frames every 10 s.
    execFileSync(ffmpeg, [
      ...['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=25:duration=20'],
      ...['-f', 'lavfi', '-i', 'sine=duration=20', '-i', path.join(folder, 'en.srt'), '-i', path.join(folder, 'pt.srt')],
      ...[
        '-map',
        '0',
        '-map',
        '1',
        '-map',
        '2',
        '-map',
        '3',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-g',
        '250',
        '-c:a',
        'ac3',
        '-c:s',
        'ass',
      ],
      ...['-metadata:s:s:0', 'language=eng', '-metadata:s:s:1', 'language=por', '-metadata:s:s:1', 'title=Português', source],
    ]);
    const server = createServer((request, response) => {
      const data = readFileSync(source);
      const range = /bytes=(\d+)-/.exec(request.headers.range ?? '');
      const start = range ? Number(range[1]) : 0;
      response.writeHead(range ? 206 : 200, {
        'Content-Length': data.length - start,
        'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${data.length - 1}/${data.length}` } : {}),
      });
      response.end(data.subarray(start));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());
    const url = `http://localhost:${server.address().port}/series/u/p/9.mkv`;
    const transcoder = createTranscoder({ ffmpeg, root: path.join(folder, 'out'), userAgent: 'VLC' });
    t.after(() => transcoder.close());
    const probe = await transcoder.probe(url);
    assert.deepEqual(
      probe.subtitles.map(({ language, title }) => [language, title]),
      [
        ['eng', null],
        ['por', 'Português'],
      ],
    );

    const started = await transcoder.start({ url, probe, at: 13, copyVideo: true });
    assert.equal(started.at, 10);
    const main = readFileSync(transcoder.file(started.playlist), 'utf8');
    assert.match(main, /NAME="Português",LANGUAGE="por".*URI="text1\/index\.m3u8"/);
    const base = started.playlist.replace('index.m3u8', '');
    // Once FFmpeg is done every segment is listed; the first starts at 10 s into the episode.
    let list = null;
    for (let tries = 0; !list?.body.includes('ENDLIST') && tries < 100; tries += 1) {
      list = await transcoder.subtitles(`${base}text1/index.m3u8`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.match(list.body, /s00000\.vtt[\s\S]*#EXT-X-ENDLIST/);
    const first = await transcoder.subtitles(`${base}text1/s00000.vtt`);
    assert.equal(first.type, 'text/vtt');
    assert.match(first.body, /^WEBVTT\n\n00:00:00\.000 --> 00:00:01\.000\nportuguês 10\n\n00:00:02\.000 --> 00:00:03\.000\nportuguês 12\n/);
    assert.equal(await transcoder.subtitles(`${base}text2/index.m3u8`), null);
    assert.equal(await transcoder.subtitles('/transcode/000000000000000000000000/text0/index.m3u8'), null);
  },
);

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
