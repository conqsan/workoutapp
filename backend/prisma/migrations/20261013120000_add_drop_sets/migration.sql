-- 递减组（drop set）：
--   exercises.weight_slots —— 一组显示几个重量框（普通动作 1，递减组 3）
--   workout_sets.drop_weights —— 后续段重量，JSON 数组字符串（SQLite 没有数组类型），
--   例如 "[15,10]"；普通动作是 "[]"。
ALTER TABLE "exercises" ADD COLUMN "weight_slots" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "workout_sets" ADD COLUMN "drop_weights" TEXT NOT NULL DEFAULT '[]';
