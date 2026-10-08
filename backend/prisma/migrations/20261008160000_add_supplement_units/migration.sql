-- 补剂增加「可选单位」：允许记录时使用的单位列表，存 JSON 数组字符串（SQLite 没有数组类型）。
-- 例如蛋白粉 / 增肌粉：["g","勺"]。默认值给空数组，实际取值由 seed 和前端 syncDefaults 补齐。
ALTER TABLE "supplements" ADD COLUMN "units" TEXT NOT NULL DEFAULT '[]';
