import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Ports differ from the dev defaults so e2e runs never collide with a running dev stack. */
export const E2E = {
  panelUrl: 'http://localhost:8091',
  apiUrl: 'http://localhost:5091',
  webUrl: 'http://localhost:4174',
  username: 'demo',
  password: 'demo',
} as const;
