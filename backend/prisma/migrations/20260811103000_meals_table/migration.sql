-- CreateTable
CREATE TABLE "Meal" (
    "id" SERIAL NOT NULL,
    "dietPlanDayId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Meal_dietPlanDayId_idx" ON "Meal"("dietPlanDayId");

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_dietPlanDayId_fkey" FOREIGN KEY ("dietPlanDayId") REFERENCES "DietPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: convert existing breakfast/lunch/dinner/snacks text into Meal rows
INSERT INTO "Meal" ("dietPlanDayId", "name", "time", "description")
SELECT "id", 'Breakfast', '08:00', "breakfast" FROM "DietPlanDay" WHERE "breakfast" IS NOT NULL AND "breakfast" != '';

INSERT INTO "Meal" ("dietPlanDayId", "name", "time", "description")
SELECT "id", 'Lunch', '13:00', "lunch" FROM "DietPlanDay" WHERE "lunch" IS NOT NULL AND "lunch" != '';

INSERT INTO "Meal" ("dietPlanDayId", "name", "time", "description")
SELECT "id", 'Dinner', '19:00', "dinner" FROM "DietPlanDay" WHERE "dinner" IS NOT NULL AND "dinner" != '';

INSERT INTO "Meal" ("dietPlanDayId", "name", "time", "description")
SELECT "id", 'Snacks', '16:00', "snacks" FROM "DietPlanDay" WHERE "snacks" IS NOT NULL AND "snacks" != '';

-- DropColumns: fixed meal fields replaced by the Meal table above
ALTER TABLE "DietPlanDay" DROP COLUMN "breakfast";
ALTER TABLE "DietPlanDay" DROP COLUMN "lunch";
ALTER TABLE "DietPlanDay" DROP COLUMN "dinner";
ALTER TABLE "DietPlanDay" DROP COLUMN "snacks";
