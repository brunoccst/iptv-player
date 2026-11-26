// The starter (DECISIONS.md#d-250). It imports only Electron itself and loads the app (app.mjs) afterwards, so that an
// installed copy that is broken (a missing file or package, an error while starting) still opens something: the
// rescue window (rescue.mjs), with an Update button, instead of a crash dialog the user cannot get out of.
// Keep this file free of other imports: whatever it imports statically can break it.
import { app } from 'electron';

async function start() {
  try {
    // IPTV_DESKTOP_FORCE_START_ERROR: tests of the rescue window.
    if (process.env.IPTV_DESKTOP_FORCE_START_ERROR) throw new Error(process.env.IPTV_DESKTOP_FORCE_START_ERROR);
    const { started } = await import('./app.mjs');
    await started;
  } catch (error) {
    console.error('The app could not start:', error);
    try {
      const { showRescue } = await import('./rescue.mjs');
      await showRescue(error);
    } catch (rescueError) {
      // Even the rescue failed: say so, once, and quit rather than leave an invisible process.
      console.error('The rescue window could not open:', rescueError);
      app.exit(1);
    }
  }
}

// Not awaited at the top level: a module that waits for the app to start blocks tools that wait for the main module.
void start();
