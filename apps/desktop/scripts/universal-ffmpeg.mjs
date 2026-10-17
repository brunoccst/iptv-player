// macOS builds one app for Intel and Apple silicon (D-071); ffmpeg-static installs FFmpeg for the build machine only.
// This adds the other architecture's binary and joins both with lipo, so the converter (D-189) runs on every Mac.
// Elsewhere it does nothing. Run before electron-builder (`npm run dist`).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

if (process.platform === 'darwin') {
  const require = createRequire(import.meta.url);
  const ffmpeg = require('ffmpeg-static');
  const archs = execFileSync('lipo', ['-archs', ffmpeg], { encoding: 'utf8' }).trim().split(/\s+/);
  if (archs.includes('x86_64') && archs.includes('arm64')) {
    console.log('FFmpeg is already universal');
  } else {
    const other = archs.includes('arm64') ? 'x64' : 'arm64';
    const folder = mkdtempSync(path.join(tmpdir(), 'ffmpeg-'));
    const download = path.join(folder, 'ffmpeg');
    // ffmpeg-static's own installer, for the other architecture, into a folder of its own.
    execFileSync(process.execPath, [require.resolve('ffmpeg-static/install.js')], {
      stdio: 'inherit',
      env: { ...process.env, FFMPEG_BIN: download, npm_config_arch: other },
    });
    execFileSync('lipo', ['-create', ffmpeg, download, '-output', ffmpeg]);
    rmSync(folder, { recursive: true, force: true });
    console.log(`FFmpeg is universal: ${execFileSync('lipo', ['-archs', ffmpeg], { encoding: 'utf8' }).trim()}`);
  }
}
