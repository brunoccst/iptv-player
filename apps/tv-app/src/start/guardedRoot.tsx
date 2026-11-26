/* eslint-disable @typescript-eslint/no-require-imports -- loading the app lazily, inside the guard, is the point (D-251) */
import { Component, type ComponentType, type ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * The app's root with a safety net (D-251): `loadApp` (which requires the app's modules) and the app's own drawing
 * run inside it, so an error while starting shows "The app could not start" with an Update now button instead of a
 * crash the user cannot get out of. `loadScreen` is required only when needed, so the screen's own imports cannot take
 * the guard down with them; the last resort is the error as plain text.
 */
export function createGuardedRoot(
  loadApp: () => ComponentType,
  loadScreen: () => ComponentType<{ error: unknown }> = () => require('./StartFailedScreen').StartFailedScreen,
): ComponentType {
  let app: ComponentType | null = null;
  let loadError: unknown = null;
  try {
    app = loadApp();
  } catch (error) {
    console.error('The app could not load:', error);
    loadError = error;
  }

  function Failed({ error }: { error: unknown }) {
    let Screen: ComponentType<{ error: unknown }>;
    try {
      Screen = loadScreen();
    } catch {
      return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#14161a' }}>
          <Text style={{ color: '#fff' }}>{String((error as Error)?.message ?? error)}</Text>
        </View>
      );
    }
    return <Screen error={error} />;
  }

  class Boundary extends Component<{ children: ReactNode }, { error: unknown; failed: boolean }> {
    state = { error: null as unknown, failed: false };
    static getDerivedStateFromError(error: unknown) {
      return { error, failed: true };
    }
    componentDidCatch(error: unknown) {
      console.error('The app stopped while drawing:', error);
    }
    render() {
      return this.state.failed ? <Failed error={this.state.error} /> : this.props.children;
    }
  }

  const App = app;
  return function GuardedRoot() {
    return App ? (
      <Boundary>
        <App />
      </Boundary>
    ) : (
      <Failed error={loadError} />
    );
  };
}
