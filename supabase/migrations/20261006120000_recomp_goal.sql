-- Adds the "recomp" goal (lose fat and build muscle at the same time).
-- Safe to run more than once.
alter type public.goal_type add value if not exists 'recomp' after 'lose';
