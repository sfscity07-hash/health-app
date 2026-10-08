/**
 * Which milestones you've already been shown, kept on this device so a new
 * one is celebrated once. Uses localStorage (expo-sqlite provides it on the
 * phone); if it isn't there, nothing is celebrated rather than everything.
 */
const key = (userId: string) => `fuel.seenMilestones.${userId}`;

export function readSeen(userId: string): string[] | null {
  try {
    const raw = globalThis.localStorage?.getItem(key(userId));
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

export function writeSeen(userId: string, keys: string[]) {
  try {
    globalThis.localStorage?.setItem(key(userId), JSON.stringify(keys));
  } catch {
    // Not fatal: at worst a milestone is celebrated again.
  }
}
