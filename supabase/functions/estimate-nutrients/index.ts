// Fuel's AI estimates: fills in the vitamins, minerals and caffeine a food's
// label and USDA don't give, using Claude. The Claude key is a secret of this
// function (ANTHROPIC_API_KEY); it never reaches the app or the repo.
//
// Secrets (Supabase → Edge Functions → Secrets, or `npx supabase secrets set`):
//   ANTHROPIC_API_KEY        required
//   AI_ALLOWED_EMAILS        optional, comma-separated: only these accounts can use AI
//   AI_DAILY_LIMIT_PER_USER  optional, default 40 calls per account per 24 hours
//   AI_DAILY_LIMIT_TOTAL     optional, default 100 calls for everyone per 24 hours
//
// Deploy: npx supabase functions deploy estimate-nutrients --project-ref <ref> --use-api --no-verify-jwt
// (the function checks the sign-in itself, which works with every kind of Supabase key).

import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

import { cleanAnswer, MODEL, NOTHING, parseRequest, SCHEMA, SYSTEM, userPrompt, withAi, type FoodRow, type Key } from './estimate.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const env = (name: string) => Deno.env.get(name)?.trim() ?? '';

/** The project's key from a named-key set ({"default": "sb_…"}) or the older single variable. */
function projectKey(set: string, single: string): string {
  try {
    const named = JSON.parse(env(set) || '{}') as Record<string, string>;
    if (named.default) return named.default;
  } catch {
    // Not JSON: fall back to the single key.
  }
  return env(single);
}

type Result = { id: string; status: 'estimated' | 'nothing' | 'skipped' | 'limited' | 'failed'; values?: Partial<Record<Key, number>> };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  const anthropicKey = env('ANTHROPIC_API_KEY');
  if (!anthropicKey) return reply({ error: 'not_configured' }, 503);

  // Who's asking: the user's own session, checked with Supabase Auth.
  const authorization = req.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  const publicKey = req.headers.get('apikey') || projectKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const supabase = createClient(env('SUPABASE_URL'), publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who, error: authError } = await supabase.auth.getUser(token);
  if (authError || !who.user) return reply({ error: 'signed_out' }, 401);
  const user = who.user;

  const allowed = env('AI_ALLOWED_EMAILS')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes((user.email ?? '').toLowerCase())) return reply({ error: 'not_allowed' }, 403);

  const request = parseRequest(await req.json().catch(() => null));
  if ('error' in request) return reply({ error: 'bad_request', detail: request.error }, 400);

  // The allowance is kept by the database, written only with the service role.
  const admin = createClient(env('SUPABASE_URL'), projectKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const perUser = Number(env('AI_DAILY_LIMIT_PER_USER')) || 40;
  const total = Number(env('AI_DAILY_LIMIT_TOTAL')) || 100;
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let setupProblem: string | null = null;

  async function estimate(ask: { id: string; missing: Key[] }): Promise<Result> {
    // Read as the user, so it can only be one of their own foods.
    const { data: food } = await supabase.from('foods').select('*').eq('id', ask.id).maybeSingle<FoodRow>();
    if (!food) return { id: ask.id, status: 'skipped' };
    if (food.micros_est?.ai) return { id: ask.id, status: 'skipped' };
    const missing = ask.missing.filter((k) => typeof food.micros?.[k] !== 'number');
    if (missing.length === 0) return { id: ask.id, status: 'skipped' };

    const { data: callId, error: allowanceError } = await admin.rpc('take_ai_call', {
      for_user: user.id,
      call_kind: 'nutrients',
      call_food: food.id,
      per_user: perUser,
      total,
    });
    if (allowanceError) {
      setupProblem = allowanceError.message;
      return { id: ask.id, status: 'failed' };
    }
    if (callId === null) return { id: ask.id, status: 'limited' };

    try {
      const response = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        // If a safety classifier declines, the API retries on the model Anthropic recommends for that case.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt(food, missing) }],
      });
      await admin
        .from('ai_calls')
        .update({ model: response.model, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens })
        .eq('id', callId);

      const text = response.stop_reason === 'refusal' ? null : response.content.find((b) => b.type === 'text');
      const answer = text && text.type === 'text' ? cleanAnswer(JSON.parse(text.text), missing, food) : null;
      const ai = answer ? { model: response.model, ...answer } : NOTHING(response.model);
      // Saved as the user (their own food only). Asked once: "nothing" is kept too, so it isn't asked again.
      const { error: saveError } = await supabase
        .from('foods')
        .update({ micros_est: withAi(food.micros_est, ai) })
        .eq('id', food.id);
      if (saveError) return { id: ask.id, status: 'failed' };
      return answer ? { id: ask.id, status: 'estimated', values: answer.values } : { id: ask.id, status: 'nothing' };
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) setupProblem = 'bad_key';
      if (e instanceof Anthropic.RateLimitError) return { id: ask.id, status: 'limited' };
      console.error('estimate failed', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
      return { id: ask.id, status: 'failed' };
    }
  }

  const results = await Promise.all(request.foods.map(estimate));
  if (setupProblem) return reply({ error: setupProblem === 'bad_key' ? 'bad_key' : 'not_set_up', results }, 503);
  return reply({ results, limited: results.some((r) => r.status === 'limited') });
});
