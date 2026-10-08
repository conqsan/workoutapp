import { useCallback, useEffect, useState } from 'react';
import { initDataLayer, repository } from '@/data';
import type { SupplementRecordWithSupplement, WorkoutDetail, WorkoutSummary } from '@/data';

export interface UseHistoryResult {
  loading: boolean;
  summaries: WorkoutSummary[];
  error: string | null;
  removing: boolean;
  /** 删掉一次训练（连它的动作与组一起），删完列表就地刷新 */
  remove: (id: string) => Promise<void>;
}

/** 历史列表：所有训练的摘要，按日期倒序 */
export function useHistory(): UseHistoryResult {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<WorkoutSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

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

  const remove = useCallback(async (id: string): Promise<void> => {
    setRemoving(true);
    setError(null);
    try {
      await repository.deleteWorkout(id);
      setSummaries(await repository.listWorkoutSummaries());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除失败，请重试。');
    } finally {
      setRemoving(false);
    }
  }, []);

  return { loading, summaries, error, removing, remove };
}

export interface UseHistoryDetailResult {
  loading: boolean;
  workout: WorkoutDetail | null;
  supplements: SupplementRecordWithSupplement[];
  error: string | null;
  removing: boolean;
  /** 删掉这次训练；成功返回 true（页面据此返回列表），失败返回 false 并给出提示 */
  remove: () => Promise<boolean>;
}

/** 某一次训练的完整明细 + 同一天的补剂记录 */
export function useHistoryDetail(id: string | undefined): UseHistoryDetailResult {
  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [supplements, setSupplements] = useState<SupplementRecordWithSupplement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

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

  const remove = useCallback(async (): Promise<boolean> => {
    if (id === undefined || id === '') return false;

    setRemoving(true);
    setError(null);
    try {
      await repository.deleteWorkout(id);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除失败，请重试。');
      return false;
    } finally {
      setRemoving(false);
    }
  }, [id]);

  return { loading, workout, supplements, error, removing, remove };
}
