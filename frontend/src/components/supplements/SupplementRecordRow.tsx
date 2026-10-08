import { useEffect, useState, type ReactElement } from 'react';
import type { SupplementRecordPatch, SupplementRecordWithSupplement } from '@/data';

const TIME_PRESETS = ['早餐', '训练前', '训练后', '睡前'] as const;

export interface SupplementRecordRowProps {
  record: SupplementRecordWithSupplement;
  disabled: boolean;
  onUpdate: (id: string, patch: SupplementRecordPatch) => void;
  onRemove: (id: string) => void;
}

export function SupplementRecordRow({
  record,
  disabled,
  onUpdate,
  onRemove,
}: SupplementRecordRowProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(record.amount));
  const [unit, setUnit] = useState(record.unit);
  const [time, setTime] = useState(record.consumptionTime);
  const [note, setNote] = useState(record.note);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setAmount(String(record.amount));
    setUnit(record.unit);
    setTime(record.consumptionTime);
    setNote(record.note);
  }, [record.amount, record.unit, record.consumptionTime, record.note]);

  const save = (): void => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setAmount(String(record.amount));
      return;
    }
    setEditing(false);
    onUpdate(record.id, { amount: parsed, unit, consumptionTime: time, note });
  };

  const summary = [
    `${record.amount}${record.unit}`,
    record.consumptionTime || null,
    record.note || null,
  ]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' · ');

  return (
    <div
      className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"
      data-testid="supplement-record"
    >
      {editing ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">{record.supplementName}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">用量</span>
              <input
                type="text"
                inputMode="decimal"
                data-testid="record-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="field h-11 text-center text-base font-semibold"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">单位</span>
              <input
                type="text"
                data-testid="record-unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                className="field h-11 text-center text-base font-semibold"
              />
            </label>
          </div>
          {record.units.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500">可选单位</span>
              <div className="flex flex-wrap gap-1.5" data-testid="unit-options">
                {record.units.map((option) => (
                  <button
                    key={option}
                    type="button"
                    data-testid="unit-option"
                    data-unit={option}
                    onClick={() => setUnit(option)}
                    className={`min-h-[32px] rounded-full px-3 text-xs font-medium ${
                      unit === option
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {TIME_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTime(preset)}
                className={`min-h-[32px] rounded-full px-3 text-xs font-medium ${
                  time === preset
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={note}
            placeholder="备注（可留空）"
            onChange={(event) => setNote(event.target.value)}
            className="field h-11 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={save}
              data-testid="save-record"
              className="btn btn-primary h-11 flex-1 text-sm"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn btn-secondary h-11 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{record.supplementName}</p>
            <p className="truncate text-sm text-slate-600">{summary}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setEditing(true)}
              data-testid="edit-record"
              className="min-h-[32px] rounded-lg px-2 text-xs font-medium text-brand-600 disabled:opacity-50"
            >
              改
            </button>
            {confirmRemove ? (
              <>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(record.id)}
                  data-testid="confirm-remove-record"
                  className="min-h-[32px] rounded-lg bg-rose-600 px-2 text-xs font-semibold text-white"
                >
                  确认
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  className="min-h-[32px] rounded-lg px-2 text-xs font-medium text-slate-500"
                >
                  取消
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setConfirmRemove(true)}
                data-testid="remove-record"
                className="min-h-[32px] rounded-lg px-2 text-xs font-medium text-rose-500 disabled:opacity-50"
              >
                删
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
