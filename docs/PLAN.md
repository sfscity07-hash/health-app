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
| Fonts, icons, charts | Inter, Lucide icons, Victory Native XL | Open source |

Nothing in the plan needs a credit card.

---

## Tech stack
| Layer | Choice |
|---|---|
| App | **Expo SDK + TypeScript**, Expo Router (file-based screens) |
| Backend | **Supabase**: Postgres + Auth + row-level security + one Edge Function (USDA proxy, so the key stays hidden) |
| Data fetching | **TanStack Query** with optimistic updates, so logging feels instant and syncs in the background |
| Offline | Query cache saved on the phone, so the app opens fast and shows today's data even without signal |
| Local state | Zustand |
| Animation | **react-native-reanimated** + **react-native-gesture-handler** |
| Bottom sheets | **@gorhom/bottom-sheet** |
| Charts | **Victory Native XL** (GPU-rendered with Skia, smooth and animated) |
| Haptics | expo-haptics |
| Barcode | expo-camera's built-in barcode scanner |
| Styling | NativeWind (Tailwind) + a design-token theme file |
| Tests | Jest + React Native Testing Library |

---

## Design system ("premium app" feel)
This is what makes it feel like a paid app rather than a school project:

- **Dark-first theme** (true-black background, slightly raised cards) plus a light theme that follows the system setting.
- **One accent color** and **fixed macro colors**: protein, carbs and fat each get one hue, used everywhere (rings, bars, charts, chips) so you recognize them at a glance.
- **Typography**: Inter with **tabular (equal-width) numbers**, so digits don't jitter when they change. Key numbers are big and bold, labels small and muted.
- **Cards**: 20 px rounded corners, generous padding, no heavy borders, consistent 4/8/16/24 spacing.
- **Motion that rewards you**:
  - Calorie ring and macro bars **animate as they fill** when you log something.
  - Numbers **count up or down** to their new value.
  - Spring-animated bottom sheets.
  - A short **haptic tick** on log, stepper changes and goal hit, and a gentle celebration when you close out a day on target.
- **Never leave context**: logging happens in a bottom sheet over the dashboard, not a separate page.
- **Gestures**: swipe left/right on the dashboard to change days, swipe an entry to delete or duplicate it, long-press to multi-select and copy to another day.
- **Loading states**: skeleton placeholders instead of spinners, and friendly empty states ("Nothing logged yet — tap + to add breakfast").
- **Accessibility**: large touch targets, readable contrast in both themes.

---

## Features

### 1. Onboarding (first-run, ~60 seconds)
- Sign up with email (Supabase Auth). Google sign-in comes later, also free.
- A step-by-step wizard with a progress bar: sex, age, height, weight, activity, goal (lose / maintain / gain) and pace.
- It calculates a starting calorie budget (Mifflin-St Jeor BMR × activity, adjusted for your goal) and macro targets. The reveal screen animates the ring, and every number can be edited.

### 2. Dashboard ("Today")
- A **hero calorie ring** with remaining calories in the middle and the breakdown "Budget − Food + Exercise" below it.
- **Three macro rings or bars** (protein, carbs, fat) showing grams eaten / target.
- A **horizontal card carousel**:
  - Trend weight
  - Expenditure estimate
  - Water
  - Steps / exercise
  - Streak
- **Food timeline** grouped by meal, with time and calories per item, and a "log again" chip on each meal.
- A **date strip** at the top (week view with a small dot on logged days). Swipe to change day.
- A floating **+ button** that opens the logger sheet.

### 3. Fast food logger (the core loop — target: log a food in 3 taps)
- One bottom sheet with tabs: **Search · Scan · Quick add · Saved meals**.
- **Smart search** returns results as you type. Order: your foods, then recents, then USDA and Open Food Facts. Recents are ranked by **time of day** (oats come up first in the morning).
- A **food detail sheet** with unit picker (g, ml, serving, cup…) and quantity stepper. The macros and calories shown update live, with a "this will put you at X / Y kcal" preview.
- **Multi-add**: queue several foods, then log them all at once.
- **Barcode scan**: scan, then a quick confirm, and it's logged. If the product isn't found, a "Create food" form opens with the barcode already filled in.
- **Quick add**: just type calories and macros.
- **Custom foods** and **saved meals** (a group of foods logged in one tap). Copy a meal or a whole day to another date.

### 4. Smart weight trend (MacroFactor-style)
- Log your scale weight daily (a quick stepper starting from yesterday's value).
- The **trend weight** smooths the noise out of daily weigh-ins (an exponential moving average). It's shown as a smooth line, with daily weigh-ins as faint dots.
- Ranges: 1W / 1M / 3M / 6M / 1Y / All. Shows weekly rate of change and progress toward your goal.

### 5. Adaptive calorie budget (the "it learns me" feature)
- **Expenditure estimate**: how many calories you burn per day, worked out from what you actually ate and how your trend weight actually changed over the last ~2–3 weeks. It starts from the formula and gradually trusts your own data more.
- **Weekly check-in** (Monday): a full-screen summary of the week covering average intake, weight change, and updated expenditure. It **suggests a new calorie budget** to keep you on pace, which you can accept or tweak with one tap.
- This is what makes the app feel smart and keeps you coming back.

### 6. Water
- Dashboard card with tap-to-add (+250 ml / +500 ml). A fill animation and a progress bar toward your goal.

### 7. Exercise
- Built-in activity list with MET values. Calories burned = `MET × kg × hours`. Or type in calories from your watch.
- A setting controls whether exercise adds to your budget (off by default, because the adaptive budget already accounts for your activity).

### 8. Progress / insights
- **Calories**: weekly bars vs budget, with a target line.
- **Macros**: average split, plus how many days you hit your protein target.
- **Weight**: trend chart.
- **Streaks**: current and best streak, and a GitHub-style calendar heatmap of days you logged.

### 9. Habit hooks (why you'll keep opening it)
- **Logging streak** with a flame counter (logging anything counts).
- **Smart reminders** (local notifications, free). For example, a nudge at 1 pm if you haven't logged lunch, or a morning weigh-in reminder, each with its own on/off switch.
- **Weekly check-in** ritual (above).
- **Small celebrations** when you hit protein, close a day on target, or reach a new milestone weight.

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

(tabs)  bottom bar: Dashboard · Food Log · [ + ] · Progress · More
 ├─ Dashboard   ring, macros, card carousel, today's timeline, date strip
 ├─ Food Log    full day log with meal sections, copy/multi-select, day totals
 ├─ [ + ]       opens Logger bottom sheet (Search · Scan · Quick add · Saved)
 ├─ Progress    weight trend, expenditure, calories, macros, streak heatmap
 └─ More        profile, goals, my foods, saved meals, reminders, export, settings

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
│  │  ├─ ui/                 # Card, Button, Sheet, Stepper, Chip, Skeleton, AnimatedNumber, EmptyState
│  │  ├─ CalorieRing, MacroRing, DateStrip, FoodRow, MealSection, ServingPicker, WaterCard, StreakFlame
│  │  └─ charts/             # TrendChart, CalorieBars, Heatmap
│  ├─ features/              # hooks + queries per area: food/, logs/, weight/, water/, exercise/, profile/, checkin/
│  ├─ lib/
│  │  ├─ supabase.ts         # client, session in SecureStore
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
│  └─ seed.sql               # exercise MET list
├─ __tests__/
├─ app.json · eas.json · .env.example · README.md
```

---

## Build phases
0. **Design preview**: a clickable visual mockup of the main screens (Dashboard, Logger, Progress, Check-in) in dark and light theme. You approve the look before any app code is written.
1. **Foundation**: Expo + TypeScript, Expo Router, theme tokens, base UI components, Jest, lint. Supabase project, migrations and RLS.
2. **Auth + onboarding**: wizard, `nutrition.ts` with tests, the animated targets reveal.
3. **Dashboard**: calorie ring, macro rings, date strip, timeline, animations, haptics.
4. **Logger core**: bottom sheet, quick add, custom foods, food detail + serving picker, edit/delete.
5. **Food search**: Open Food Facts + USDA Edge Function, smart ranking, recents.
6. **Barcode scanning.**
7. **Saved meals, multi-add, copy meal/day, favorites.**
8. **Weight + trend**: `trend.ts` and the trend chart.
9. **Water + exercise.**
10. **Adaptive expenditure + weekly check-in**: `expenditure.ts`, check-in screen.
11. **Progress tab, streaks, heatmap, celebrations.**
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
