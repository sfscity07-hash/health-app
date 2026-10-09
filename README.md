# Fuel — calorie & macro tracker

A personal Android calorie tracker that costs nothing to run (Expo + Supabase free tier), with a premium, MacroFactor-style experience:
fast food logging (search, barcode, quick add), macros, smart trend weight, an adaptive calorie budget, water, exercise, and weekly check-ins.

- **Plan:** [docs/PLAN.md](docs/PLAN.md) has every feature, the screen layout, the data model and the 13 build phases.
- **Approved design:** the [interactive design preview](https://claude.ai/artifact/BivetwmmHb2Ly4xxUkjqMq) is the visual reference for every screen.
- **Status:** Phases 1–12 are done, plus recipes (13, polish and the installable app, is next). See [What works right now](#what-works-right-now) before you try a new version.

## What works right now

Updated with every release. **Latest: Recipes (build a dish from its ingredients, log it by the gram, swap an ingredient, use it inside another recipe).**

**Before running this version:**
1. `git pull`, then `npm ci`, then `npx expo start --clear`. No new packages this time.
2. **New SQL:** in Supabase's SQL Editor, run `supabase/migrations/20261010090000_recipes.sql` once. It adds the two tables recipes are kept in. Until you run it, Recipes shows "Your database is missing an update"; everything else works. (Skipped Phase 12's `20261009090000_account_and_workouts.sql`? Run that too, first.)

✅ **Works**
- Create an account, sign in, sign out.
- Setup: goal (lose weight, **recomp**, maintain, build muscle), body stats in kg/cm or lb/ft, activity, goal weight and pace, then your animated daily budget.
- **Logging food** (the **+** button, or "Add …" on the dashboard and Food log):
  - Recent foods for the meal you're logging, most-eaten first; tap **+** to log the same amount again in one tap.
  - **Search**: type a food and you get your own foods first, then results from **USDA** (whole foods like "bananas, raw") and **Open Food Facts** (packaged products, worldwide). Tap a result to pick the amount (servings like "1 medium" or "1 slice", or grams), or tap **+** to log one serving straight away. Each food shows once: the same food from several databases or shops is merged, entries with impossible numbers are dropped, and anything already in Recent or Your foods isn't repeated. British and American spellings both work ("yoghurt" finds "yogurt"), entries named only after their brand get a description or are skipped, and results from what you typed a moment ago fade out while the new ones load.
  - **Quick add**: just calories, or macros and it works the calories out. Fibre is optional.
  - **New food**: copy a nutrition label, including **fibre**. Choose how you measure it (grams, scoop, cup, tbsp, tsp, slice, piece, bar, ml, or your own word) and whether the label's numbers are per scoop or per 100 g, then add more units if you like (1 scoop = 30 g, 1 tbsp = 10 g). It's saved for next time.
  - Food screen: switch units (the food's own, plus grams and ounces for everything), tap **+ Unit** to add a scoop, cup or anything else to a food, tap the number to type it, or drag the ruler. See what it does to your day before you add it. Star it as a favorite.
  - **Scan a barcode** (the Scan button, or the barcode icon in the search bar): your own foods come up instantly, then Open Food Facts, then USDA's US products. If nobody knows the barcode, **Create this food** opens with the barcode filled in, so the next scan finds it. A torch button helps in dim light, and **Type the number instead** works for crumpled barcodes (typos are caught by the check digit).
  - Tap the meal name at the top of the logger to switch meal.
  - Tap anything you've logged (dashboard or Food log) to change the amount or meal, or delete it.
- **Fibre**: tracked on everything you log, with a daily target of 14 g per 1,000 kcal (shown on the dashboard, Food log, food screen and Profile).
- **Weight** (tap the Trend weight tile on the dashboard, or **Weigh in** on Progress): drag the ruler or tap the number to type, in kg or lb; step back to log a day you missed; open an old weigh-in to change or delete it. Mornings without a weigh-in get a gentle nudge on the dashboard.
- **Progress tab**, top to bottom:
  - **Goal journey**: your trend weight on a track from where you started to your goal, with a notch every 2.5 kg, how much you've lost (or gained) and the percentage, the next milestone with how many days away it is at your pace, and when you'll reach your goal.
  - **Weight chart**: scale weigh-ins as dots, the smoothed trend as the line, your goal when it's in view, for 2 weeks up to all time. Press and drag to read any day. Weekly rate and number of weigh-ins underneath.
  - **Calories**: the last 7 days as bars against your budget (the dashed line, which steps if a check-in changed it). Today is highlighted and days more than 5% over are orange. Tap a bar to read it.
  - **Macros**: where your calories came from on average this past week (protein / carbs / fat split, grams against your targets) and how many days you hit your protein target.
  - **Milestones**: badges that fill up before you earn them: perfect week, 7- and 30-day streaks, protein week, first 5 kg (10 lb), halfway, goal weight, 4 check-ins. The ones you're close to glow; tap one to see how to earn it. Earning a badge, or passing a 2.5 kg mark, gets a small celebration the next time you open Progress (once each).
  - **Consistency**: your streak and best streak, and 13 weeks of days on one grid (not logged, logged, finished).
  - Every weigh-in, tap to change.
- **Food log tab**: your day meal by meal with calories, macros and fibre; step back through earlier days.
- **Saved meals and copying** (the **⋯** button on any meal in the Food log):
  - **Save as a meal**: name it ("Usual breakfast" is suggested), untick anything you don't want, save. Quick adds are kept with their numbers.
  - **Saved** in the logger lists your meals; tap **+** to add a whole meal in one tap, or tap the meal to rename it, take foods out, pick which meal to add it to, or delete it. Searching in the logger finds saved meals by name too.
  - **Copy to today** (on past days), or **Copy to another day**: any day up to a week ahead, into any meal ("copy yesterday's snacks to tomorrow's lunch").
  - Under the meals: **Copy this day to today** (on past days) and **Copy … to another day**, which copy every food into its own meal.
- **Recipes** (the **Recipes** button in the logger): anything you make from several foods, like a marinade, a curry or a smoothie.
  - **New recipe**: name it, then **Add ingredient** for everything that went in: your own foods, anything from USDA or Open Food Facts (search "ghee", "paneer", "greek yoghurt"), recent foods, or **another recipe**. Tap **+** for the usual amount, or tap the food to pick it in tbsp, grams, slices or any of its units.
  - **Quick ingredient (just the numbers)**: for a spice mix or anything that isn't a food in Fuel. Calories (or macros), weight optional.
  - The card at the top adds it all up as you go: the whole batch's calories, protein, carbs, fat and fibre, what it weighs, per 100 g and per serving.
  - **Finished weight** (optional): weigh the dish after cooking, without the pot. Cooking drives off water, so this makes every gram you log exact. Leave it empty and the ingredients' weights are added up.
  - **Servings** (optional): split the batch into servings to get a "serving" unit.
  - **Log it like any food**: by the gram, the serving, ounces or the **whole batch**. 50 g of the marinade gets exactly 50/520 of the ghee, paneer and everything else.
  - **Change it later**: open the recipe (from Recipes, Recent or search, where it's tagged RECIPE), tap **Edit**, then tap any ingredient to **change its amount**, **swap it for another food** (paneer → soya chaap keeps the same 400 g) or remove it.
  - **Save as a new recipe** keeps the original and saves your changed one under a new name, so you can have a paneer and a soya chaap version.
  - **Recipes inside recipes**: a taco with 50 g of the marinade, a slice of cheddar and a tortilla.
  - What you already logged keeps its numbers when you change or delete a recipe.
- Dashboard:
  - calorie gauge
  - protein/carbs/fat bars
  - week rings (tap a day this week to look back at it; the logger then adds to that day)
  - insight card (tap for the next one)
  - trend weight, and your expenditure (marked ADAPTIVE once it's learning from your logs)
  - pull down to refresh
- **Water**: the **+** on the dashboard's Water tile adds a glass in one tap. Tap the tile for the Water screen: add a glass, bottle or large bottle (or type any amount), see each drink with its time and remove one you added by mistake, and change your daily goal. Hitting the goal gets a little celebration. Shown in L, or fl oz if you chose imperial units.
- **Exercise** (tap the Exercise tile on the dashboard, or **+** on the Exercise card at the bottom of the Food log):
  - Pick from the activity list (search works with everyday words: "jog", "weights", "gym", "spin"), drag the ruler or tap to type the minutes.
  - **Calories that fit you**: worked out from your weight, age, sex and height (your own resting burn, not a textbook average). Walking and running use your **speed and incline**; everything else has an **effort** setting (easy / moderate / hard). Add your **average heart rate** from a watch and it's used instead (the most accurate). Under the number, a line shows exactly what went into it.
  - Or **Type calories from my watch**: a name, the calories, and minutes if you like.
  - **Recent** workouts log again in one tap with **+**. Tap a logged workout to change or delete it.
  - Calories are *active* calories (on top of what you'd burn resting anyway), the same number watches show.
  - **Add exercise to my budget** (on the Exercise screen, or in Profile) is off by default: your budget already includes your usual activity, and watch numbers often run high. Turn it on and the day's burn is added to that day's budget ("Budget + ex." on the gauge).
- **Weekly check-in and adaptive budget**:
  - **Expenditure** (the dashboard tile) is what you burn in a day. It starts from a formula (your stats and activity level), then learns from the last 3 weeks: what you ate on the days you logged and how your trend weight moved. It needs 7 logged days and 3 weigh-ins before it starts learning, moves at most 300 kcal a week so one odd week can't throw it, and ignores half-logged days (finished days always count).
  - Every Monday a **check-in** card appears on the dashboard. Four short cards: how many days you logged, what your trend did against your plan, your expenditure (with a bar chart of past weeks), and **next week's budget**. Adjust it with − / + and see the protein, carbs and fat and your goal date move, then **Start next week**, or keep your current budget.
  - Old days stay judged against the budget you had then, so lowering it doesn't turn last week orange.
  - You can open the check-in any time from the Expenditure tile or Profile → **Open weekly check-in**. Doing it again in the same week replaces that week's.
- **Finish today** (or yesterday, if you forgot): closes the day's ring, extends your streak, celebrates.
- **Profile**:
  - **Edit goals & targets**: goal (lose, recomp, maintain, gain), goal weight, pace, activity level, daily calories (with the suggestion from your expenditure), and macros set in grams or percent (carbs fill what protein and fat leave), plus units (kg/lb).
  - **Reminders** (on your phone): morning weigh-in, log your lunch, finish your day, and Monday's check-in, each with its own switch and time. They skip themselves on days you've already done the thing, and tapping one opens the right screen.
  - **Export my data**: CSV files for everything you logged, daily totals (with your trend weight and each day's budget), your foods, and your check-ins. On your phone, send them to Drive, email or Files.
  - **Delete account**: type DELETE to permanently remove your account and every bit of your data.
  - Theme (system, dark or light), saved to your account.

🚧 **Not yet** (shows a placeholder or "Soon")
- Phase 13: loading skeletons, offline cache, the app icon and splash, and the installable APK.
- A recipe inside another recipe doesn't update by itself: after changing the marinade, open the taco, tap **Edit** and **Save recipe** to pick up the new numbers.
- Vitamins and minerals (micronutrients) aren't tracked yet.
- Steps from your phone or watch aren't read (Expo Go can't reach Health Connect).
- Reminders can't be tried on the web version, only in Expo Go or the installed app.

## Run it on your Android phone (free)

1. Install [Node.js](https://nodejs.org) (the LTS version) on your computer.
2. In this folder (the one that contains `package.json`; a downloaded ZIP may unzip into a folder inside a folder), run `npm install`.
3. Install **Expo Go** from the Play Store on your phone.
4. Run `npx expo start` and scan the QR code with Expo Go. Your phone and computer need to be on the same Wi-Fi; if they aren't, use `npx expo start --tunnel`.

The app opens on the welcome screen. Create an account, answer the setup questions, and you'll land on the dashboard with your daily budget.

> **Feels slow?** `npx expo start` runs a development build with debugging switched on, which makes every tap and animation slower. To try the app at real speed, use `npx expo start --no-dev --minify` instead. The installable app built in Phase 13 runs at full speed.

### Getting a new version

```
git pull
npm ci
npx expo start --clear
```

Use `npm ci` rather than `npm install` for updates: it installs exactly what's in `package-lock.json` and never rewrites it. If `git pull` says *"Your local changes to package-lock.json would be overwritten"*, an earlier `npm install` rewrote that file; run `git checkout -- package-lock.json`, then pull again. If `npm ci` fails with "EPERM" on Windows, stop `npx expo start` (Ctrl+C) or close your editor and run it again.

## Connect your free Supabase backend

You only need to do this once.

1. Create a free account at [supabase.com](https://supabase.com) and click **New project**. Pick the region closest to you and save the database password somewhere safe.
2. Open **SQL Editor**, then paste and run each file in [`supabase/migrations`](supabase/migrations) **once**, oldest first:
   1. `20261006090000_initial_schema.sql` (tables, privacy rules, daily summary)
   2. `20261006090100_exercise_catalog.sql` (the list of activities)
   3. `20261006120000_recomp_goal.sql` (adds the Recomp goal)
   4. `20261006150000_fibre.sql` (fibre on logged food and daily totals)
   5. `20261008090000_saved_meal_quick_adds.sql` (quick adds in saved meals)
   6. `20261009090000_account_and_workouts.sql` (delete account, workout details)
   7. `20261010090000_recipes.sql` (recipes)

   "Success. No rows returned" means it worked. If you run a file a second time you'll see an error like `type "meal_type" already exists`. That's harmless: it stops at the first line and changes nothing.

   To check your setup, run this in the SQL Editor:

   ```sql
   select
     (select count(*) from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE') as tables,
     (select count(*) from pg_policies where schemaname = 'public') as privacy_rules,
     (select count(*) from public.exercises) as exercises;
   ```

   You should see **15** tables, **22** privacy rules and **29** exercises.
3. Turn off email confirmation: go to **Authentication → Sign In / Providers → Email**, switch off **Confirm email**, and save.

   Fuel signs you in with an email and password. With confirmation on, every new account waits for an emailed link, and the free plan only sends a few emails an hour. If you leave it on, open the link from the email (the page it opens may not load, but your account is confirmed anyway), then sign in.
4. Copy your **Project URL** and your **key**:

   | What | Where in Supabase | What it looks like |
   |---|---|---|
   | Project URL | Project Settings → **Data API**, or the **Connect** button at the top | `https://abcdefghijklmnopqrst.supabase.co` (20 lowercase letters, then `.supabase.co`) |
   | Publishable key (newer projects) | Project Settings → **API Keys** | `sb_publishable_9xQ2c7LmTq4ZbR1vN8wKpA_3fYhD0sE` |
   | `anon` key (older projects) | Project Settings → API Keys → **Legacy API Keys** | A very long token starting with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.`, split into three parts by dots |

   Use the publishable key if you have one; otherwise the `anon` key.

   > ⚠️ Never use a key that starts with `sb_secret_` or is labelled `service_role`. Those skip every privacy rule and must never go in the app.
5. Put your values in the `.env` file in this folder (create it if it isn't there). It should look like this, with your own values:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_9xQ2c7LmTq4ZbR1vN8wKpA_3fYhD0sE
   ```

   Optional, for food search: USDA allows about 30 searches an hour on its shared demo key. For 1,000 an hour, get a free key at [api.data.gov/signup](https://api.data.gov/signup/) (it's emailed to you straight away) and add a third line:

   ```
   EXPO_PUBLIC_USDA_API_KEY=your-key-here
   ```

   Your `.env` is in a public GitHub repo, so anyone can read this key. The worst they can do is use up its hourly limit, and you can make a new one for free at any time. Open Food Facts needs no key.

   Common mistakes:
   - The file must be named exactly `.env`. Windows Notepad sometimes saves it as `.env.txt`.
   - No quotes, and no spaces around the `=`.
   - Use the project URL itself. If you pasted the REST address ending in `/rest/v1/`, the app trims that part for you.
6. Restart the app with `npx expo start --clear`. The welcome screen's **Create account** button should be active. If it says **Connect Supabase first**, the app isn't reading your `.env`; check the common mistakes above.

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
  app/            screens (Expo Router): (auth)/ welcome, sign-in, sign-up · onboarding · (tabs)/ dashboard,
                  food-log, progress, profile · log (the logger sheet) · quick-add · food/new · food/[id] · food/preview ·
                  entry/[id]. _layout.tsx routes you by sign-in and setup state.
  components/ui/  PressableScale (instant touch feedback), Button, TextField, OptionCard, SegmentedControl,
                  StepProgress, Text, Card, Icon, AnimatedNumber, EmptyState, Screen, ToastHost
  components/     CalorieGauge, BrandMark, navigation/FloatingTabBar, dashboard/ (gauge, rings, tiles,
                  timeline), food/ (FoodDetail, PortionRuler, QuickAddForm, FoodRow), foodlog/ (MealCard, DayNav)
  features/       auth, onboarding, profile, dashboard (day queries, insights), food (logging queries,
                  label/quick-add parsing, Recent ranking), search (USDA + Open Food Facts, ranking)
  theme/          design tokens (colors, type, spacing) and the theme provider
  lib/            nutrition maths, portions, trend weight, streaks, supabase client, env, units, dates,
                  formatting, meals, haptics
  store/          small Zustand stores (theme, the day you're viewing, toasts)
supabase/
  migrations/     database schema, privacy rules (RLS) and reference data
  tests/          database checks used by scripts/verify-db.sh
__tests__/        Jest tests
```
