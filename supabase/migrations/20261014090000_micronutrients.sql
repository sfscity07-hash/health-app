-- Micronutrients, salt and caffeine on your foods. Safe to run more than once.
--
-- micros: what the label or database lists, per 100 g, e.g.
--   {"sodium_mg": 43, "calcium_mg": 113, "caffeine_mg": 0}
--   null until it's been looked up; {} when the source lists nothing.
-- micros_est: estimates for what the label doesn't list, marked as such:
--   {"by": "usda", "from": "Yogurt, Greek, plain, nonfat", "values": {...}}
--   by is "usda" (USDA's generic version of the same food), "recipe" (added
--   up from its ingredients), "ai" (later) or "none" (nothing to borrow).
-- Logs don't copy these: a day's totals come from each food and the grams you
-- logged, so foods looked up later fill in your past days too.

alter table public.foods
  add column if not exists micros jsonb
    check (micros is null or (jsonb_typeof(micros) = 'object' and pg_column_size(micros) <= 4000));

alter table public.foods
  add column if not exists micros_est jsonb
    check (micros_est is null or (jsonb_typeof(micros_est) = 'object' and pg_column_size(micros_est) <= 6000));
