# repositories/

数据访问层（Repository）。所有 Prisma 查询都应收敛在这一层，
Service 层只依赖 Repository 暴露的方法，不直接持有 `PrismaClient` 细节。

Phase 2 会在这里添加：

- `muscle.repository.ts`
- `exercise.repository.ts`
- `supplement.repository.ts`

Phase 3+ 会添加：

- `workout.repository.ts`
- `workoutExercise.repository.ts`
- `workoutSet.repository.ts`
