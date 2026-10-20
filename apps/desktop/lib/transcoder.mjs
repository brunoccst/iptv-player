// Plays what Chromium cannot decode (issue #236, DECISIONS.md#d-189): the FFmpeg bundled with the app (ffmpeg-static)
// reads the provider's stream and writes HLS with H.264 video and AAC audio into a temporary folder, which the app's
// own server hands to the page's hls.js. Video Chromium decodes (H.264, HEVC with a decoder) is copied, not converted.
// FFmpeg reads the provider through a relay in this process (`createRelay`), which also sends the player User-Agent.
// Every audio track is converted, each its own HLS audio rendition, and downloads are read from the page (issue #270).
import { spawn as spawnProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';

/** Seconds per HLS segment: short, so playback starts soon after a seek. */
export const SEGMENT_SECONDS = 4;
/** The playlist must name its first segment within this time (a slow provider, a 4K conversion). */
const START_TIMEOUT_MS = 45_000;
const PROBE_TIMEOUT_MS = 20_000;
/** Audio Chromium plays in fragmented MP4 as it is; everything else (AC-3, E-AC-3, DTS, TrueHD, MP2…) becomes AAC. */
const PLAYABLE_AUDIO = new Set(['aac', 'mp3', 'opus', 'flac']);
/** At most this many audio tracks are converted (some files carry a dozen commentaries and dubs). */
export const MAX_AUDIO_TRACKS = 8;
const FRAME_TIMEOUT_MS = 15_000;
/** Timeline pictures (issue #270): this tall, like the player's preview. */
const FRAME_HEIGHT = 216;
/** Downloads (issue #270): addresses FFmpeg reads from the page instead of the provider. */
const OFFLINE_PATH = /^\/__offline__\/[\w-]+\/(?:file|index\.m3u8)$/;

/** Whether `url` is something FFmpeg may read: a provider stream or one of the page's downloads. */
export const readable = (url) => /^https?:\/\//i.test(url) || OFFLINE_PATH.test(url);

/** HDR10 and HLG mapped to normal colours (needs zscale), else the picture looks grey. */
const TONEMAP = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv';

/**
 * What FFmpeg says about a stream when given no output (its stderr): length, the first video and every audio track.
 * `duration` is null for live channels.
 */
export function parseProbe(text) {
  const duration = /Duration: (\d+):(\d\d):(\d\d(?:\.\d+)?)/.exec(text);
  const result = {
    duration: duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : null,
    video: null,
    audio: [],
  };
  for (const line of text.split(/\r?\n/)) {
    const stream = /Stream #\d+:\d+(?:\[0x[0-9a-f]+\])?(?:\(([a-z]{2,3})\))?.*?: (Video|Audio): ([a-z0-9_]+)(.*)/i.exec(line);
    if (!stream) continue;
    const [, language, type, codec, rest] = stream;
    if (type === 'Video' && !result.video && !/attached pic/.test(rest)) {
      const size = /, (\d{2,5})x(\d{2,5})/.exec(rest);
      result.video = {
        codec: codec.toLowerCase(),
        height: size ? Number(size[2]) : null,
        // HDR10 and HLG: converted to normal colours, or the picture looks grey.
        hdr: /smpte2084|arib-std-b67/.test(rest),
      };
    } else if (type === 'Audio') {
      result.audio.push({ codec: codec.toLowerCase(), language: language ?? null });
    }
  }
  return result;
}

/**
 * FFmpeg's arguments for one conversion. `at`: start second (films and episodes); `copyVideo`: Chromium decodes the
 * video as it is; `audio`: which audio track (0 = first); `tonemap`: this FFmpeg has zscale for HDR.
 */
export function transcodeArguments({ url, userAgent, folder, probe, at = 0, live = false, copyVideo = false, audio = 0, tonemap = false }) {
  const args = ['-hide_banner', '-nostdin', '-loglevel', 'error', '-user_agent', userAgent];
  // A dropped connection is reopened instead of ending the video.
  if (/^https?:/i.test(url)) args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
  if (!live && at > 0) args.push('-ss', String(Math.floor(at)));
  args.push('-i', url, '-map', '0:v:0');
  const tracks = probe.audio.slice(0, MAX_AUDIO_TRACKS);
  // One track: a plain playlist. Several (issue #270): every track is its own audio rendition, see `masterPlaylist`.
  const several = tracks.length > 1;
  const track = tracks[audio] ? audio : 0;
  if (several) tracks.forEach((_, index) => args.push('-map', `0:a:${index}`));
  else if (tracks.length > 0) args.push('-map', `0:a:${track}`);
  args.push('-sn', '-dn');
  if (copyVideo) {
    args.push('-c:v', 'copy');
    if (probe.video?.codec === 'hevc') args.push('-tag:v', 'hvc1');
  } else {
    // Software H.264, at most 1080 lines: 4K would be too slow to convert on most computers.
    const filters = [];
    if (probe.video?.hdr && tonemap) filters.push(TONEMAP);
    if ((probe.video?.height ?? 0) > 1080) filters.push('scale=-2:1080');
    filters.push('format=yuv420p');
    args.push('-vf', filters.join(','), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21');
    // A key frame at every segment start, so every segment can be played on its own.
    args.push('-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_SECONDS})`);
  }
  if (several)
    tracks.forEach(({ codec }, index) => {
      if (PLAYABLE_AUDIO.has(codec)) args.push(`-c:a:${index}`, 'copy');
      else args.push(`-c:a:${index}`, 'aac', `-ac:a:${index}`, '2', `-b:a:${index}`, '192k');
    });
  else if (tracks[track] && PLAYABLE_AUDIO.has(tracks[track].codec)) args.push('-c:a', 'copy');
  else if (tracks.length > 0) args.push('-c:a', 'aac', '-ac', '2', '-b:a', '192k');
  const out = toFfmpegPath(folder);
  args.push('-f', 'hls', '-hls_time', String(SEGMENT_SECONDS), '-hls_segment_type', 'fmp4', '-hls_fmp4_init_filename', 'init.mp4');
  args.push('-hls_segment_filename', several ? `${out}/%v/s%05d.m4s` : `${out}/s%05d.m4s`);
  // Live: a moving window of segments; films and episodes: every segment stays, so going back needs no new conversion.
  if (live) args.push('-hls_list_size', '10', '-hls_flags', 'delete_segments+temp_file+independent_segments');
  else args.push('-hls_list_size', '0', '-hls_playlist_type', 'event', '-hls_flags', 'temp_file+independent_segments');
  if (several) {
    const map = ['v:0,agroup:audio,name:video', ...tracks.map((_, index) => `a:${index},agroup:audio,name:audio${index}`)];
    args.push('-var_stream_map', map.join(' '), `${out}/%v/index.m3u8`);
  } else args.push(`${out}/index.m3u8`);
  return args;
}

/**
 * The playlist the page opens when several audio tracks are converted (issue #270): the video and one audio rendition
 * per track, `audio` the default. Written by the app rather than FFmpeg, so each track is named by its language and
 * hls.js lists it like a provider's own HLS tracks.
 */
export function masterPlaylist(probe, audio = 0) {
  const tracks = probe.audio.slice(0, MAX_AUDIO_TRACKS);
  const chosen = tracks[audio] ? audio : 0;
  const lines = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS'];
  tracks.forEach(({ language }, index) => {
    const code = /^[a-z]{2,3}$/.test(language ?? '') ? language : null;
    lines.push(
      [
        '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio"',
        `NAME="${code ?? `Track ${index + 1}`}"`,
        ...(code ? [`LANGUAGE="${code}"`] : []),
        `DEFAULT=${index === chosen ? 'YES' : 'NO'}`,
        'AUTOSELECT=YES',
        `URI="audio${index}/index.m3u8"`,
      ].join(','),
    );
  });
  lines.push('#EXT-X-STREAM-INF:BANDWIDTH=8000000,AUDIO="audio"', 'video/index.m3u8', '');
  return lines.join('\n');
}

/** FFmpeg's arguments for one timeline picture (issue #270): a JPEG of the frame at `at` seconds, on its output. */
export function frameArguments({ url, at, hdr = false, tonemap = false }) {
  const filters = [...(hdr && tonemap ? [TONEMAP] : []), `scale=-2:${FRAME_HEIGHT}`, 'format=yuvj420p'];
  return [
    ...['-hide_banner', '-nostdin', '-loglevel', 'error', '-ss', String(Math.max(0, Math.floor(at))), '-i', url],
    ...['-map', '0:v:0', '-frames:v', '1', '-vf', filters.join(','), '-f', 'image2pipe', '-c:v', 'mjpeg', '-q:v', '5', 'pipe:1'],
  ];
}

/** Answer headers FFmpeg needs to read and seek in a file. */
const RELAYED_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges'];

/**
 * Hands FFmpeg the provider's streams from 127.0.0.1. The Linux FFmpeg build is static and crashes when it looks up a
 * host name itself; here Node does it (and TLS, redirects), and adds the User-Agent. `local(url)`: the address FFmpeg
 * opens; relative addresses inside an HLS playlist stay on the same relay. A download's address (`/__offline__/…`,
 * issue #270) is read from the page with `readPage`, which decrypts it (D-024).
 */
export async function createRelay({ userAgent, fetch: fetchUrl = fetch, readPage = null }) {
  /** token → provider origin, or PAGE */
  const origins = new Map();
  const server = createServer(async (request, response) => {
    const [, token, rest = ''] = /^\/([0-9a-f]{24})(\/.*)?$/.exec(request.url ?? '') ?? [];
    const origin = token && origins.get(token);
    if (!origin) return response.writeHead(404).end();
    if (origin === PAGE) return relayPage(readPage, token, rest, request, response);
    const controller = new AbortController();
    response.on('close', () => controller.abort());
    try {
      const headers = { 'User-Agent': userAgent };
      if (request.headers.range) headers.Range = request.headers.range;
      const answer = await fetchUrl(origin + rest, { headers, redirect: 'follow', signal: controller.signal });
      const relayed = Object.fromEntries(
        RELAYED_HEADERS.flatMap((name) => (answer.headers.get(name) ? [[name, answer.headers.get(name)]] : [])),
      );
      response.writeHead(answer.status, relayed);
      if (!answer.body || request.method === 'HEAD') return response.end();
      Readable.fromWeb(answer.body)
        .on('error', () => response.destroy())
        .pipe(response);
    } catch {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    local(url) {
      const token = randomBytes(12).toString('hex');
      if (OFFLINE_PATH.test(url)) {
        if (!readPage) throw new Error('Downloads cannot be read here');
        origins.set(token, PAGE);
        return `${base}/${token}${url}`;
      }
      const parsed = new URL(url);
      origins.set(token, parsed.origin);
      return `${base}/${token}${parsed.pathname}${parsed.search}`;
    },
    /** Forgets every address handed out. */
    clear: () => origins.clear(),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const PAGE = Symbol('page');

/**
 * One request for a download (issue #270): the page answers a piece at a time (`readPage(path, start)` →
 * `{ status, contentType, total, data }`, `total` null for a playlist or HLS part, which come whole); a byte range is
 * sent as one answer, piece after piece.
 */
async function relayPage(readPage, token, path, request, response) {
  if (!/^\/__offline__\/[\w-]+\/(?:file|index\.m3u8|r\/\d+)$/.test(path)) return response.writeHead(404).end();
  let closed = false;
  response.on('close', () => (closed = true));
  try {
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? '');
    let position = range ? Number(range[1]) : 0;
    let piece = await readPage(path, position);
    if (piece.status < 200 || piece.status >= 300) return response.writeHead(piece.status).end();
    const type = { 'content-type': piece.contentType ?? 'application/octet-stream' };
    if (piece.total === null) {
      // A download's playlist names its parts from the page's root: they stay on this relay address.
      const body = path.endsWith('.m3u8')
        ? Buffer.from(
            Buffer.from(piece.data)
              .toString('utf8')
              .replace(/^\/__offline__\//gm, `/${token}/__offline__/`),
          )
        : piece.data;
      return response.writeHead(200, { ...type, 'content-length': body.length }).end(body);
    }
    const total = piece.total;
    const end = range && range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
    if (position > end) return response.writeHead(416, { 'content-range': `bytes */${total}` }).end();
    response.writeHead(range ? 206 : 200, {
      ...type,
      'accept-ranges': 'bytes',
      'content-length': end - position + 1,
      ...(range ? { 'content-range': `bytes ${position}-${end}/${total}` } : {}),
    });
    while (!closed) {
      const data = piece.data.subarray(0, end - position + 1);
      if (data.length === 0) break;
      position += data.length;
      if (!response.write(data)) await new Promise((resolve) => response.once('drain', resolve));
      if (position > end) break;
      piece = await readPage(path, position);
    }
    response.end();
  } catch {
    if (!response.headersSent) response.writeHead(502);
    response.destroy();
  }
}

/**
 * FFmpeg's HLS writer finds the playlist's folder by its last '/': with Windows backslashes it writes init.mp4 into
 * the working folder instead. FFmpeg takes '/' on every system.
 */
const toFfmpegPath = (folder) => folder.split(path.sep).join('/');

/** Last lines of FFmpeg's error output, for the log (provider addresses are masked by the page's log). */
const tail = (text) => text.trim().split(/\r?\n/).slice(-3).join(' | ');

/**
 * Conversions for one app: at most one runs (one player). `root`: a temporary folder of its own, emptied on start
 * and on quit.
 */
export function createTranscoder({ ffmpeg, root, userAgent, spawn = spawnProcess, readPage = null }) {
  /** id → { process, folder } */
  const running = new Map();
  let tonemap = null;
  let relay = null;
  /** The timeline picture being taken: a newer request ends it. */
  let framing = null;
  const local = async (url) => {
    relay ??= createRelay({ userAgent, readPage });
    return (await relay).local(url);
  };

  const run = (args, timeoutMs) =>
    new Promise((resolve) => {
      const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
      let text = '';
      child.stderr.on('data', (chunk) => (text = (text + chunk).slice(-64_000)));
      const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({ text: String(error.message), code: -1 });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ text, code });
      });
    });

  const hasTonemap = async () => {
    tonemap ??= run(['-hide_banner', '-filters'], PROBE_TIMEOUT_MS).then(({ text }) => /\bzscale\b/.test(text) && /\btonemap\b/.test(text));
    return tonemap;
  };

  async function stop(id) {
    const entry = running.get(id);
    if (!entry) return;
    running.delete(id);
    entry.process.kill('SIGKILL');
    await rm(entry.folder, { recursive: true, force: true }).catch(() => undefined);
  }

  async function stopAll() {
    await Promise.all([...running.keys()].map(stop));
    if (relay) (await relay).clear();
  }

  return {
    /** What the stream holds (`parseProbe`); FFmpeg reads only its start. */
    async probe(url) {
      if (!readable(url)) throw new Error('Only provider streams and downloads can be read');
      const { text } = await run(['-hide_banner', '-nostdin', '-i', await local(url)], PROBE_TIMEOUT_MS);
      const probe = parseProbe(text);
      if (!probe.video && probe.audio.length === 0) throw new Error(`FFmpeg could not read the stream: ${tail(text)}`);
      return probe;
    },

    /**
     * Starts a conversion (ending the one before) and resolves with its playlist path once it names a segment.
     * `probe`: what `probe` answered for this stream before, so the provider is not asked twice.
     */
    async start({ url, probe: known = null, at = 0, live = false, copyVideo = false, audio = 0 }) {
      if (!readable(url)) throw new Error('Only provider streams and downloads can be converted');
      await stopAll();
      const probe = known && Array.isArray(known.audio) ? known : await this.probe(url);
      const id = randomBytes(12).toString('hex');
      const folder = path.join(root, id);
      await mkdir(folder, { recursive: true });
      const args = transcodeArguments({
        url: await local(url),
        userAgent,
        folder,
        probe,
        at,
        live,
        copyVideo,
        audio,
        tonemap: await hasTonemap(),
      });
      const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
      let text = '';
      child.stderr.on('data', (chunk) => (text = (text + chunk).slice(-16_000)));
      running.set(id, { process: child, folder });
      const several = probe.audio.length > 1;
      const chosen = probe.audio[audio] && audio < MAX_AUDIO_TRACKS ? audio : 0;
      // Several audio tracks: ready once the video and the default track have a segment; the app writes the playlist.
      const playlists = several
        ? [path.join(folder, 'video', 'index.m3u8'), path.join(folder, `audio${chosen}`, 'index.m3u8')]
        : [path.join(folder, 'index.m3u8')];
      await new Promise((resolve, reject) => {
        const started = Date.now();
        const fail = (message) => {
          clearInterval(timer);
          void stop(id);
          reject(new Error(message));
        };
        const timer = setInterval(() => {
          if (!running.has(id)) return fail('Conversion stopped');
          if (playlists.every((file) => existsSync(file) && /\.m4s/.test(readFileSync(file, 'utf8')))) {
            clearInterval(timer);
            resolve();
          } else if (child.exitCode !== null) fail(`FFmpeg ended (${child.exitCode}): ${tail(text)}`);
          else if (Date.now() - started > START_TIMEOUT_MS) fail('Conversion did not start in time');
        }, 200);
      });
      if (several) await writeFile(path.join(folder, 'index.m3u8'), masterPlaylist(probe, chosen));
      return { id, playlist: `/transcode/${id}/index.m3u8`, duration: live ? null : probe.duration, at: live ? 0 : Math.floor(at) };
    },

    /**
     * A JPEG of the frame at `at` seconds, for the timeline (issue #270); a newer request ends the one before, which
     * then resolves with null. Opens the stream a second time, like the player's preview (issue #218).
     */
    async frame({ url, at = 0, hdr = false }) {
      if (!readable(url)) throw new Error('Only provider streams and downloads can be read');
      framing?.kill('SIGKILL');
      const args = frameArguments({ url: await local(url), at, hdr, tonemap: hdr && (await hasTonemap()) });
      const child = spawn(ffmpeg, args, { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      framing = child;
      const parts = [];
      child.stdout.on('data', (chunk) => parts.push(chunk));
      const timer = setTimeout(() => child.kill('SIGKILL'), FRAME_TIMEOUT_MS);
      const code = await new Promise((resolve) => {
        child.on('error', () => resolve(-1));
        child.on('close', resolve);
      });
      clearTimeout(timer);
      if (framing === child) framing = null;
      const jpeg = Buffer.concat(parts);
      return code === 0 && jpeg.length > 0 ? new Uint8Array(jpeg) : null;
    },

    stop,
    stopAll,

    /** Ends everything, the relay too (quitting). */
    async close() {
      framing?.kill('SIGKILL');
      await stopAll();
      if (relay) await (await relay).close();
      relay = null;
    },

    /** The file a request for `/transcode/<id>/<name>` reads, or null: only files of a running conversion. */
    file(requestPath) {
      const match = /^\/transcode\/([0-9a-f]{24})\/(?:(video|audio[0-7])\/)?(index\.m3u8|init(?:_\d+)?\.mp4|s\d{5}\.m4s)(?:\?.*)?$/.exec(
        requestPath,
      );
      if (!match || !running.has(match[1])) return null;
      return path.join(running.get(match[1]).folder, ...(match[2] ? [match[2]] : []), match[3]);
    },
  };
}
