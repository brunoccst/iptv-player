import { appLog } from '@iptv/shared';
import { TvMedia } from '../modules/tv-media';

/**
 * What the Log needs to explain a crash (D-113, issue #109): the memory the app may use on this device, and the native
 * crash that ended the last run (an `OutOfMemoryError` ends the process before JavaScript can log it).
 */
export function logStartup() {
  try {
    const memory = TvMedia.memoryInfo();
    appLog.info(
      'app',
      `memory: Java heap ${memory.javaHeapMaxMb} MB (${memory.javaHeapUsedMb} MB used, standard ${memory.memoryClassMb} MB, large ${memory.largeMemoryClassMb} MB), device RAM ${memory.deviceRamMb} MB (${memory.deviceFreeRamMb} MB free)${memory.lowRamDevice ? ', low-RAM device' : ''}`,
    );
  } catch {
    // Older builds of the native module: nothing to report.
  }
  let crash: string | null;
  try {
    crash = TvMedia.takeLastCrash();
  } catch {
    crash = null;
  }
  if (crash) {
    const lines = crash.trim().split('\n');
    const reason = lines[1] ?? lines[0] ?? '';
    const outOfMemory = /OutOfMemoryError/.test(crash);
    appLog.error(
      'crash',
      `the app stopped last time${outOfMemory ? ' (out of memory)' : ''}: ${reason}\n${lines.slice(0, 1).concat(lines.slice(2)).join('\n')}`,
    );
  }
}
