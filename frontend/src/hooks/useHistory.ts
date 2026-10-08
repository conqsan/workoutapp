import { useEffect, useState } from 'react';
import { initDataLayer, repository } from '@/data';
import type { SupplementRecordWithSupplement, WorkoutDetail, WorkoutSummary } from '@/data';

export interface UseHistoryResult {
  loading: boolean;
  summaries: WorkoutSummary[];
  error: string | null;
}

/** 历史列表：所有训练的摘要，按日期倒序 */
export function useHistory(): UseHistoryResult {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<WorkoutSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await initDataLayer();
        const list = await repository.listWorkoutSummaries();
        if (!cancelled) setSummaries(list);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '读取历史记录失败。');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, summaries, error };
}

export interface UseHistoryDetailResult {
  loading: boolean;
  workout: WorkoutDetail | null;
  supplements: SupplementRecordWithSupplement[];
  error: string | null;
}

/** 某一次训练的完整明细 + 同一天的补剂记录 */
export function useHistoryDetail(id: string | undefined): UseHistoryDetailResult {
  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [supplements, setSupplements] = useState<SupplementRecordWithSupplement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === undefined || id === '') {
      setLoading(false);
      setError('缺少训练 id。');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await initDataLayer();
        const detail = await repository.getWorkout(id);
        if (cancelled) return;

        if (!detail) {
          setError('找不到这次训练，可能已经被删除了。');
          setWorkout(null);
          return;
        }

        setWorkout(detail);
        // 补剂按「这次训练的那一天」取，不会和别的日期串
        setSupplements(await repository.listSupplementRecords({ date: detail.date }));
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '读取训练详情失败。');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { loading, workout, supplements, error };
}
