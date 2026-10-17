# Fuel — calorie & macro tracker

A personal Android calorie tracker that costs nothing to run (Expo + Supabase free tier), with a premium, MacroFactor-style experience:
fast food logging (search, barcode, quick add), macros, smart trend weight, an adaptive calorie budget, water, exercise, and weekly check-ins.

- **Plan:** [docs/PLAN.md](docs/PLAN.md) has every feature, the screen layout, the data model and the 13 build phases.
- **Approved design:** the [interactive design preview](https://claude.ai/artifact/BivetwmmHb2Ly4xxUkjqMq) is the visual reference for every screen.
- **Status:** Phases 1–12 are done, plus recipes and your new list up to AI estimates (deficit per day; recipe ingredient ideas and scanning; a recipe from foods you logged; water from drinks; vitamins, minerals, salt and caffeine; AI estimates for what no label lists). Phase 13 is ready on my side: the app is set up to be built as an APK, update itself over the air, open offline and show loading placeholders. Building and installing it needs your Expo account: [Install Fuel on your phone (APK)](#install-fuel-on-your-phone-apk) walks you through it. The calendar is on hold. The rest of the list is in [docs/PLAN.md](docs/PLAN.md#next-your-list-october-13). See [What works right now](#what-works-right-now) before you try a new version.

## What works right now

Updated with every release. **Latest: Fuel on an iPhone. The same app runs in Safari: publish it once with two commands ([Use Fuel on an iPhone](#use-fuel-on-an-iphone-web-version)), send the link, and it goes on the Home Screen with its own icon.** Before that: **Feedback & bugs. A Feedback button at the top right of the dashboard lets anyone using your Fuel report a bug or send an idea, and you read everyone's in the app.** (Before that: ready to install as a real app, with over-the-air updates, offline use and loading placeholders; AI estimates; vitamins, minerals, salt and caffeine.)

**For the iPhone version:** follow [Use Fuel on an iPhone](#use-fuel-on-an-iphone-web-version). Nothing changes for you on Android, and no new SQL; the steps below are still the ones for Feedback & bugs if you haven't done them.

**Before running this version:**
1. Get it:
   ```
   cd C:\Users\Manny\health-app
   git pull
   npm ci
   ```
   Haven't pulled since linking your Expo project? Run `git checkout -- app.json eas.json` first (once).
2. **New SQL:** in Supabase's SQL Editor, run `supabase/migrations/20261015090000_feedback.sql` once (safe to run again).
3. **Make yourself the one who reads everyone's feedback:** see [Feedback and bug reports](#feedback-and-bug-reports) (one SQL line with your email).
4. **Installed the APK?** Send this version to it, and to your friends' phones, over the air:
   ```
   npx eas-cli@latest update --channel preview --platform android --message "Feedback button"
   ```
   If it asks `Select environment:`, pick **preview**. Never add `--environment`. Then open the app: **New version ready · Restart**. Not installed yet? Carry on from [Step 7](#part-2-build-the-apk-5-minutes-of-typing-then-a-wait) of the APK guide; the APK will have it.

✅ **Works**
- Create an account, sign in, sign out.
- **Feedback & bugs** (new, needs the new SQL): the **Feedback** chip at the top right of the dashboard (and **Send feedback** in Profile) opens a short form: Bug, Idea or Other, and a message. It's sent with the sender's email, the app version, the phone model and the screen it came from, so a bug can be found. Everyone sees what they've sent; you see **Everyone's feedback** with who sent what and when, once you've made yourself the reader. At most 20 messages a day per account.
- **Opens offline** (new; in Expo Go your phone still needs your computer, so try it in the installed app): everything you've looked at is saved on the phone, so with no signal the app still opens on your day, Food log, weight, Progress, recipes and foods, with **Offline · saved data** at the top. It refreshes by itself when you're back online. Logging needs a connection (you'll see "Couldn't save… Check your connection"). Each account's saved data is kept separately and deleted when you sign out. If you open the app offline more than an hour after you last used it, you stay signed in (Supabase renews the sign-in once you're online).
- **Loading placeholders** (new): grey shapes of what's coming (the day's food, meal cards, the weight chart, nutrient rows, recipes, saved meals, a food) instead of spinners. They hold still with your phone's *Remove animations* setting on.
- **Updates itself** (new, installed app only): a new version downloads in the background; **New version ready · Restart** appears at the top when it's ready (or it opens next time you start the app). Profile → bottom shows the version and update date, with **Check for updates**.
- Setup: goal (lose weight, **recomp**, maintain, build muscle), body stats in kg/cm or lb/ft, activity, goal weight and pace, then your animated daily budget.
- **Logging food** (the **+** button, or "Add …" on the dashboard and Food log):
  - Recent foods for the meal you're logging, most-eaten first; tap **+** to log the same amount again in one tap. The **+** then turns into a **− 1 +** counter, so a second tap shows "2" instead of adding silently, and **−** takes the last one back out. Works the same for your foods, search results, saved meals, recipes and recent workouts.
  - **Search**: type a food and you get your own foods first, then results from **USDA** (whole foods like "bananas, raw") and **Open Food Facts** (packaged products, worldwide). Tap a result to pick the amount (servings like "1 medium" or "1 slice", or grams), or tap **+** to log one serving straight away. Each food shows once: the same food from several databases or shops is merged, entries with impossible numbers are dropped, and anything already in Recent or Your foods isn't repeated. British and American spellings both work ("yoghurt" finds "yogurt"), entries named only after their brand get a description or are skipped, and results from what you typed a moment ago fade out while the new ones load.
  - **Quick add**: just calories, or macros and it works the calories out. Fibre is optional.
  - **New food**: copy a nutrition label, including **fibre**. Choose how you measure it (grams, scoop, cup, tbsp, tsp, slice, piece, bar, ml, or your own word) and whether the label's numbers are per scoop or per 100 g, then add more units if you like (1 scoop = 30 g, 1 tbsp = 10 g). It's saved for next time.
  - Food screen: switch units (the food's own, plus grams and ounces for everything), tap **+ Unit** to add a scoop, cup or anything else to a food, tap the number to type it, or drag the ruler. See what it does to your day before you add it. Star it as a favorite.
  - **Scan a barcode** (the Scan button, or the barcode icon in the search bar): your own foods come up instantly, then Open Food Facts, then USDA's US products. If nobody knows the barcode, **Create this food** opens with the barcode filled in, so the next scan finds it. A torch button helps in dim light, and **Type the number instead** works for crumpled barcodes (typos are caught by the check digit).
  - Tap the meal name at the top of the logger to switch meal.
  - Tap anything you've logged (dashboard or Food log) to change the amount or meal, or delete it.
- **Fibre**: tracked on everything you log, with a daily target of 14 g per 1,000 kcal (shown on the dashboard, Food log, food screen and Profile).
- **Vitamins, minerals, salt and caffeine** (needs the new SQL for vitamins and minerals):
  - Under the macros on the dashboard and the Food log: the day's **salt** and **caffeine** ("over" when you pass the limit). Tap it for the **Nutrients** screen.
  - **Nutrients**: *Keep under* (salt, caffeine, sugar, saturated fat, cholesterol) against upper limits (2,300 mg sodium ≈ 5.8 g salt, 400 mg caffeine, 10% of your calories for sugar and saturated fat), then **minerals** (potassium, calcium, iron, magnesium, zinc) and **vitamins** (A, C, D, B12, folate) against what's recommended for your sex and age. Step back through days.
  - Every row says which foods had **no data** (never counted as zero) and marks estimates with **≈**. Tap a row to see which foods it came from and where each estimate came from.
  - Where the numbers come from: the food's label (Open Food Facts, USDA, or what you typed). Foods you saved before this update are looked up again by their USDA id or barcode the first time you open a day with them.
  - **Filling gaps honestly**: for simple foods (Greek yoghurt, milk, paneer, oats, dal…), whatever the label leaves out is borrowed from USDA's plain version of the same food, closest in calories (so your Great Value Greek yoghurt gets potassium and B12 from USDA's nonfat Greek yoghurt, marked "≈ from USDA"). Never for a dish or a packaged snack. Recipes add up their ingredients. Caffeine for coffee, tea, chai, cola, energy drinks and chocolate uses typical amounts unless the label says; everything else has none.
  - **New food** has **Add salt, sugar, caffeine and more**: saturated fat, sugar, sodium, cholesterol, caffeine, calcium, iron and potassium from the label, all optional.
  - The food screen shows the salt, sugar, saturated fat and caffeine in the amount you're about to log.
  - **AI estimates** (after the one-time setup below): when a food's label, USDA and the caffeine list still leave a nutrient unknown (often an Indian packaged snack or a café drink), Claude estimates it per 100 g from the food's name, brand and macros, based on food-composition tables (USDA, India's IFCT). Each food is asked about once and the answer is saved with it. Every number that includes an AI estimate shows a small **AI** label, on the Nutrients screen, the salt and caffeine line and the food screen; tap a row to see which food it was and what Claude based it on ("AI estimate, based on IFCT: bhujia"), with "(rough)" when Claude wasn't sure. Label and USDA numbers always win. Turn it off in Profile → **AI estimates for missing nutrients**.
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
- **Saved meals, copying and recipes from your log** (the **⋯** button on any meal in the Food log):
  - **Save as a meal**: name it ("Usual breakfast" is suggested), untick anything you don't want, save. Quick adds are kept with their numbers.
  - **Saved** in the logger lists your meals; tap **+** to add a whole meal in one tap, or tap the meal to rename it, take foods out, pick which meal to add it to, or delete it. Searching in the logger finds saved meals by name too.
  - **Copy to today** (on past days), or **Copy to another day**: any day up to a week ahead, into any meal ("copy yesterday's snacks to tomorrow's lunch").
  - Under the meals: **Copy this day to today** (on past days) and **Copy … to another day**, which copy every food into its own meal.
  - **Make it a recipe** (in the **⋯** menu), or **Build a recipe from these foods** under the day: tick the foods that went into the dish, from any meal that day (the meal you came from starts ticked). They go into a new recipe at the amounts you logged; quick adds come in as quick ingredients. Name it, set servings or the finished weight, and save. Your log stays as it is, and next time the dish is one food.
- **Recipes** (the **Recipes** button in the logger): anything you make from several foods, like a marinade, a curry or a smoothie.
  - **Build one from foods you logged** (on the Recipes screen, or from the Food log): tick what you logged and it becomes the ingredient list.
  - **New recipe**: name it, then **Add ingredient** for everything that went in: your own foods, anything from USDA or Open Food Facts (search "ghee", "paneer", "greek yoghurt"), recent foods, or **another recipe**. Tap **+** for the usual amount, or tap the food to pick it in tbsp, grams, slices or any of its units.
  - **Ideas while you add**: Add ingredient opens with chips from the recipe's name ("Paneer tikka marinade" → paneer, yoghurt, ginger garlic paste, lemon juice, mustard oil, ghee), and the first one is already searched, so the usual ingredients are one tap. Ideas already in the recipe drop off. Tap another chip to search it, or type anything.
  - **From your recipes**: if you've saved a similar recipe ("Paneer marinade"), its chip comes first: add the whole recipe, or any of its ingredients at the same amount.
  - **It learns your pantry**: every product you log or put in a recipe counts, recent use most, so a brand you've switched to wins within a few weeks.
    - An idea or search shows **Your usual** first: the exact products you use, with brand, how much you usually put in, and how often ("Great Value · usually 1 container · 150 g · used 3×"); **+** adds your usual amount.
    - Chips show your brand ("yoghurt · Great Value").
    - In "From your Paneer marinade", a generic ingredient becomes the product you buy now, at the recipe's amount ("Greek Nonfat Yogurt, Plain · Great Value · 150 g · your usual, not Greek Yoghurt").
    - Dishes never stand in for ingredients: your Paneer marinade is never your "usual paneer".
  - **Scan**: the barcode button in the ingredient search adds a pack straight to the recipe. A barcode nobody knows lets you copy the label once, and it goes into the recipe (and scans instantly next time).
  - **Swap ideas**: swapping an ingredient suggests stand-ins (paneer → tofu, soya chaap, chicken breast, cottage cheese; ghee → olive oil; cream → Greek yoghurt…).
  - **Quick ingredient (just the numbers)**: for a spice mix or anything that isn't a food in Fuel. Calories (or macros), weight optional.
  - The card at the top adds it all up as you go: the whole batch's calories, protein, carbs, fat and fibre, what it weighs, per 100 g and per serving.
  - **Finished weight** (optional): weigh the dish after cooking, without the pot. Cooking drives off water, so this makes every gram you log exact. Leave it empty and the ingredients' weights are added up.
  - **Servings** (optional): split the batch into servings to get a "serving" unit.
  - **Log it like any food**: by the gram, the serving, ounces or the **whole batch**. 50 g of the marinade gets exactly 50/520 of the ghee, paneer and everything else.
  - **What's in this portion**: on a recipe's screen, a card under the amount lists each ingredient's grams and calories in the amount you're logging (50 g of marinade = 38 g paneer, 2.5 g ghee…), with a bar showing where the calories come from. It follows the ruler as you drag it, and shows again when you open a logged recipe.
  - **Recipes look different everywhere**: they have their own color (orchid) and a pot mark. In the logger, search and Recent they carry a RECIPE tag and an orchid **+**; on the dashboard, the Food log, saved meals and inside other recipes they show the pot and "Recipe ·". The recipe editor colors each ingredient by its share of the calories.
  - **Change it later**: open the recipe (from Recipes, Recent or search, where it's tagged RECIPE), tap **Edit**, then tap any ingredient to **change its amount**, **swap it for another food** (paneer → soya chaap keeps the same 400 g) or remove it.
  - **Save as a new recipe** keeps the original and saves your changed one under a new name, so you can have a paneer and a soya chaap version.
  - **Recipes inside recipes**: a taco with 50 g of the marinade, a slice of cheddar and a tortilla.
  - What you already logged keeps its numbers when you change or delete a recipe.
- **Deficit per day**: what you burned (your expenditure estimate, plus logged exercise if you add exercise to your budget) minus what you ate.
  - On the dashboard under the gauge: "Deficit so far" today (it shrinks as you eat), with what eating exactly your budget would give.
  - On the Food log's day card for any day: the deficit (or surplus), what it's made of, and roughly how much fat that is.
  - On Progress, a **Deficit** chart for the last 7 days: bars go up for a deficit and down for a surplus, the dashed line is what eating your budget gives, and the week's total with kg of fat. Tap a day to read it. Today joins the chart once you finish the day.
- Dashboard:
  - calorie gauge
  - protein/carbs/fat bars
  - week rings (tap a day this week to look back at it; the logger then adds to that day)
  - insight card (tap for the next one)
  - trend weight, and your expenditure (marked ADAPTIVE once it's learning from your logs)
  - pull down to refresh
- **Water**: the **+** on the dashboard's Water tile adds a glass in one tap. Tap the tile for the Water screen: add a glass, bottle or large bottle (or type any amount), see each drink with its time and remove one you added by mistake, and change your daily goal. Hitting the goal gets a little celebration. Shown in L, or fl oz if you chose imperial units.
  - **Water from drinks** (needs the new SQL): milk, tea, chai, coffee, juice, buttermilk / chaas, lassi, coconut water, soft drinks and soup you log as food count toward water, by roughly how much of each is water (a 250 ml glass of milk adds 220 ml). Fuel goes by the end of the name, so "chocolate milk" counts but "milk chocolate" and "oats with milk" don't; powders, concentrates and alcohol never do. A recipe counts only if the dish is a drink (a smoothie).
  - The tile and the Water screen include it: those glasses fill in a lighter blue, and the Water screen says "Includes 0.2 L from drinks you logged".
  - **Doesn't count**: when you log a drink, a **Counts toward water** switch shows how much it adds; turn it off when it was cooked down, like milk simmered into oats. Fuel remembers per food and meal, so your breakfast milk stays off next time while a glass of milk as a snack still counts. You can also flip it on the entry later, or on the Water screen under **From your food log**, which lists the day's drinks with a switch each.
  - **Count water in drinks** (Water screen or Profile) turns it all off.
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
- Next from your list, in order (details in [docs/PLAN.md](docs/PLAN.md#next-your-list-october-13)): monthly adaptive targets, programs, pantry meal plans (they'll use the same AI setup). The calendar of past days is on hold.
- Quick adds (just calories, no food behind them) can't get vitamins, minerals or AI estimates; only their caffeine is guessed from the name. A recipe adds up its ingredients rather than asking AI. Recipes saved before this update add up their ingredients the first time you open a day with them; a recipe inside another recipe needs a re-save to pick up its ingredients' new numbers.
- Water from drinks goes by a list of drinks, not each food's own water value, so an unusual drink may not count (log it on the Water screen instead). Drinks you logged before running the new SQL don't count until you switch them on in the Water screen.
- The APK itself: building and installing it needs your Expo account, so those steps are yours ([Install Fuel on your phone (APK)](#install-fuel-on-your-phone-apk)). I couldn't build it here, so the first build is also its first real test; if it fails, send me the error from the build page.
- Logging while offline: reading works offline, saving doesn't yet.
- A recipe inside another recipe doesn't update by itself: after changing the marinade, open the taco, tap **Edit** and **Save recipe** to pick up the new numbers.
- Steps from your phone or watch aren't read. That needs Health Connect, which is native code, so it would come with a new APK later (not over the air).
- Reminders can't be tried on the web version, only in Expo Go or the installed app.

## Run it on your Android phone (free)

1. Install [Node.js](https://nodejs.org) (the LTS version) on your computer.
2. In this folder (the one that contains `package.json`; a downloaded ZIP may unzip into a folder inside a folder), run `npm install`.
3. Install **Expo Go** from the Play Store on your phone.
4. Run `npx expo start` and scan the QR code with Expo Go. Your phone and computer need to be on the same Wi-Fi; if they aren't, use `npx expo start --tunnel`.

The app opens on the welcome screen. Create an account, answer the setup questions, and you'll land on the dashboard with your daily budget.

> **Feels slow?** `npx expo start` runs a development build with debugging switched on, which makes every tap and animation slower. To try the app at real speed, use `npx expo start --no-dev --minify` instead. The [installed app (APK)](#install-fuel-on-your-phone-apk) runs at full speed.

### Getting a new version

```
git pull
npm ci
npx expo start --clear
```

Use `npm ci` rather than `npm install` for updates: it installs exactly what's in `package-lock.json` and never rewrites it. If `git pull` says *"Your local changes to package-lock.json would be overwritten"*, an earlier `npm install` rewrote that file; run `git checkout -- package-lock.json`, then pull again. If `npm ci` fails with "EPERM" on Windows, stop `npx expo start` (Ctrl+C) or close your editor and run it again.

If `git pull` says the same about **`app.json`** or **`eas.json`**, that's from linking your Expo project ([Step 6](#install-fuel-on-your-phone-apk) below explains it).

Once the APK is installed, getting a new version onto your phone is [Part 4](#part-4-getting-my-changes-later-no-reinstall) below, with no reinstall.

## Install Fuel on your phone (APK)

This turns Fuel into a real app on your phone: its own icon, full speed, no computer or Expo Go needed, opens offline with your saved data, and gets my later changes **over the air**, without reinstalling. It's free: Expo builds the APK on their computers (no Android Studio), and Supabase stays exactly as it is.

**Already done (by me):**
- The build settings (`eas.json`: an installable APK on the `preview` update channel).
- Over-the-air updates.
- Your `.env` going up with the build. That's how the APK knows your Supabase project, so `.env` is no longer hidden from it.
- The notification icon for reminders.
- The offline cache and the loading placeholders.

**Left for you:** the parts that need your Expo account. Type everything below in **Command Prompt**, in `C:\Users\Manny\health-app`. A line in a grey box is one command: type it (or paste with right-click) and press Enter.

### Part 1: one-time setup (about 10 minutes)

**Step 1. Get this version**

```
cd C:\Users\Manny\health-app
git pull
npm ci
```

Then check your `.env` is there:

```
type .env
```

It should show three lines starting with `EXPO_PUBLIC_SUPABASE_URL=`, `EXPO_PUBLIC_SUPABASE_KEY=` and `EXPO_PUBLIC_USDA_API_KEY=`. Whatever is in `.env` goes into the app, so it must never hold a secret key (no `sb_secret_…`, no Claude key).

Optional: run `npx expo start --clear` once and check the app works in Expo Go, then stop it with Ctrl+C.

**Step 2. Make a free Expo account**

Go to [expo.dev/signup](https://expo.dev/signup) and sign up with an email, a username and a password. Confirm the email they send you. Remember your **username**: it's in every link later.

**Step 3. Sign in from Command Prompt**

```
npx eas-cli@latest login
```

1. The first time, it asks `Need to install the following packages: eas-cli@… Ok to proceed? (y)`. Type `y`, then Enter. (You'll see this question again now and then; the answer is always `y`.)
2. Type your Expo **email or username**, Enter.
3. Type your **password**, Enter. Nothing appears on screen while you type it; that's normal.
4. It says `Logged in as your-username`.

To check later: `npx eas-cli@latest whoami` prints your username.

**Step 4. Create the project on Expo and link this folder**

```
npx eas-cli@latest init
```

- It asks `Would you like to create a project for @your-username/fuel?`. Answer `Y`.
- It ends with `Project successfully linked`.
- If it asks which account should own it (only if you're in an Expo team), pick your own username.

This added two things to `app.json`: `"owner": "your-username"` and an `"extra": { "eas": { "projectId": "…" } }` block. Leave them as they are.

**Step 5. Switch on over-the-air updates**

```
npx eas-cli@latest update:configure
```

You'll see `Configured updates.url to "https://u.expo.dev/…"`. It may also say it configured `eas.json`; that's fine.

> Do this **before** your first build. The APK learns where to look for updates when it's built; an APK built without this step never gets updates.

**Step 6. Send me the lines Expo added** ✅ done for your project (October 14)

Steps 4 and 5 changed `app.json` (and maybe `eas.json`) on your computer. Run:

```
git --no-pager diff app.json eas.json
```

Paste what it prints into our chat. It's your Expo username, the project ID and the update address, nothing secret. I'll add the project ID and update address to the repo and tell you when they're in. (Without `--no-pager`, a long diff stops at a `:`; press space for more, or `q` to quit.) Expo also writes a couple of lines the app doesn't need, such as the camera permission twice and an empty `"router"`; I leave those out.

**Until I say they're in, don't `git pull`.** After that, the next update starts with one extra command, which swaps your copy of those files for the repo's identical one:

```
git checkout -- app.json eas.json
git pull
```

You only need that once. If you pull too early and lose the lines, run Steps 4 and 5 again: `init` finds the existing project and offers to link it (answer `Y`).

### Part 2: build the APK (5 minutes of typing, then a wait)

**Step 7. Start the build**

```
npx eas-cli@latest build --platform android --profile preview
```

It asks:
- `Generate a new Android Keystore?` Answer `Y`. This is the app's signing key. Expo keeps it for you and signs every future build with it, which is what lets a newer APK install over the old one with you still signed in. Never delete it on expo.dev.

It may also print `versionCode will be initialized…`. That's fine: Expo numbers the builds for you.

Then:
1. It uploads the project: `Compressing project files and uploading to EAS Build`, a few MB.
2. It prints a link like `https://expo.dev/accounts/your-username/projects/fuel/builds/…`.
3. The build runs on Expo's computers. On the free plan it waits in a queue first (often 5–30 minutes, longer at busy times), then builds for about 10–20 minutes.

You can close Command Prompt or turn the computer off; the build carries on. The link shows progress, and expo.dev → **Projects → fuel → Builds** lists every build.

**Step 8. When it's finished**

The build page shows **Build finished** with an **Install** button. If Command Prompt is still open, it shows a QR code and a link ending in `.apk`.

### Part 3: install it on your phone

**Step 9. Download the APK on the phone**

Either:
- scan the QR code with the phone's camera, or
- on the phone, sign in at [expo.dev](https://expo.dev) → **Projects → fuel → Builds** → the newest build → **Install**.

The `.apk` file downloads (tens of MB).

**Step 10. Allow the install**

Tap the downloaded file (in the browser's downloads, or **Files → Downloads**).

- Android may say *"For your security, your phone isn't allowed to install unknown apps from this source"*. Tap **Settings**, turn on **Allow from this source**, go back, and tap **Install**.
- **Google Play Protect** may say *"Unsafe app blocked"* or *"Unrecognised app"*, because the app isn't from the Play Store. Tap **More details → Install anyway** (or **Scan app**, then **Install**). It's your own app; nobody else has it.

**Step 11. Open Fuel and sign in**

Fuel is the ring icon in your app drawer. Sign in with the **same email and password** you use in Expo Go. Everything lives in Supabase, so your log, weight, recipes and settings are all there.

- To get reminders: Profile → **Reminders**, turn one on, and allow notifications when Android asks.
- Expo Go can stay installed next to it. Use the installed app day to day; Expo Go is still handy for trying a version before you publish it.

### Part 4: getting my changes later (no reinstall)

Most of what I make (screens, features, fixes) reaches the installed app over the air. When I say a version is ready:

```
cd C:\Users\Manny\health-app
git pull
npm ci
npx eas-cli@latest update --channel preview --platform android --message "what changed"
```

- If it asks `Select environment:`, pick **preview** (arrow keys, then Enter).
- **Never add `--environment` to the command.** With it, EAS leaves out your `.env`, and the update would arrive with no Supabase connection.
- It packs the app on your computer for a minute or two, uploads it, and ends with `Published!`.

On the phone, just open Fuel:
1. It downloads the update in the background.
2. When it's ready, **New version ready · Restart** appears at the top.
3. Tap **Restart**, or ignore it: the new version opens next time you start the app.

Profile → bottom shows `Fuel 1.0.0 · update of …` with the update's date, and **Check for updates** checks straight away.

**When you need a new APK instead:** my release notes will say either **Over the air** (the commands above) or **New APK needed**. A new APK is only needed when I add something with native code, like reading steps from Health Connect. I'll raise the version number; you then repeat Steps 7–10, and the new APK installs over the old one with you still signed in.

> An update only reaches APKs with the same version (all `1.0.0` builds, for example). After a new APK, updates go to the new version only, so install the new APK first.

### If something goes wrong

- **`'npx' is not recognized`**: install Node.js LTS (see [Run it on your Android phone](#run-it-on-your-android-phone-free)) and open a new Command Prompt.
- **`init` talks about "dynamic app configuration"**: there's an `app.config.js` or `app.config.ts` in the folder. There shouldn't be; tell me.
- **The build fails**: open the build link, find the first red error in the log (often under *Install dependencies* or *Run gradlew*), and paste it to me. I'll fix it, and you run Step 7 again.
- **The installed app shows "Connect Supabase first"**: the build didn't get your `.env`. Check that `type .env` shows the three lines, and that you've pulled this version (older versions hid `.env` from the build). Then build again (Step 7).
- **"App not installed" when installing a newer APK**: it was signed with a different key (for example after the keystore was deleted on expo.dev). Uninstall Fuel first, then install. Your data is safe in Supabase.
- **No "New version ready"**: check you published with `--channel preview`, that you pulled before publishing, and that your phone is online. Then open Profile → **Check for updates**.
- **The update opens but can't load anything**: it was published with `--environment`, or without a `.env`. Publish again with the command above.
- **`git pull` complains about `app.json`**: see Step 6.
- **Limits**: Expo's free plan has a monthly allowance of builds and update downloads, far more than one person's app needs.

## Use Fuel on an iPhone (web version)

Fuel can't be installed on an iPhone without a paid Apple developer account, but the very same app runs in Safari: same screens, same Supabase, same account system. You publish it to a web address once; your friend opens it, adds it to her Home Screen, and it opens full screen from its own icon like an app.

**Part 1: publish it (on your computer, about 5 minutes the first time)**

Your Expo account hosts it (EAS Hosting). In Command Prompt:

```
cd C:\Users\Manny\health-app
git pull
npm ci
npx expo export --platform web
npx eas-cli@latest deploy --prod
```

- `expo export` builds the web version into a `dist` folder (with the keys from your `.env`, like the APK). It takes a minute or two.
- The first time, `deploy` asks `Choose a preview URL for your project:`. Type a short name with letters, numbers and dashes, like `fuel-manny`, and Enter.
- It ends by printing the addresses. The one marked **Production** is the link to send, like `https://fuel-manny.expo.app`. Open it on your own phone first to check it loads.
- Expo's free plan includes a monthly allowance for web hosting, far more than two people use. If it ever asks you to upgrade, tell me and I'll move it to another free host.

**Part 2: on her iPhone**

1. Open the link in **Safari**.
2. Tap the **Share** button (the square with an arrow, at the bottom), scroll down, tap **Add to Home Screen**, then **Add**. A small card on the dashboard explains this too, until she taps **Got it**.
3. Open **Fuel** from the Home Screen icon (not from Safari) and tap **Create account**. The Home Screen app keeps its own sign-in, separate from Safari's, so she signs in there.
4. Want AI estimates for her too? Add her email to `AI_ALLOWED_EMAILS` ([how](#ai-estimates-optional): the list is comma-separated).

**Part 3: updates.** The installed APK updates over the air, but the web version updates when you publish it again. After a `git pull`, run the same two commands:

```
npx expo export --platform web
npx eas-cli@latest deploy --prod
```

She gets the new version the next time she opens Fuel (closing and reopening it). My release notes will say **Web: publish again** when there's something new for her.

**What's different on an iPhone**
- **No reminders:** browsers can't schedule them, so the Reminders card says so.
- **Offline:** once Fuel is open it shows saved data without a connection, but starting it with no connection at all doesn't work (the web version loads from the internet).
- **Barcode scanning** uses the camera through Safari: allow the camera when asked. If a barcode won't read, **Type the number instead** always works.
- **No vibration** on taps (iPhones don't allow it for websites).
- If she doesn't open Fuel for a few weeks, the iPhone may clear its storage and ask her to sign in again. Her data is safe in Supabase.
- **Feedback** works the same, and says it came from "Web · iPhone · iOS … · Safari", so you can tell bug reports apart.
- If food search only finds her own foods on the web but works on Android, tell me: that would be a database refusing requests from websites, which I couldn't test from here.

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
   8. `20261013090000_water_from_drinks.sql` (water from drinks; safe to run again)
   9. `20261014090000_micronutrients.sql` (vitamins, minerals, salt and caffeine on foods; safe to run again)
   10. `20261014120000_ai_estimates.sql` (AI estimate limits and switch; safe to run again)
   11. `20261015090000_feedback.sql` (feedback and bug reports; safe to run again)

   "Success. No rows returned" means it worked. If you run a file a second time you'll see an error like `type "meal_type" already exists`. That's harmless: it stops at the first line and changes nothing.

   To check your setup, run this in the SQL Editor:

   ```sql
   select
     (select count(*) from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE') as tables,
     (select count(*) from pg_policies where schemaname = 'public') as privacy_rules,
     (select count(*) from public.exercises) as exercises;
   ```

   You should see **18** tables, **25** privacy rules and **29** exercises.
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

   **Recommended, for USDA food search:** without a key, the app uses USDA's shared `DEMO_KEY`, which allows about 30 searches an hour and 50 a day, counted for everyone on your internet connection. On mobile data many people share one connection, so it's often used up before you start, and you only get Open Food Facts results (the logger says so under the results). A free personal key allows 1,000 an hour. Get one at [api.data.gov/signup](https://api.data.gov/signup/) (it's emailed to you straight away) and add a third line:

   ```
   EXPO_PUBLIC_USDA_API_KEY=your-key-here
   ```

   It only needs to be in the `.env` on your computer; you don't have to send it anywhere or push it to GitHub. If it ever leaks, the worst anyone can do is use up its hourly limit, and a new one is free. Open Food Facts needs no key.

   Common mistakes:
   - The file must be named exactly `.env`. Windows Notepad sometimes saves it as `.env.txt`.
   - No quotes, and no spaces around the `=`.
   - Use the project URL itself. If you pasted the REST address ending in `/rest/v1/`, the app trims that part for you.
6. Restart the app with `npx expo start --clear`. The welcome screen's **Create account** button should be active. If it says **Connect Supabase first**, the app isn't reading your `.env`; check the common mistakes above.

> Free Supabase projects pause after 7 days without use. Logging every day keeps yours awake. If it does pause, press **Restore** in the Supabase dashboard.

## AI estimates (optional)

Claude fills in the vitamins, minerals and caffeine that no label or USDA lists, marked **AI** in the app. Your Claude key lives in a Supabase **Edge Function secret**, so it never goes in the app, the APK or this public repo. Don't put it in `.env`: everything in `.env` is public here (and `EXPO_PUBLIC_…` values are built into the app). A leaked Claude key can be used by anyone to run up your bill.

**Which model, and what it costs.** Claude Opus 5.5 (`claude-opus-5-5`), the current Opus and Anthropic's default recommendation, at medium effort. Getting a vitamin profile right for "Haldiram Aloo Bhujia" or a café latte is a recall task, and Opus is the most reliable at it. Each food is asked about **once** and the answer is saved, so cost stays small even on the top model: about $4 per million tokens in and $20 out, roughly **1–4 cents per food**, typically a few cents a week. The function also caps calls: 40 per account and 100 in total per 24 hours (about $3 a day at the very most), and you can lower both. Prefer cheaper? Changing `MODEL` in `supabase/functions/estimate-nutrients/estimate.ts` to `claude-sonnet-5-5` (half the price) or `claude-haiku-5-5` (about 1/40) is a one-line change, at some cost in accuracy. If Claude's safety filter ever declines a request, the API retries it on its recommended fallback model (`fallbacks: "default"`).

**One-time setup** (Windows Command Prompt, in `C:\Users\Manny\health-app`; `npx` downloads the Supabase CLI the first time):

1. Run `supabase/migrations/20261014120000_ai_estimates.sql` in Supabase's SQL Editor (see above).
2. Find your **project ref**: the 20 letters in your Supabase URL, `https://<ref>.supabase.co` (it's in `EXPO_PUBLIC_SUPABASE_URL` in your `.env`).
3. Log the CLI in to your Supabase account (opens your browser):
   ```
   npx supabase login
   ```
4. Store your Claude key as a secret of the function. The name before the `=` is **`ANTHROPIC_API_KEY`**:
   ```
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here --project-ref your-project-ref
   ```
   (Or in the Supabase dashboard: **Edge Functions → Secrets**, name `ANTHROPIC_API_KEY`, value your key.)
5. Recommended: only your account may use AI, even though the app's publishable key is public:
   ```
   npx supabase secrets set AI_ALLOWED_EMAILS=the-email-you-sign-in-with --project-ref your-project-ref
   ```
   Optional limits: `AI_DAILY_LIMIT_PER_USER` (default 40) and `AI_DAILY_LIMIT_TOTAL` (default 100).
6. Deploy the function (no Docker needed):
   ```
   npx supabase functions deploy estimate-nutrients --project-ref your-project-ref --use-api --no-verify-jwt
   ```
   `--no-verify-jwt` is safe: the function checks your sign-in itself, in a way that works with every kind of Supabase key.
7. Open the app → tap the **Salt · Caffeine** line → Nutrients. Foods with gaps are asked about once ("Asking AI about foods with no data…"), then their numbers show the **AI** label.

If something's off, the Nutrients screen says what: function not deployed, key missing or not accepted, SQL not run, or today's limit reached. Each call is logged in the `ai_calls` table (tokens used, model) for you to check in Supabase.

## Feedback and bug reports

Anyone signed in to your Fuel (you, and friends using your APK) can send feedback from the **Feedback** chip on the dashboard or **Profile → Send feedback**. Each message is stored in the `feedback` table in your Supabase with the sender's email, the kind (bug, idea, other), the app version, the phone and the screen it came from. People only ever see their own messages.

**Make yourself the reader** (once, after running `20261015090000_feedback.sql`). In Supabase's SQL Editor, with the email you sign in to Fuel with:

```sql
insert into public.feedback_readers (user_id)
select id from auth.users where email = 'the-email-you-sign-in-with'
on conflict do nothing;
```

The SQL Editor answers "Success. No rows returned" whether or not it added you, so check it worked:

```sql
select u.email from public.feedback_readers r join auth.users u on u.id = r.user_id;
```

Your email should be listed. If nothing comes back, the email didn't match your account exactly: `select email from auth.users;` lists them, so copy yours from there and run the insert again. Then open **Feedback** in the app: under the form you'll see **Everyone's feedback**, newest first, with who sent each one, when, and on which version and phone. To let someone else read it too, run the same line with their email; to remove a reader, `delete from public.feedback_readers where user_id = (select id from auth.users where email = 'their-email');`.

**Or read it in Supabase:** **Table Editor → feedback**, or this in the SQL Editor:

```sql
select created_at, email, kind, message, app_version, device, screen
from public.feedback order by created_at desc;
```

You can delete messages there once dealt with (the app can't change or delete them).

**Removing the button later:** tell me, or change `FEEDBACK_ON_DASHBOARD = true` to `false` in `src/features/feedback/logic.ts` and publish an update (Part 4 of the APK guide). The dashboard chip disappears for everyone; **Profile → Send feedback** stays, so you can still read everything.

## For development

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm test` | Unit and component tests (Jest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (Expo config) |
| `npm run db:verify` | Applies the migrations to a throwaway local Postgres and checks that every user only sees their own data (needs Postgres 15+ installed) |
| `npx eas-cli@latest build --platform android --profile preview` | Builds the installable APK on Expo's servers ([steps](#install-fuel-on-your-phone-apk)) |
| `npx eas-cli@latest update --channel preview --platform android --message "…"` | Sends a new version to the installed app, over the air |

```
src/
  app/            screens (Expo Router): (auth)/ welcome, sign-in, sign-up · onboarding · (tabs)/ dashboard,
                  food-log, progress, profile · log (the logger sheet) · quick-add · food/new · food/[id] · food/preview ·
                  entry/[id]. _layout.tsx routes you by sign-in and setup state.
  components/ui/  PressableScale (instant touch feedback), Button, TextField, OptionCard, SegmentedControl,
                  StepProgress, Text, Card, Icon, AnimatedNumber, EmptyState, Screen, ToastHost, Skeleton
  components/     CalorieGauge, BrandMark, navigation/FloatingTabBar, dashboard/ (gauge, rings, tiles,
                  timeline), food/ (FoodDetail, PortionRuler, QuickAddForm, FoodRow), foodlog/ (MealCard, DayNav)
  features/       auth, onboarding, profile, dashboard (day queries, insights), food (logging queries,
                  label/quick-add parsing, Recent ranking), search (USDA + Open Food Facts, ranking)
  theme/          design tokens (colors, type, spacing) and the theme provider
  lib/            nutrition maths, portions, trend weight, streaks, supabase client, env, units, dates,
                  formatting, meals, haptics, queryCache (saved data for offline, per account)
  features/updates/ over-the-air updates (the "New version ready" banner, Check for updates)
  store/          small Zustand stores (theme, the day you're viewing, toasts)
supabase/
  migrations/     database schema, privacy rules (RLS) and reference data
  tests/          database checks used by scripts/verify-db.sh
__tests__/        Jest tests
```
