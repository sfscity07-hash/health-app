import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Over-the-air updates (EAS Update): the installed app downloads new versions
 * of the JavaScript by itself, so most changes need no new APK. Only the
 * installed app can; Expo Go, the web version and tests have no updates module.
 */
type UpdatesModule = typeof import('expo-updates');

function load(): UpdatesModule | null {
  const modules = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo?.modules;
  if (!modules?.ExpoUpdates) return null;
  // Required only when the native module is there: importing it without one throws.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-updates') as UpdatesModule;
}

const Updates = load();

/** True in the installed app once it's linked to EAS Update (never in Expo Go). */
export const updatesEnabled = Boolean(Updates?.isEnabled);

/** The id of the JavaScript running now (what came in the APK has one too); null in Expo Go. */
export const updateId = Updates?.isEnabled ? Updates.updateId : null;

/** "1.0.0 · update of 14 Oct, 18:05", or just the version when running what came in the APK. */
export function versionLabel(version: string): string {
  const at = Updates?.isEnabled && !Updates.isEmbeddedLaunch ? Updates.createdAt : null;
  if (!at) return version;
  const day = at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const time = at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${version} · update of ${day}, ${time}`;
}

export type UpdateCheck = 'idle' | 'checking' | 'latest' | 'ready' | 'offline';

/** Downloads a new version if there is one. 'ready' means restart() opens it. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  if (!Updates?.isEnabled) return 'latest';
  try {
    const found = await Updates.checkForUpdateAsync();
    if (!found.isAvailable) return 'latest';
    const got = await Updates.fetchUpdateAsync();
    return got.isNew ? 'ready' : 'latest';
  } catch {
    return 'offline';
  }
}

/** Restarts into the version downloaded last. */
export function restart() {
  Updates?.reloadAsync().catch(() => {});
}

// The app checks by itself when it starts (and downloads in the background);
// coming back to it after a while checks again.
const RECHECK_MS = 60 * 60 * 1000;

/** True once a new version has downloaded and a restart would open it. */
export function useUpdateReady(): boolean {
  const [ready, setReady] = useState(() => Boolean(Updates?.isEnabled && Updates.latestContext?.isUpdatePending));

  useEffect(() => {
    if (!Updates?.isEnabled) return;
    let last = Date.now();
    // Picks up the download the app started by itself at launch.
    const sub = Updates.addUpdatesStateChangeListener(({ context }) => {
      if (context.isUpdatePending) setReady(true);
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || Date.now() - last < RECHECK_MS) return;
      last = Date.now();
      checkForUpdate().then((r) => {
        if (r === 'ready') setReady(true);
      });
    });
    return () => {
      sub.remove();
      app.remove();
    };
  }, []);

  return ready;
}
