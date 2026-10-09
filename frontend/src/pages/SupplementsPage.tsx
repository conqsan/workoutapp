import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { DateField } from '@/components/DateField';
import { SupplementRecordRow } from '@/components/supplements/SupplementRecordRow';
import { initDataLayer, repository } from '@/data';
import { todayKey } from '@/data/ids';
import { useSupplements } from '@/hooks/useSupplements';
import { cn } from '@/utils/cn';

const TIME_PRESETS = ['早餐', '训练前', '训练后', '睡前'] as const;

export function SupplementsPage(): ReactElement {
  const {
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
  } = useSupplements();

  const [supplementId, setSupplementId] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const [time, setTime] = useState<string>('训练后');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // 默认选中第一个补剂
  useEffect(() => {
    if (supplementId === '' && supplements.length > 0) {
      const first = supplements[0];
      if (first) {
        setSupplementId(first.id);
        setUnit(first.unit);
      }
    }
  }, [supplementId, supplements]);

  /**
   * 选中补剂时，用「最近一次吃的量」预填。
   * 每天吃的量基本固定，这样大多数时候只要点一下「添加」。
   */
  useEffect(() => {
    if (supplementId === '' || amount !== '') return;

    let cancelled = false;
    void (async () => {
      await initDataLayer();
      const history = await repository.listSupplementRecords({ supplementId });
      const latest = history[0];
      if (!cancelled && latest) {
        setAmount(String(latest.amount));
        setUnit(latest.unit);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supplementId, amount]);

  const handlePick = useCallback(
    (id: string) => {
      setSupplementId(id);
      const picked = supplements.find((supplement) => supplement.id === id);
      if (picked) setUnit(picked.unit);
    },
    [supplements],
  );

  const handleAdd = (): void => {
    const parsed = Number(amount);
    if (supplementId === '') return;
    if (!Number.isFinite(parsed) || parsed < 0) return;

    void add({
      supplementId,
      amount: parsed,
      unit: unit.trim() || undefined,
      consumptionTime: time,
      note,
    });
    setAmount('');
    setNote('');
    setNoteOpen(false);
  };

  const handleCreateSupplement = async (): Promise<void> => {
    const name = newName.trim();
    if (name.length === 0) {
      setCreateError('请输入补剂名称。');
      return;
    }
    setCreateError(null);
    try {
      await createSupplement({ name });
      setNewName('');
      setCreating(false);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : '创建失败，请重试。');
    }
  };

  const isToday = date === todayKey();
  const selectedSupplement = supplements.find((item) => item.id === supplementId) ?? null;
  /** 这个补剂允许的单位（第一项是默认），例如蛋白粉 → g / 勺 */
  const unitOptions = selectedSupplement?.units ?? [];

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex items-start justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2">
          <p className="text-sm text-rose-700">{error}</p>
          <button type="button" onClick={clearError} className="text-xs font-medium text-rose-500">
            知道了
          </button>
        </div>
      ) : null}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">记录补剂</h2>
          <div className="flex items-center gap-2">
            {isToday ? null : (
              <button
                type="button"
                onClick={() => setDate(todayKey())}
                className="min-h-[32px] rounded-lg px-2 text-xs font-medium text-brand-600"
              >
                回到今天
              </button>
            )}
            <DateField
              value={date}
              size="sm"
              testId="record-date"
              ariaLabel="补剂日期"
              onChange={(next) => setDate(next || todayKey())}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {supplements.map((supplement) => (
            <button
              key={supplement.id}
              type="button"
              data-testid="supplement-chip"
              data-name={supplement.name}
              onClick={() => handlePick(supplement.id)}
              className={cn(
                'min-h-[40px] rounded-full px-3.5 text-sm font-medium transition',
                supplement.id === supplementId
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600',
              )}
            >
              {supplement.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCreating((open) => !open)}
            className="min-h-[40px] rounded-full px-3.5 text-sm font-medium text-brand-600 ring-1 ring-brand-200"
          >
            + 新建补剂
          </button>
        </div>

        {creating ? (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="补剂名称，例如：鱼油"
              className="field h-11 text-sm"
            />
            {createError ? <p className="text-xs text-rose-600">{createError}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCreateSupplement()}
                className="btn btn-primary h-11 flex-1 text-sm"
              >
                创建
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setCreateError(null);
                }}
                className="btn btn-secondary h-11 text-sm"
              >
                取消
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">用量</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              placeholder="5"
              data-testid="record-amount-input"
              onChange={(event) => setAmount(event.target.value)}
              className="field h-12 text-center text-lg font-semibold"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">单位</span>
            <input
              type="text"
              value={unit}
              data-testid="record-unit-input"
              onChange={(event) => setUnit(event.target.value)}
              className="field h-12 text-center text-lg font-semibold"
            />
          </label>
        </div>

        {unitOptions.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">可选单位</span>
            <div className="flex flex-wrap gap-1.5" data-testid="unit-options">
              {unitOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  data-testid="unit-option"
                  data-unit={option}
                  onClick={() => setUnit(option)}
                  className={cn(
                    'min-h-[32px] rounded-full px-3 text-xs font-medium transition',
                    unit === option ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <span className="mb-1 block text-[11px] font-medium text-slate-500">时间</span>
          <div className="flex flex-wrap gap-1.5">
            {TIME_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTime(preset)}
                className={cn(
                  'min-h-[36px] rounded-full px-3 text-sm font-medium',
                  time === preset ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600',
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {noteOpen ? (
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="备注（可留空）"
            className="field h-11 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="min-h-[32px] text-xs font-medium text-slate-400"
          >
            + 加备注
          </button>
        )}

        <button
          type="button"
          disabled={saving || supplementId === '' || amount.trim() === ''}
          onClick={handleAdd}
          data-testid="add-record"
          className="btn btn-primary h-12 w-full text-base disabled:opacity-40"
        >
          添加记录
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="section-title px-1">
          {isToday ? '今天的补剂' : `${date} 的补剂`}
          {records.length > 0 ? `（${records.length} 条）` : ''}
        </h2>

        {records.length === 0 ? (
          <div className="card">
            <p className="text-sm text-slate-500">这一天还没有补剂记录。</p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="record-list">
            {records.map((record) => (
              <SupplementRecordRow
                key={record.id}
                record={record}
                disabled={saving}
                onUpdate={(id, patch) => void update(id, patch)}
                onRemove={(id) => void remove(id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
