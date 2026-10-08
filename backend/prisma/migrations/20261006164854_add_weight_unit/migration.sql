-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_workout_sets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workout_exercise_id" INTEGER NOT NULL,
    "set_number" INTEGER NOT NULL,
    "weight" REAL NOT NULL,
    "weight_unit" TEXT NOT NULL DEFAULT 'kg',
    "reps" INTEGER NOT NULL,
    "rest_seconds" INTEGER,
    "note" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workout_sets_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "workout_exercises" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_workout_sets" ("completed", "created_at", "id", "note", "reps", "rest_seconds", "set_number", "updated_at", "weight", "workout_exercise_id") SELECT "completed", "created_at", "id", "note", "reps", "rest_seconds", "set_number", "updated_at", "weight", "workout_exercise_id" FROM "workout_sets";
DROP TABLE "workout_sets";
ALTER TABLE "new_workout_sets" RENAME TO "workout_sets";
CREATE INDEX "workout_sets_workout_exercise_id_idx" ON "workout_sets"("workout_exercise_id");
CREATE UNIQUE INDEX "workout_sets_workout_exercise_id_set_number_key" ON "workout_sets"("workout_exercise_id", "set_number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
