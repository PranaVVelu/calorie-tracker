-- AlterTable
ALTER TABLE "FoodItem" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "protein" DROP NOT NULL,
ALTER COLUMN "carbs" DROP NOT NULL,
ALTER COLUMN "fat" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MealFood" ADD COLUMN     "calories" DOUBLE PRECISION,
ADD COLUMN     "carbs" DOUBLE PRECISION,
ADD COLUMN     "fat" DOUBLE PRECISION,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "protein" DOUBLE PRECISION,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "savedMealId" TEXT,
ADD COLUMN     "servingSize" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "targetMode" TEXT NOT NULL DEFAULT 'calculated';

-- CreateTable
CREATE TABLE "SavedMeal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedMealItem" (
    "id" TEXT NOT NULL,
    "savedMealId" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "servings" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SavedMealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteFood" (
    "userId" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteFood_pkey" PRIMARY KEY ("userId","foodItemId")
);

-- CreateTable
CREATE TABLE "GoalPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "calorieTarget" INTEGER NOT NULL,
    "proteinTarget" INTEGER NOT NULL,
    "carbsTarget" INTEGER NOT NULL,
    "fatTarget" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'calculated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedMeal_userId_idx" ON "SavedMeal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalPeriod_userId_effectiveFrom_key" ON "GoalPeriod"("userId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "FoodItem_userId_idx" ON "FoodItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MealFood_requestId_key" ON "MealFood"("requestId");

-- AddForeignKey
ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMeal" ADD CONSTRAINT "SavedMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMealItem" ADD CONSTRAINT "SavedMealItem_savedMealId_fkey" FOREIGN KEY ("savedMealId") REFERENCES "SavedMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMealItem" ADD CONSTRAINT "SavedMealItem_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteFood" ADD CONSTRAINT "FavoriteFood_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteFood" ADD CONSTRAINT "FavoriteFood_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalPeriod" ADD CONSTRAINT "GoalPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Data backfills (non-destructive)
-- ---------------------------------------------------------------------------

-- 1. Normalise legacy day timestamps. Older code stored the *server's* local
--    midnight (e.g. 08:00Z for a US Pacific server). Round each to the nearest
--    UTC midnight so every row represents its calendar day as UTC midnight.
--    Rows already at UTC midnight are untouched.
UPDATE "MealEntry"
SET "date" = date_trunc('day', "date" + interval '12 hours')
WHERE "date" <> date_trunc('day', "date" + interval '12 hours');

UPDATE "WeightEntry"
SET "date" = date_trunc('day', "date" + interval '12 hours')
WHERE "date" <> date_trunc('day', "date" + interval '12 hours');

-- 2. Snapshot nutrition onto existing log rows so later food edits cannot
--    change what was historically eaten.
UPDATE "MealFood" mf
SET "name"        = f."name",
    "calories"    = f."calories",
    "protein"     = f."protein",
    "carbs"       = f."carbs",
    "fat"         = f."fat",
    "servingSize" = f."servingSize"
FROM "FoodItem" f
WHERE mf."foodItemId" = f."id" AND mf."calories" IS NULL;

-- 3. Seed one open-ended goal period per user from their current targets so
--    historical days have a target to compare against.
INSERT INTO "GoalPeriod" ("id", "userId", "effectiveFrom", "calorieTarget", "proteinTarget", "carbsTarget", "fatTarget", "mode")
SELECT 'gp_' || u."id", u."id", TIMESTAMP '1970-01-01 00:00:00', u."calorieTarget", u."proteinTarget", u."carbsTarget", u."fatTarget", 'calculated'
FROM "User" u
ON CONFLICT DO NOTHING;
