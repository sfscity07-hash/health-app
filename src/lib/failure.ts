import { DB_UPDATE_NEEDED, isDatabaseBehind } from '@/features/auth/errors';
import { useToast } from '@/store/toast';

/** Screens close as soon as you save, so failures are reported with a toast rather than on the screen. */
export const reportFailure = (what: string, error: unknown) =>
  useToast
    .getState()
    .show(isDatabaseBehind(error) ? DB_UPDATE_NEEDED : `Couldn’t ${what}. Check your connection and try again.`, 'warn');
