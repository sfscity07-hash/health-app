# Calorie Tracker App — Plan

## Context
You want a personal calorie-tracking app. The repo (`sfscity07-hash/health-app`) is empty, so we start from scratch. Requirements:
- **Native Android app**
- **Cloud account + sync**
- **Food lookup**: database search, barcode scanning, and manual entry/saved foods
- **Tracking**: macros, body weight, water, and exercise
- **Costs nothing**: no subscriptions, no paid APIs, no store fees
- **Premium feel, like MacroFactor**: fast, polished and satisfying, so you want to open it every day

It's your own design and name (placeholder name **"Fuel"**, easy to change). It takes MacroFactor's *approach* (smart trend weight, an adaptive calorie budget, very fast logging) without copying its branding.

---

## $0 cost breakdown
| Need | Free solution | Limits (fine for one person) |
|---|---|---|
| App framework | Expo / React Native | Free, open source |
| Running it while we build | **Expo Go** app on your Android phone | Free |
| Installable app | **APK built with EAS Build free tier** (or built locally with Gradle), installed directly on your phone | Monthly free build quota, plenty for a personal app. No Play Store ($25) needed. |
| Backend, auth, sync | **Supabase free tier** | 500 MB database (years of food logs). A project **pauses after 7 days with no use**. Daily logging keeps it awake, and if it does pause, one click in the dashboard resumes it. |
| Food database | **Open Food Facts** (no key) + **USDA FoodData Central** (free key) | Free |
| Reminders | expo-notifications (local, on-device) | Free, no push server |
| Fonts, icons, charts | Geist, Lucide icons, Victory Native XL | Open source |

Nothing in the plan needs a credit card.

---

## Tech stack
| Layer | Choice |
|---|---|
| App | **Expo SDK 57 + TypeScript**, Expo Router (file-based screens, headless tabs for the custom floating bar) |
| Backend | **Supabase**: Postgres + Auth + row-level security + one Edge Function (USDA proxy, so the key stays hidden) |
| Data fetching | **TanStack Query** with optimistic updates, so logging feels instant and syncs in the background |
| Offline | Query cache saved on the phone, so the app opens fast and shows today's data even without signal |
| Local state | Zustand |
| Animation | **react-native-reanimated** + **react-native-gesture-handler** |
| Bottom sheets | **@gorhom/bottom-sheet** |
| Charts | **Victory Native XL** (GPU-rendered with Skia, smooth and animated) |
| Haptics | expo-haptics |
| Barcode | expo-camera's built-in barcode scanner |
| Styling | Typed design tokens (`src/theme/tokens.ts`) + `StyleSheet`. This replaces NativeWind: there are fewer build pieces, and it works directly with the animation libraries. |
| Tests | Jest + React Native Testing Library |

---

## Design system ("premium app" feel)
The interactive design preview is the reference for all of this: https://claude.ai/artifact/BivetwmmHb2Ly4xxUkjqMq

- **Palette**:
  - Dark-first: near-black ground (`#07080C`), one periwinkle accent (`#8F9BFF`), and fixed macro colors (protein rose, carbs amber, fat teal) used everywhere.
  - Streak orange is the only other color.
  - The light theme follows the system setting.
- **Type carries the hierarchy**:
  - Geist for text and Geist Mono for small uppercase labels.
  - **Tabular (equal-width) digits** everywhere, so numbers don't jitter as they change.
  - One large number per screen; everything else is small and quiet.
- **Fewer boxes**:
  - Cards (22 px radius, hairline edge + faint top highlight) only wrap things you act on as a group.
  - Everything else sits on the background, separated by space and hairlines.
- **Instrument details**:
  - A 270° calorie gauge with tick marks and a soft glow at the arc's end.
  - A macro mini-bar on every logged food.
  - A pulsing dot on the next meal.
  - A goal date on the progress bar.
- **Navigation**: a floating frosted pill with 4 tabs, plus a separate round **+** button.
- **Motion that rewards you**:
  - The gauge, ticks, rings and bars animate as they fill, and numbers count to their new value.
  - Spring bottom sheets.
  - Haptic ticks on the portion ruler and on log, plus a small confetti burst on "Finish today", a water goal, or an accepted check-in.
- **Never leave context**: logging happens in a bottom sheet over the dashboard.
- **Gestures**: swipe to change days, swipe an entry to delete or duplicate it, long-press to multi-select and copy.
- **Loading & empty states**: skeletons instead of spinners. Empty meals show suggestions instead of blank space.
- **Accessibility**:
  - Large touch targets and readable contrast in both themes.
  - All motion turns off when the phone asks for reduced motion.

---

## Features

### 1. Onboarding (first-run, ~60 seconds)
- Sign up with email (Supabase Auth). Google sign-in comes later, also free.
- A step-by-step wizard with a progress bar: sex, age, height, weight, activity, goal (lose / maintain / gain) and pace.
- It calculates a starting calorie budget (Mifflin-St Jeor BMR × activity, adjusted for your goal) and macro targets. The reveal screen animates the ring, and every number can be edited.

### 2. Dashboard ("Today")
- **Header**: date, greeting, and a **streak flame** counter.
- **Week rings**: seven small rings (Mon–Sun). Each fills as you eat and closes with a check when you finish the day.
- **Calorie gauge**:
  - A 270° arc with tick marks, with the remaining kcal in the middle.
  - **Eaten** and **Budget** sit at the two ends of the arc.
  - It turns orange when you're over.
- **Macros**: protein, carbs and fat as "98 / 160 g" with a bar and "62 g left". The label turns to a ✓ Done when you hit the target.
- **Insight card** (tap to cycle). It changes as you eat:
  - protein streak
  - next weight milestone
  - room left for dinner
  - a supportive message on over-budget days
- **2×2 tiles**:
  - Trend weight with sparkline
  - Expenditure with sparkline
  - Water (tap to add 250 ml; 10 segments)
  - Activity (steps + exercise kcal)
- **Food timeline**: meals on a time rail, each food with kcal and a P/C/F mini-bar. The next empty meal shows one-tap suggestions ("Salmon & rice", "Same as last Tuesday").
- **Finish today** button: closes the day, extends the streak, closes today's ring, and celebrates.

### 3. Fast food logger (the core loop — target: log a food in 3 taps)
- **Bottom sheet**:
  - The title "Add to **Dinner** ⌄" switches meals with a tap.
  - The search field has a built-in barcode button.
  - With an empty search it shows Scan · Quick add · Saved.
- **Results**:
  - Each row shows source (USDA / OFF / your meal), serving, P/C/F and kcal.
  - Your foods and recents come first, then USDA and Open Food Facts.
  - A separate "Often with dinner" section is ranked by meal and time of day.
- **Multi-add**: the **+** on any row queues it. A bar slides up with "2 foods · 543 kcal · Add to Dinner".
- **Food detail**:
  - Big kcal number, a P/C/F calorie split bar, and unit tabs (g / fillet / oz…).
  - A **draggable portion ruler** with haptic ticks.
  - A **"Your day after this" preview**: striped bars show what this food adds to calories and each macro before you commit.
- **Barcode scan**: scan, confirm, done. If the product isn't found, a "Create food" form opens with the barcode filled in.
- **Quick add**, **custom foods**, **saved meals**, **favorites**, and copy a meal or day to another date.

### 4. Smart weight trend (MacroFactor-style)
- Log your scale weight daily (a quick stepper starting from yesterday's value).
- The **trend weight** smooths the noise out of daily weigh-ins (an exponential moving average). It's shown as a smooth line, with daily weigh-ins as faint dots.
- Ranges: 1W / 1M / 3M / 6M / 1Y / All. Drag across the chart to inspect any day (trend and scale weight).
- **Goal journey card**: start → goal bar with milestone notches every 2.5 kg, % done, "next milestone in ~N days", and a **projected goal date** that moves with your budget and habits.

### 5. Adaptive calorie budget (the "it learns me" feature)
- **Expenditure estimate**: how many calories you burn per day, worked out from what you actually ate and how your trend weight actually changed over the last ~2–3 weeks. It starts from the formula and gradually trusts your own data more.
- **Weekly check-in** (Monday), shown as a **four-card story** with tap-to-advance progress bars:
  1. Consistency: days logged, shown as 7 rings.
  2. Weight trend change for the week.
  3. Expenditure, with a 6-week bar chart.
  4. Next week's suggested budget. It has −/+ to adjust, the new macro split, and how many **days sooner** it moves your goal date. You accept with "Start next week" or keep the old budget.
- This is what makes the app feel smart and keeps you coming back.

### 6. Water
- Dashboard card with tap-to-add (+250 ml / +500 ml). A fill animation and a progress bar toward your goal.

### 7. Exercise
- Built-in activity list with MET values. Calories burned = `MET × kg × hours`. Or type in calories from your watch.
- A setting controls whether exercise adds to your budget (off by default, because the adaptive budget already accounts for your activity).

### 8. Progress / insights
- **Goal journey** and **weight trend** (above).
- **Calories**: 7-day bars vs a dashed budget line. Today is highlighted and over-budget days are orange.
- **Milestones**: badge rings that show progress *before* you earn them, e.g. "30-day streak 23 / 30" or "First 5 kg 4.8 / 5". Badges near completion glow.
- **Consistency**: current and best streak, plus a 13-week heatmap of logged and closed days.
- **Macros**: average split, plus how many days you hit your protein target.

### 9. Habit hooks (why you'll keep opening it)
Every hook rewards logging honestly, and none of them punish a bad day.
- **Finish the day**: a nightly one-tap ritual that closes the day, extends the streak, and fills the day's ring.
- **Week rings**: a full row is a perfect week, and it's hard to leave one empty.
- **Fresh insight each visit**: the dashboard card changes with what you've eaten.
- **Milestones you can almost touch**: progress shown on badges before they unlock.
- **Monday recap story** that ends in a one-tap budget update.
- **A goal date that moves**: good weeks show up as days saved.
- **Smart reminders** (local notifications, free). Examples: a nudge if lunch isn't logged by 1 pm, a morning weigh-in reminder, "finish your day" at 9 pm. Each has its own switch.

### 10. Profile & settings
- Goals, macro split (as % or grams), units (kg/lb, ml/oz), theme, reminders, exercise add-back.
- **Export everything to CSV** (you own your data).
- Sign out, and delete account (wipes all your data).

### Later (still free)
- Android home-screen widget (calories left)
- Google sign-in
- Health Connect sync (steps/weight)
- Different calorie budgets per weekday
- Recipe builder
- Micronutrients

---

## Screen layout (navigation map)
```
(auth)
 ├─ welcome → sign-in / sign-up
 └─ onboarding/ [goal → body → activity → pace → targets reveal]

(tabs)  floating pill: Dashboard · Food Log · Progress · Profile   + separate round [ + ] button
 ├─ Dashboard   week rings, calorie gauge, macros, insight card, 2×2 tiles, food timeline, Finish today
 ├─ Food Log    full day log with meal sections, copy/multi-select, day totals
 ├─ Progress    goal journey, weight trend, calories, milestones, consistency heatmap
 └─ Profile     goals, my foods, saved meals, reminders, export, settings
 [ + ]          opens Logger bottom sheet (search with barcode button · Quick add · Saved)

Sheets / modals
 ├─ logger (tabs)        ├─ food/[id] detail + serving picker
 ├─ scan (camera)        ├─ food/new · food/[id]/edit
 ├─ meal/new · meal/[id] ├─ weight/log · water/log · exercise/log
 └─ check-in (weekly, full screen)
```

---

## Data model (Supabase Postgres)
Every table has `user_id` and a row-level security rule (`user_id = auth.uid()`), so only you can read or write your rows.

| Table | Key columns |
|---|---|
| `profiles` | sex, birth_date, height_cm, activity_level, goal_type, goal_rate_kg_week, goal_weight_kg, calorie_target, protein_g, carbs_g, fat_g, water_goal_ml, units, theme, exercise_addback, reminder settings |
| `foods` | source (`custom`/`usda`/`off`), external_id, barcode, name, brand, nutrients per 100 g, default serving |
| `food_servings` | food_id, label ("1 cup"), grams |
| `food_logs` | date, logged_at, meal, food_id (nullable for quick add), name_snapshot, quantity, unit, grams, kcal, protein, carbs, fat |
| `saved_meals` + `saved_meal_items` | named group of foods + quantities |
| `favorites` | food_id |
| `weight_logs` | date (one per day), weight_kg |
| `water_logs` | date, amount_ml |
| `exercise_logs` | date, activity, duration_min, kcal_burned |
| `checkins` | week_start, avg_intake, trend_change, expenditure, old_target, new_target, accepted |
| `day_closures` | date, closed_at (powers "Finish today", streaks, week rings and the heatmap) |

- `food_logs` stores a **copy of the nutrients** at the moment you log, so editing a food later never changes your history.
- A view, `daily_summary`, totals each day for the dashboard and charts.
- The trend weight and expenditure math runs **on the phone** in `src/lib/` (pure, unit-tested functions). There's no server compute, which keeps it free.

---

## Folder structure
```
health-app/
├─ app/                      # Expo Router screens (map above) + _layout.tsx (auth gate, providers, theme)
├─ src/
│  ├─ theme/                 # tokens.ts (colors, macro colors, spacing, radii, type scale), dark/light
│  ├─ components/
│  │  ├─ ui/                 # Card, Button, Sheet, FloatingNav, Chip, Skeleton, AnimatedNumber, Toast, Confetti
│  │  ├─ CalorieGauge, WeekRings, MacroSummary, InsightCard, MetricTile, FoodTimeline, PortionRuler, ImpactPreview, Badge, StreakFlame
│  │  └─ charts/             # TrendChart, CalorieBars, Heatmap
│  ├─ features/              # hooks + queries per area: food/, logs/, weight/, water/, exercise/, profile/, checkin/
│  ├─ lib/
│  │  ├─ supabase.ts         # client, session in expo-sqlite localStorage (SecureStore caps at 2 KB)
│  │  ├─ nutrition.ts        # BMR/TDEE, targets, serving scaling, MET
│  │  ├─ trend.ts            # trend weight (EMA)
│  │  ├─ expenditure.ts      # adaptive TDEE + weekly target suggestion
│  │  ├─ foodApi.ts          # OFF + USDA → one Food shape
│  │  ├─ units.ts  haptics.ts  notifications.ts
│  ├─ store/                 # Zustand (selected date, logger queue)
│  └─ types/                 # generated DB types + domain types
├─ supabase/
│  ├─ migrations/            # tables, RLS, daily_summary view
│  ├─ functions/usda-search/ # Edge Function (keeps USDA key secret)
│  └─ tests/                 # RLS checks run by scripts/verify-db.sh (exercise list lives in a migration)
├─ __tests__/
├─ app.json · eas.json · .env.example · README.md
```

---

## Build phases
0. **Design preview** ✅: an interactive mockup of Dashboard, Food search, Food detail, Progress and Weekly check-in in dark and light (v2, approved as the base design).
1. **Foundation** ✅: Expo SDK 57 + TypeScript, Expo Router with the floating tab bar, theme tokens + Geist fonts, base UI components, app icon/splash, Jest, ESLint. Supabase client, schema migrations, RLS, and a local database check (`npm run db:verify`).
2. **Auth + onboarding**: wizard, `nutrition.ts` with tests, the animated targets reveal.
3. **Dashboard**: calorie gauge, week rings, macros, insight card, tiles, timeline, Finish today, animations, haptics.
4. **Logger core**: bottom sheet, quick add, custom foods, food detail + serving picker, edit/delete.
5. **Food search**: Open Food Facts + USDA Edge Function, smart ranking, recents.
6. **Barcode scanning.**
7. **Saved meals, multi-add, copy meal/day, favorites.**
8. **Weight + trend**: `trend.ts` and the trend chart.
9. **Water + exercise.**
10. **Adaptive expenditure + weekly check-in**: `expenditure.ts`, check-in screen.
11. **Progress tab**: goal journey + projected date, milestones/badges, streaks, heatmap, celebrations.
12. **Reminders, settings, CSV export, delete account.**
13. **Polish + release**: skeletons, empty states, app icon and splash screen, offline cache, EAS build of the APK, install on your phone.

Each phase ends in a working app you can try in Expo Go, committed to `claude/quirky-carson-ybf2zv`.

---

## What you'll need to set up (all free)
1. A **Supabase** account → new project → copy its URL and anon key into `.env`.
2. A **USDA FoodData Central** API key (free signup) → stored as a Supabase secret.
3. An **Expo** account (for EAS builds) and the **Expo Go** app from the Play Store.
4. On your phone, allow "Install unknown apps" when installing the APK.

---

## Verification
- **Unit tests** (`npx jest`):
  - BMR/targets
  - Serving scaling and unit conversion
  - Trend weight (against known sequences)
  - Expenditure and check-in suggestions (made-up weeks of data with known answers)
  - Open Food Facts/USDA response mapping
- **Static checks**: `npx tsc --noEmit`, `npx expo lint`.
- **Database**: run migrations on a local Supabase. Confirm that RLS stops a second test user from seeing the first user's data.
- **On device (Expo Go, then the installed APK)**:
  - Sign up and finish onboarding.
  - Search "banana", scan a real barcode, quick-add, and check the ring and macros animate and update.
  - Log weight for several days and check the trend line.
  - Run a check-in with seeded data.
  - Go offline, reopen the app, and check today's data still shows.
  - Export CSV.
  - Sign in again after reinstalling and check the data synced back.
