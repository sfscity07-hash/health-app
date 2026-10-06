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
2. Open **SQL Editor**, then paste and run each file in [`supabase/migrations`](supabase/migrations), oldest first:
   1. `20261006090000_initial_schema.sql` (tables, privacy rules, daily summary)
   2. `20261006090100_exercise_catalog.sql` (the list of activities)
3. Go to **Project Settings → API Keys** and copy the **Project URL** and the **publishable** (or `anon`) key.
4. Copy `.env.example` to `.env` and paste both values in.
5. Stop and restart `npx expo start`. The Profile tab should now say **Connected to Supabase**.

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
