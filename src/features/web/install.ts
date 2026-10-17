import { Platform } from 'react-native';

/**
 * On an iPhone, Fuel runs as a website. Added to the Home Screen it opens full
 * screen from its own icon, like an app; these say when to suggest that.
 */

type Nav = { userAgent: string; platform?: string; maxTouchPoints?: number; standalone?: boolean };

const DISMISSED_KEY = 'fuel-install-hint-dismissed';

/** An iPhone or iPad browser (iPads say they're Macs, but with a touch screen). */
export function isAppleMobile(nav: Nav): boolean {
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
}

function browser(): (Window & { navigator: Nav }) | null {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? (window as unknown as Window & { navigator: Nav }) : null;
}

/** True when opened from the Home Screen rather than in Safari. */
export function isStandalone(): boolean {
  const w = browser();
  if (!w) return false;
  return w.navigator.standalone === true || w.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function shouldShowInstallHint(nav: Nav | null, standalone: boolean, dismissed: boolean): boolean {
  return nav !== null && isAppleMobile(nav) && !standalone && !dismissed;
}

/** Whether to suggest adding Fuel to the Home Screen on this browser, now. */
export function installHintWanted(): boolean {
  const w = browser();
  if (!w) return false;
  let dismissed = false;
  try {
    dismissed = w.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    // Private browsing: show it; dismissing then lasts until the page closes.
  }
  return shouldShowInstallHint(w.navigator, isStandalone(), dismissed);
}

export function dismissInstallHint() {
  try {
    browser()?.localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Nothing to remember it in.
  }
}

/** The browser's user agent on the web, else null. */
export function userAgent(): string | null {
  return browser()?.navigator.userAgent ?? null;
}
