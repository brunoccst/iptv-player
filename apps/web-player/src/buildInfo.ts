declare const __BUILD_INFO__: { commit: string; date: string } | undefined;

/** Commit and time of this build (set by vite.config.ts; empty in tests and local builds without a commit). */
export const buildInfo: { commit: string; date: string } =
  typeof __BUILD_INFO__ === 'undefined' ? { commit: '', date: '' } : __BUILD_INFO__;
