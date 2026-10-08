import { Suspense, lazy, type ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { HistoryPage } from '@/pages/HistoryPage';
import { HistoryDetailPage } from '@/pages/HistoryDetailPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SupplementsPage } from '@/pages/SupplementsPage';
import { WorkoutPage } from '@/pages/WorkoutPage';

/**
 * 统计页用图表库（Recharts，体积不小），单独切成一个 chunk 按需加载。
 * 首页 / 训练页是打开 App 就要用的，不该被图表拖慢。
 */
const StatsPage = lazy(() =>
  import('@/pages/StatsPage').then((module) => ({ default: module.StatsPage })),
);

function PageFallback(): ReactElement {
  return (
    <div className="space-y-3">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
    </div>
  );
}

export default function App(): ReactElement {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="workout" element={<WorkoutPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/:id" element={<HistoryDetailPage />} />
        <Route
          path="stats"
          element={
            <Suspense fallback={<PageFallback />}>
              <StatsPage />
            </Suspense>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="supplements" element={<SupplementsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
