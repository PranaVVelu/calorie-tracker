# MacroTrack: Calorie & Macro Tracker

MacroTrack is a full-stack Next.js application designed to help users manage their dietary goals, log foods, and track their weight over time. 

Built with React (Next.js App Router), Tailwind CSS, and Prisma (Postgres), the app pairs a fast local food database with an AI-powered natural language meal parser (Google Gemini) so users can log food the way they'd describe it out loud.

## Architecture & Features

The application is structured into four primary user flows:

1. **Dashboard (`/`)**: A daily overview displaying remaining calories, macronutrient progress rings (Protein, Carbs, Fat), a quick view of today's logged meals, and overall goal status.
2. **AI Meal Logging (`/log`)**: Users can describe a meal in plain English (e.g. "grilled chicken sandwich with fries and a small side salad"), and the Gemini API estimates calories, protein, carbs, fat, and serving size, which the user reviews before saving. A traditional searchable interface over a locally seeded database of 100+ food items is also available as a fallback.
3. **Weight Tracking (`/weight`)**: Allows users to log their weight. It also features a "Time to Goal" estimation engine that provides projections based on both theoretical intake and actual historical scale trends.
4. **Settings & Onboarding (`/settings`)**: A form to capture demographic data (age, weight, height, gender, activity level) and dietary goals (lose/maintain/gain, target rate).

## AI Integration

`src/actions/ai.actions.ts` sends the user's free-text meal description to Gemini (`gemini-2.0-flash`) with a structured-output prompt, requesting a strict JSON object (name, calories, protein, carbs, fat, servingSize). The response is validated and defensively parsed before being surfaced to the user for review, then saved through the same `createCustomFoodAndAddToMeal` path used by manual entries.

## Setup Instructions

1. **Prerequisites**: Ensure you have Node.js (v18+) and npm installed.
2. **Install Dependencies**:
   ```bash
   cd calorie-tracker
   npm install
   ```
3. **Set up your Gemini API key** (free tier, no card required):
   - Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
   - Create a `.env.local` file in the project root and add:
     ```
     GEMINI_API_KEY=your_key_here
     ```
4. **Initialize Database**:
   Push the Prisma schema to create the tables:
   ```bash
   npx prisma db push
   ```
5. **Seed the Database**:
   Populate the database with the initial 100 food items and two sample users ("John Loss" and "Jane Gain"):
   ```bash
   npm run seed
   ```
6. **Run the Development Server**:
   ```bash
   npm run dev
   ```
7. **Access the App**:
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
