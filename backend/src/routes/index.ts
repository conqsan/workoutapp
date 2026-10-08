import type { FastifyInstance } from 'fastify';
import { API_PREFIX } from '../utils/constants';
import { exerciseRoutes } from './exercise.routes';
import { healthRoutes } from './health.routes';
import { muscleRoutes } from './muscle.routes';
import { supplementRoutes } from './supplement.routes';
import { supplementRecordRoutes } from './supplementRecord.routes';
import { workoutRoutes } from './workout.routes';

/**
 * 所有业务路由都挂载到 /api 前缀下。
 * 后续 Phase 会在这里追加 workouts / workout-exercises / sets / supplement-records 等路由。
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(muscleRoutes);
      await api.register(exerciseRoutes);
      await api.register(supplementRoutes);
      await api.register(supplementRecordRoutes);
      await api.register(workoutRoutes);
    },
    { prefix: API_PREFIX },
  );
}
