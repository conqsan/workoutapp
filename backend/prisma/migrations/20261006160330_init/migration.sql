-- CreateTable
CREATE TABLE "muscles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "muscle_id" INTEGER NOT NULL,
    "description" TEXT,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "exercises_muscle_id_fkey" FOREIGN KEY ("muscle_id") REFERENCES "muscles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "start_time" DATETIME,
    "end_time" DATETIME,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "workout_exercises" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workout_id" INTEGER NOT NULL,
    "exercise_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workout_exercises_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workout_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workout_sets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workout_exercise_id" INTEGER NOT NULL,
    "set_number" INTEGER NOT NULL,
    "weight" REAL NOT NULL,
    "reps" INTEGER NOT NULL,
    "rest_seconds" INTEGER,
    "note" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workout_sets_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "workout_exercises" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "supplements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "supplement_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "supplement_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "consumption_time" TEXT,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "supplement_records_supplement_id_fkey" FOREIGN KEY ("supplement_id") REFERENCES "supplements" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "muscles_name_key" ON "muscles"("name");

-- CreateIndex
CREATE INDEX "exercises_muscle_id_idx" ON "exercises"("muscle_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_muscle_id_name_key" ON "exercises"("muscle_id", "name");

-- CreateIndex
CREATE INDEX "workouts_date_idx" ON "workouts"("date");

-- CreateIndex
CREATE INDEX "workouts_status_idx" ON "workouts"("status");

-- CreateIndex
CREATE INDEX "workout_exercises_workout_id_idx" ON "workout_exercises"("workout_id");

-- CreateIndex
CREATE INDEX "workout_exercises_exercise_id_idx" ON "workout_exercises"("exercise_id");

-- CreateIndex
CREATE INDEX "workout_sets_workout_exercise_id_idx" ON "workout_sets"("workout_exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "workout_sets_workout_exercise_id_set_number_key" ON "workout_sets"("workout_exercise_id", "set_number");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_name_key" ON "supplements"("name");

-- CreateIndex
CREATE INDEX "supplement_records_date_idx" ON "supplement_records"("date");

-- CreateIndex
CREATE INDEX "supplement_records_supplement_id_idx" ON "supplement_records"("supplement_id");
