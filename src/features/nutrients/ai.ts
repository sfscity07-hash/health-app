import { FunctionsHttpError } from '@supabase/supabase-js';

import type { MicroKey } from '@/features/nutrients/micros';
import { requireSupabase } from '@/lib/supabase';

/**
 * Asking Claude about foods that still have no data, through the
 * estimate-nutrients Edge Function (which holds the Claude key; the app never
 * sees it). Each food is asked about once; the answer is saved on the food.
 */

/** What happened, in a word the Nutrients screen can explain. */
export type AiStatus = 'done' | 'limited' | 'not_deployed' | 'not_configured' | 'not_set_up' | 'not_allowed' | 'bad_key' | 'offline' | 'failed';

/** Foods per request; the function takes up to 6 and answers within its time limit. */
export const AI_BATCH = 6;

export async function askAi(foods: { id: string; missing: MicroKey[] }[]): Promise<{ status: AiStatus; estimated: number }> {
  const { data, error } = await requireSupabase().functions.invoke('estimate-nutrients', { body: { foods: foods.slice(0, AI_BATCH) } });
  if (error) {
    if (!(error instanceof FunctionsHttpError)) return { status: 'offline', estimated: 0 };
    const response = error.context as Response;
    if (response.status === 404) return { status: 'not_deployed', estimated: 0 };
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    const known: AiStatus[] = ['not_configured', 'not_set_up', 'not_allowed', 'bad_key'];
    const code = known.find((k) => k === body?.error);
    return { status: code ?? 'failed', estimated: 0 };
  }
  const results = ((data as { results?: { status: string }[] } | null)?.results ?? []) as { status: string }[];
  return {
    status: (data as { limited?: boolean } | null)?.limited ? 'limited' : 'done',
    estimated: results.filter((r) => r.status === 'estimated' || r.status === 'nothing').length,
  };
}

/** A sentence for the Nutrients screen, or null when there's nothing to say. */
export function aiMessage(status: AiStatus | undefined): string | null {
  switch (status) {
    case 'limited':
      return 'AI estimates reached today’s limit. The rest are asked tomorrow.';
    case 'not_deployed':
      return 'AI estimates aren’t set up yet: deploy the estimate-nutrients function (see the README).';
    case 'not_configured':
      return 'AI estimates need your Claude key: add ANTHROPIC_API_KEY to the function’s secrets in Supabase.';
    case 'bad_key':
      return 'Claude didn’t accept the key in the function’s secrets. Check ANTHROPIC_API_KEY in Supabase.';
    case 'not_set_up':
      return 'AI estimates need the newest SQL file (ai_estimates) run in Supabase.';
    case 'not_allowed':
      return 'AI estimates are turned off for this account (AI_ALLOWED_EMAILS).';
    case 'offline':
      return 'Couldn’t reach AI estimates. They’re tried again next time.';
    case 'failed':
      return 'AI estimates didn’t work this time. They’re tried again next time.';
    default:
      return null;
  }
}
