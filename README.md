# MacroTrack: Calorie & Macro Tracker

MacroTrack is a full-stack Next.js application designed to help users manage their dietary goals, log foods, and track their weight over time. 

Built with React (Next.js App Router), Tailwind CSS, and Prisma (SQLite), this application operates entirely locally for rapid development and testing without reliance on external paid APIs.

## Architecture & Features

The application is structured into three primary user flows:

1. **Dashboard (`/`)**: A daily overview displaying remaining calories, macronutrient progress rings (Protein, Carbs, Fat), a quick view of today's logged meals, and overall goal status.
2. **Food Logging (`/log`)**: A searchable interface connecting to a locally seeded database of 100+ food items. Users can add foods to specific meals (Breakfast, Lunch, Dinner, Snack) with adjustable serving sizes.
3. **Weight Tracking (`/weight`)**: Allows users to log their weight. It also features a "Time to Goal" estimation engine that provides projections based on both theoretical intake and actual historical scale trends.
4. **Settings & Onboarding (`/settings`)**: A form to capture demographic data (age, weight, height, gender, activity level) and dietary goals (lose/maintain/gain, target rate).

## Setup Instructions

1. **Prerequisites**: Ensure you have Node.js (v18+) and npm installed.
2. **Install Dependencies**:
   ```bash
   cd calorie-tracker
   npm install
   ```
3. **Initialize Database**:
   The project uses a local SQLite database (`dev.db`). Push the Prisma schema to create the tables:
   ```bash
   npx prisma db push
   ```
4. **Seed the Database**:
   Populate the database with the initial 100 food items and two sample users ("John Loss" and "Jane Gain"):
   ```bash
   npm run seed
   ```
5. **Run the Development Server**:
   ```bash
   npm run dev
   ```
6. **Access the App**:
   Open `http://localhost:3000` in your browser. 
   *(Note: The app is currently hardcoded in the frontend to load the profile of `loser@test.com` for demonstration purposes. To view the weight gain profile, you can manually change the `email` variable in `src/app/page.tsx` to `gainer@test.com`.)*

## Algorithms & Logic

The core algorithmic logic is located in `src/utils/algorithms.ts` and is covered by Jest unit tests (`npm test`).

### 1. BMR & TDEE
We use the **Mifflin-St Jeor equation** to calculate Base Metabolic Rate (BMR):
- Men: `10 × weight(kg) + 6.25 × height(cm) - 5 × age(y) + 5`
- Women: `10 × weight(kg) + 6.25 × height(cm) - 5 × age(y) - 161`

Total Daily Energy Expenditure (TDEE) is then calculated as `BMR × Activity Multiplier` (ranging from 1.2 for sedentary to 1.9 for extra active).

### 2. Calorie Targets & Guardrails
- 1 kg of body fat contains roughly 7,700 kcal.
- To lose 0.5 kg a week, a daily deficit of ~550 kcal is required `(0.5 * 7700 / 7)`.
- **Safety Guardrails:** The algorithm enforces a minimum daily allowance of 1,200 kcal for women and 1,500 kcal for men to ensure nutritional safety, overriding extreme target rates if necessary.

### 3. Macronutrient Distribution
By default, the app calculates static, diet-safe macro ratios based on the calorie target:
- **Protein**: 2.0g per kg of body weight (for muscle retention/growth during cuts or bulks) or 1.8g for maintenance.
- **Fat**: 25% of total daily calories.
- **Carbohydrates**: The remaining allotted calories.

### 4. Time to Goal Estimator
The `/weight` page provides two distinct projections:
- **Projected by Intake**: Compares theoretical intake (Target Calories) against TDEE. Using the 7,700 kcal/kg rule, it dictates how many weeks it should take to reach the goal weight.
- **Projected by Scale Trend**: A linear regression algorithm that analyzes historical `WeightEntry` logs to find the current trajectory slope. It extends this line into the future to predict the exact date the goal weight will be achieved, accounting for plateaus or actual metabolism variances.
