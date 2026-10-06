# Fuel — calorie & macro tracker

A personal Android calorie tracker that costs nothing to run (Expo + Supabase free tier), with a premium, MacroFactor-style experience:
fast food logging (search, barcode, quick add), macros, smart trend weight, an adaptive calorie budget, water, exercise, and weekly check-ins.

- **Plan:** [docs/PLAN.md](docs/PLAN.md) has every feature, the screen layout, the data model and the 13 build phases.
- **Approved design:** the [interactive design preview](https://claude.ai/artifact/BivetwmmHb2Ly4xxUkjqMq) is the visual reference for every screen.
- **Status:** Phase 1 (foundation) is done. The app runs with the theme, fonts, floating tab bar and placeholder screens. Real features start in Phase 2.

## Run it on your Android phone (free)

1. Install [Node.js](https://nodejs.org) (the LTS version) on your computer.
2. In this folder, run `npm install`.
3. Install **Expo Go** from the Play Store on your phone.
4. Run `npx expo start` and scan the QR code with Expo Go. Your phone and computer need to be on the same Wi-Fi; if they aren't, use `npx expo start --tunnel`.

The app opens on the Dashboard. Try the + button, the tabs, and the theme switch under Profile.

## Connect your free Supabase backend

You only need this once. Sign-in and sync start working in Phase 2.

1. Create a free account at [supabase.com](https://supabase.com) and click **New project**. Pick the region closest to you and save the database password somewhere safe.
2. Open **SQL Editor**, then paste and run each file in [`supabase/migrations`](supabase/migrations) **once**, oldest first:
   1. `20261006090000_initial_schema.sql` (tables, privacy rules, daily summary)
   2. `20261006090100_exercise_catalog.sql` (the list of activities)

   "Success. No rows returned" means it worked. If you run a file a second time you'll see an error like `type "meal_type" already exists`. That's harmless: it stops at the first line and changes nothing.

   To check your setup, run this in the SQL Editor:

   ```sql
   select
     (select count(*) from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE') as tables,
     (select count(*) from pg_policies where schemaname = 'public') as privacy_rules,
     (select count(*) from public.exercises) as exercises;
   ```

   You should see **13** tables, **18** privacy rules and **29** exercises.
3. Copy your **Project URL** and your **key**:

   | What | Where in Supabase | What it looks like |
   |---|---|---|
   | Project URL | Project Settings → **Data API**, or the **Connect** button at the top | `https://abcdefghijklmnopqrst.supabase.co` (20 lowercase letters, then `.supabase.co`) |
   | Publishable key (newer projects) | Project Settings → **API Keys** | `sb_publishable_9xQ2c7LmTq4ZbR1vN8wKpA_3fYhD0sE` |
   | `anon` key (older projects) | Project Settings → API Keys → **Legacy API Keys** | A very long token starting with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.`, split into three parts by dots |

   Use the publishable key if you have one; otherwise the `anon` key.

   > ⚠️ Never use a key that starts with `sb_secret_` or is labelled `service_role`. Those skip every privacy rule and must never go in the app.
4. Copy `.env.example` to a new file named `.env` in this folder and paste in your values. It should look like this (with your own values):

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_9xQ2c7LmTq4ZbR1vN8wKpA_3fYhD0sE
   ```

   Common mistakes:
   - The file must be named exactly `.env`. Windows Notepad sometimes saves it as `.env.txt`.
   - No quotes, and no spaces around the `=`.
   - No `/` at the end of the URL.
5. Restart the app with `npx expo start --clear`. The Profile tab should now say **Connected to Supabase**.

> Free Supabase projects pause after 7 days without use. Logging every day keeps yours awake. If it does pause, press **Restore** in the Supabase dashboard.

## For development

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm test` | Unit and component tests (Jest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (Expo config) |
| `npm run db:verify` | Applies the migrations to a throwaway local Postgres and checks that every user only sees their own data (needs Postgres 15+ installed) |

```
src/
  app/            screens (Expo Router): (tabs)/ dashboard, food-log, progress, profile + log sheet
  components/ui/  Text, Card, Button, IconButton, Icon, SegmentedControl, AnimatedNumber, EmptyState, Screen
  components/navigation/FloatingTabBar.tsx
  theme/          design tokens (colors, type, spacing) and the theme provider
  lib/            supabase client, env, units, formatting, meals, haptics
  store/          small Zustand stores (UI preferences)
supabase/
  migrations/     database schema, privacy rules (RLS) and reference data
  tests/          database checks used by scripts/verify-db.sh
__tests__/        Jest tests
```
