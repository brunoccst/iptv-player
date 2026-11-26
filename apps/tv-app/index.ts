/* eslint-disable @typescript-eslint/no-require-imports -- loading the app lazily, inside the guard, is the point (D-251) */
import { registerRootComponent } from 'expo';
import { createGuardedRoot } from './src/start/guardedRoot';

// The app is loaded inside the guard (D-251): an error while loading or drawing it shows "The app could not start"
// with an Update now button instead of closing.
registerRootComponent(
  createGuardedRoot(() => {
    const { installSecureRandom } = require('./src/secureRandom');
    installSecureRandom();
    return require('./src/App').App;
  }),
);
