// Plays what Chromium cannot decode (issue #236, DECISIONS.md#d-189): the FFmpeg bundled with the app (ffmpeg-static)
// reads the provider's stream and writes HLS with H.264 video and AAC audio into a temporary folder, which the app's
// own server hands to the page's hls.js. Video Chromium decodes (H.264, HEVC with a decoder) is copied, not converted.
// FFmpeg reads the provider through a relay in this process (`createRelay`), which also sends the player User-Agent.
import { spawn as spawnProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
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
  const track = probe.audio[audio] ? audio : 0;
  if (probe.audio.length > 0) args.push('-map', `0:a:${track}`);
  args.push('-sn', '-dn');
  if (copyVideo) {
    args.push('-c:v', 'copy');
    if (probe.video?.codec === 'hevc') args.push('-tag:v', 'hvc1');
  } else {
    // Software H.264, at most 1080 lines: 4K would be too slow to convert on most computers.
    const filters = [];
    if (probe.video?.hdr && tonemap)
      filters.push('zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv');
    if ((probe.video?.height ?? 0) > 1080) filters.push('scale=-2:1080');
    filters.push('format=yuv420p');
    args.push('-vf', filters.join(','), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21');
    // A key frame at every segment start, so every segment can be played on its own.
    args.push('-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_SECONDS})`);
  }
  const audioCodec = probe.audio[track]?.codec;
  if (audioCodec && PLAYABLE_AUDIO.has(audioCodec)) args.push('-c:a', 'copy');
  else args.push('-c:a', 'aac', '-ac', '2', '-b:a', '192k');
  args.push(
    '-f',
    'hls',
    '-hls_time',
    String(SEGMENT_SECONDS),
    '-hls_segment_type',
    'fmp4',
    '-hls_fmp4_init_filename',
    'init.mp4',
    '-hls_segment_filename',
    `${toFfmpegPath(folder)}/s%05d.m4s`,
  );
  // Live: a moving window of segments; films and episodes: every segment stays, so going back needs no new conversion.
  if (live) args.push('-hls_list_size', '10', '-hls_flags', 'delete_segments+temp_file+independent_segments');
  else args.push('-hls_list_size', '0', '-hls_playlist_type', 'event', '-hls_flags', 'temp_file+independent_segments');
  args.push(`${toFfmpegPath(folder)}/index.m3u8`);
  return args;
}

/** Answer headers FFmpeg needs to read and seek in a file. */
const RELAYED_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges'];

/**
 * Hands FFmpeg the provider's streams from 127.0.0.1. The Linux FFmpeg build is static and crashes when it looks up a
 * host name itself; here Node does it (and TLS, redirects), and adds the User-Agent. `local(url)`: the address FFmpeg
 * opens; relative addresses inside an HLS playlist stay on the same relay.
 */
export async function createRelay({ userAgent, fetch: fetchUrl = fetch }) {
  /** token → provider origin */
  const origins = new Map();
  const server = createServer(async (request, response) => {
    const [, token, rest = ''] = /^\/([0-9a-f]{24})(\/.*)?$/.exec(request.url ?? '') ?? [];
    const origin = token && origins.get(token);
    if (!origin) return response.writeHead(404).end();
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
      const parsed = new URL(url);
      const token = randomBytes(12).toString('hex');
      origins.set(token, parsed.origin);
      return `${base}/${token}${parsed.pathname}${parsed.search}`;
    },
    /** Forgets every address handed out. */
    clear: () => origins.clear(),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
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
export function createTranscoder({ ffmpeg, root, userAgent, spawn = spawnProcess }) {
  /** id → { process, folder } */
  const running = new Map();
  let tonemap = null;
  let relay = null;
  const local = async (url) => {
    relay ??= createRelay({ userAgent });
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
      if (!/^https?:\/\//i.test(url)) throw new Error('Only provider streams can be read');
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
      if (!/^https?:\/\//i.test(url)) throw new Error('Only provider streams can be converted');
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
      const playlist = path.join(folder, 'index.m3u8');
      await new Promise((resolve, reject) => {
        const started = Date.now();
        const fail = (message) => {
          clearInterval(timer);
          void stop(id);
          reject(new Error(message));
        };
        const timer = setInterval(() => {
          if (!running.has(id)) return fail('Conversion stopped');
          if (existsSync(playlist) && /\.m4s/.test(readFileSync(playlist, 'utf8'))) {
            clearInterval(timer);
            resolve();
          } else if (child.exitCode !== null) fail(`FFmpeg ended (${child.exitCode}): ${tail(text)}`);
          else if (Date.now() - started > START_TIMEOUT_MS) fail('Conversion did not start in time');
        }, 200);
      });
      return { id, playlist: `/transcode/${id}/index.m3u8`, duration: live ? null : probe.duration, at: live ? 0 : Math.floor(at) };
    },

    stop,
    stopAll,

    /** Ends everything, the relay too (quitting). */
    async close() {
      await stopAll();
      if (relay) await (await relay).close();
      relay = null;
    },

    /** The file a request for `/transcode/<id>/<name>` reads, or null: only files of a running conversion. */
    file(requestPath) {
      const match = /^\/transcode\/([0-9a-f]{24})\/(index\.m3u8|init\.mp4|s\d{5}\.m4s)(?:\?.*)?$/.exec(requestPath);
      if (!match || !running.has(match[1])) return null;
      return path.join(running.get(match[1]).folder, match[2]);
    },
  };
}
