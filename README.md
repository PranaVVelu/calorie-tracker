# MacroTrack

A calorie and macro tracker built for fast daily logging and progress that's easy to read. Next.js (App Router), React 19, Tailwind CSS 4, Prisma and Postgres, Recharts.

**Try it without signing up:** open the app and choose **Try the demo** (or visit `/?demo=1`). The demo has six weeks of labelled sample data, stored only in your browser.

## What it does

| Screen | Highlights |
| --- | --- |
| **Today** (`/`) | Calorie ring with consumed / target / remaining, neutral "kcal over target" wording, protein·carbs·fat progress, meals grouped with per-meal totals, previous/next day and date picker, edit / delete with Undo, copy a meal to another day, save a meal for reuse, one-tap quick add of recent foods. |
| **Log food** (sheet, `N` key or ＋ button) | Recent foods (with your last portion), favorites, search, saved meals, manual entry, and AI "Describe" (Gemini). Portion editor accepts decimals or grams/ml, with live nutrition totals. The selected day and meal stay visible throughout. Duplicate submissions are ignored. |
| **Progress** (`/progress`) | 7/30/90-day ranges. Weight chart with weigh-ins plus a labelled 7-day trailing average, calorie and protein bars against the target in effect each day, tap any day to see its entries, a table view, and summaries showing how many days each one is based on. |
| **Foods** (`/foods`) | Create, edit, delete and log saved meals; your custom foods; favorites. |
| **Goals** (`/settings`) | Step-by-step explanation of calculated targets (BMR → TDEE → goal adjustment → macros), custom override, profile, units (metric/imperial), demo controls. |

### Data rules worth knowing
- **Local dates.** Every day is the user's local calendar day (`yyyy-MM-dd`), stored as UTC midnight.
- **Unknown ≠ zero.** Macros left blank are stored as `null`. Totals add up the known values and flag "N items unknown".
- **History is immutable.** Each log entry snapshots its nutrition. Editing a food or a saved meal later never changes past days.
- **Goal history.** Target changes apply from the chosen day forward (`GoalPeriod`), so past days are compared against the target in effect at the time.
- **Missing days are missing.** Averages use only completed days with logs, exclude today, and always say how many days they include.
- **Idempotent writes.** Logging calls carry a client `requestId` (unique in the database), so double-taps and retries create a single entry.

## Architecture

```
src/
  app/                    routes (thin pages)
  components/
    app/                  AppShell (sidebar, bottom nav, demo banner), AppContext (logger, highlights)
    logging/              LoggerSheet, PortionEditor, ManualForm, SavedMealLogger
    today/ progress/ foods/  screen components
    ui/                   design-system primitives (Button, Dialog, Segmented, Field, CalorieRing, MacroBar, Toast…)
  lib/
    api.ts                DataApi interface — the one contract the UI uses
    liveApi.ts            → server actions (Prisma/Postgres)
    demo/                 → in-browser demo store + deterministic sample data
    data/DataProvider.tsx mode switch + tiny shared query cache (mutations refresh every screen)
    nutrition.ts analytics.ts dates.ts validation.ts targets.ts   pure, unit-tested logic
  actions/data.actions.ts server actions (validate input, resolve the user on the server)
```

The live and demo backends implement the same `DataApi` and share the same pure aggregation code, so every screen behaves the same in both modes. **Demo data never reaches the server**: the demo store lives in `localStorage` under its own key and makes no server-action calls.

## Local setup

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # fill in DATABASE_URL / DIRECT_URL
npx prisma migrate deploy   # create/upgrade the schema
npm run seed                # optional: food catalog + sample users (idempotent)
npm run dev
```

Prisma CLI reads `.env`, and the Next dev server reads both `.env` and `.env.local`. The seed script needs the variables in the shell environment (`set -a; . ./.env; set +a; npm run seed`).

Environment variables are documented in `.env.example`:
- `DATABASE_URL`: pooled connection used at runtime.
- `DIRECT_URL`: direct (non-pooled) connection used by migrations.
- `MACROTRACK_USER_EMAIL`: which account the single-user app uses. Default: `loser@test.com`.
- `GEMINI_API_KEY`: optional, enables AI "Describe".
- `NEXT_PUBLIC_DEMO_ONLY`: `true` makes the demo the only mode.

Checks:

```bash
npm test          # Jest: calculations, dates, validation, analytics, demo store
npm run lint
npx next build
```

## Upgrading an existing database (migration `20261112000000_macrotrack_v2`)

The migration is additive and keeps existing data:

1. Adds nullable nutrition-snapshot columns, `requestId` (unique) and `savedMealId` to `MealFood`, then backfills the snapshots from each row's `FoodItem`.
2. Makes `FoodItem.protein/carbs/fat` nullable, and adds `userId` (owner of custom foods) and `createdAt`.
3. Adds `User.targetMode` (default `calculated`) and the `SavedMeal`, `SavedMealItem`, `FavoriteFood` and `GoalPeriod` tables. It seeds one open-ended `GoalPeriod` per user from their current targets.
4. Normalises `MealEntry.date` and `WeightEntry.date` to UTC midnight. Older code stored the *server's* local midnight. Each value is rounded to the nearest UTC midnight, so it keeps its calendar day.

Apply it once against production with the **direct** URL:

```bash
DATABASE_URL="<direct url>" DIRECT_URL="<direct url>" npx prisma migrate deploy
```

Take a backup or snapshot first (Supabase and Neon both support this). Step 4 fails, rather than overwriting anything, if a user somehow has two day rows that round to the same date. If that happens, restore the snapshot (or mark the migration rolled back with `prisma migrate resolve`), merge those rows by hand, and re-run. I tested the migration locally against data shaped like the old app's (Pacific-time midnights, unsnapshotted entries). Existing custom foods stay shared (`userId` null). The 80 "Generic Food Item N" rows from the old seed are not deleted automatically.

## Deploying on Vercel

1. Import the repo into Vercel (framework preset: Next.js; the defaults are fine since `postinstall` runs `prisma generate`).
2. Pick a mode:
   - **Portfolio / public link:** set `NEXT_PUBLIC_DEMO_ONLY=true` and no database variables. Visitors only see the demo, server actions refuse database access, and AI estimates are disabled.
   - **Personal use:** add a Postgres database from the Vercel Marketplace (Neon, Supabase or Prisma Postgres). Set `DATABASE_URL` to the pooled URL and `DIRECT_URL` to the non-pooled one. Run `npx prisma migrate deploy` once from your machine, not on every build.
3. ⚠️ There is **no authentication** yet. A deployment with `DATABASE_URL` set exposes your single account to anyone who has the URL. Keep personal deployments private (e.g. Vercel Deployment Protection), or use demo-only mode for public links.

You can run both at once: one private Vercel project connected to the database, and a second demo-only project for the portfolio.

## Algorithms

`src/utils/algorithms.ts` (covered by Jest):
- **BMR:** Mifflin-St Jeor.
- **TDEE:** BMR × activity multiplier (1.2–1.9).
- **Calorie target:** TDEE ± goal rate × 1,100 kcal/day (7,700 kcal per kg ÷ 7), with a safety floor of 1,500 kcal (male) or 1,200 kcal (female).
- **Macros:** protein 2.0 g/kg (1.8 when maintaining), fat 25% of calories, carbs make up the remainder.

The Goals screen walks through these steps with the user's own numbers.

## Limitations / next steps
- **Auth:** single-user; the account is chosen with `MACROTRACK_USER_EMAIL`. Adding auth (e.g. Auth.js) only needs `currentUser()` in `data.actions.ts` to change.
- **Food database:** search covers a ~90-item reference catalog plus your own foods. An external food database (USDA FoodData Central, Open Food Facts) would plug into `searchFoods`.
- **Editing foods:** custom foods can't be edited or deleted from the UI yet. Logged entries are snapshots, so adding this wouldn't affect history.
- **Units:** the unit preference is stored per browser (`localStorage`), not per account.
