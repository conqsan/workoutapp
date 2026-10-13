-- 递减组每段各自记次数：workout_sets.drop_reps 存 JSON 数字数组字符串，
-- 与 drop_weights 一一对应，例如 "[8,6]"。
-- v6 之前的递减组次数是整组一份，老数据这里是 "[]"，读的时候按 reps 兜底。
ALTER TABLE "workout_sets" ADD COLUMN "drop_reps" TEXT NOT NULL DEFAULT '[]';
