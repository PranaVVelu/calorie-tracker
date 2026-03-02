-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "name" TEXT,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "height" REAL NOT NULL,
    "weight" REAL NOT NULL,
    "activityLevel" REAL NOT NULL,
    "goalType" TEXT NOT NULL,
    "goalRate" REAL NOT NULL,
    "goalWeight" REAL NOT NULL,
    "tdee" REAL NOT NULL,
    "calorieTarget" INTEGER NOT NULL,
    "proteinTarget" INTEGER NOT NULL,
    "carbsTarget" INTEGER NOT NULL,
    "fatTarget" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FoodItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "calories" REAL NOT NULL,
    "protein" REAL NOT NULL,
    "carbs" REAL NOT NULL,
    "fat" REAL NOT NULL,
    "servingSize" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'seed'
);

-- CreateTable
CREATE TABLE "MealEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MealEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealFood" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mealType" TEXT NOT NULL,
    "servings" REAL NOT NULL DEFAULT 1.0,
    "mealEntryId" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MealFood_mealEntryId_fkey" FOREIGN KEY ("mealEntryId") REFERENCES "MealEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealFood_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeightEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weight" REAL NOT NULL,
    "date" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "WeightEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MealEntry_userId_date_key" ON "MealEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WeightEntry_userId_date_key" ON "WeightEntry"("userId", "date");
