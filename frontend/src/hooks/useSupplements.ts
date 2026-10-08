import { useCallback, useEffect, useRef, useState } from 'react';
import { initDataLayer, repository } from '@/data';
import type {
  CreateSupplementInput,
  Supplement,
  SupplementRecordInput,
  SupplementRecordPatch,
  SupplementRecordWithSupplement,
} from '@/data';
import { todayKey } from '@/data/ids';

export interface UseSupplementsResult {
  loading: boolean;
  date: string;
  setDate: (date: string) => void;
  supplements: Supplement[];
  records: SupplementRecordWithSupplement[];
  error: string | null;
  saving: boolean;
  clearError: () => void;
  add: (input: SupplementRecordInput) => Promise<void>;
  update: (id: string, patch: SupplementRecordPatch) => Promise<void>;
  remove: (id: string) => Promise<void>;
  createSupplement: (input: CreateSupplementInput) => Promise<void>;
}

/**
 * 补剂页的状态。
 * 所有读写都走本地 repository（IndexedDB），后端不需要在线。
 */
export function useSupplements(): UseSupplementsResult {
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => todayKey());
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [records, setRecords] = useState<SupplementRecordWithSupplement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async (targetDate: string) => {
    const [supplementList, recordList] = await Promise.all([
      repository.listSupplements(),
      repository.listSupplementRecords({ date: targetDate }),
    ]);
    if (mountedRef.current) {
      setSupplements(supplementList);
      setRecords(recordList);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await initDataLayer();
        await reload(date);
      } catch (caught) {
        if (mountedRef.current) {
          setError(caught instanceof Error ? caught.message : '读取本地数据失败。');
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [date, reload]);

  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<void> => {
      setSaving(true);
      setError(null);
      try {
        await action();
        await reload(date);
      } catch (caught) {
        if (mountedRef.current) {
          setError(caught instanceof Error ? caught.message : '保存失败，请重试。');
        }
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [date, reload],
  );

  const add = useCallback(
    async (input: SupplementRecordInput) => {
      await run(() => repository.addSupplementRecord({ ...input, date }));
    },
    [date, run],
  );

  const update = useCallback(
    async (id: string, patch: SupplementRecordPatch) => {
      await run(() => repository.updateSupplementRecord(id, patch));
    },
    [run],
  );

  const remove = useCallback(
    async (id: string) => {
      await run(() => repository.removeSupplementRecord(id));
    },
    [run],
  );

  const createSupplement = useCallback(
    async (input: CreateSupplementInput) => {
      await run(() => repository.createSupplement(input));
    },
    [run],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    loading,
    date,
    setDate,
    supplements,
    records,
    error,
    saving,
    clearError,
    add,
    update,
    remove,
    createSupplement,
  };
}
