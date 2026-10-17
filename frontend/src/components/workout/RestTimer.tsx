import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  adjustRest,
  formatRestClock,
  pauseRest,
  restartRest,
  resumeRest,
  startRest,
  stopRest,
  useRestTimer,
} from '@/stores/restTimer';
import { cn } from '@/utils/cn';

export interface RestTimerProps {
  /** 这一组（WorkoutSet.id）—— 计时器绑定到组，换组不会串 */
  setId: string;
  exerciseName: string;
  /** 这一组计划休息多少秒；null = 没设 */
  restSeconds: number | null;
  disabled: boolean;
  onRestChange: (seconds: number | null) => void;
}

/** 没设过休息时长时的兜底，直接点开始也能量 */
const DEFAULT_REST_SECONDS = 90;
const STEP = 15;

/**
 * 组间休息计时器。
 *
 * 把原来那个「休息 (秒)」输入框换成一个能直接跑的倒计时：
 *   - 空闲：显示这一组计划的休息时长，可以改（也可以 ±15s），点 ▶ 开始
 *   - 计时中：mm:ss + 进度条，可暂停 / 继续、+15s、结束
 *   - 结束：提示「休息结束」，可以同样时长再来一轮
 *
 * 计时状态在 stores/restTimer 里，所以切组、折叠、刷新都不会丢。
 */
export function RestTimer({
  setId,
  exerciseName,
  restSeconds,
  disabled,
  onRestChange,
}: RestTimerProps): ReactElement {
  const timer = useRestTimer();
  const [draft, setDraft] = useState(restSeconds === null ? '' : String(restSeconds));
  /**
   * 输入框的当前值。onChange 到 onBlur 之间 React 可能还没重渲染
   * （打字后立刻点别处就会撞上），所以提交时读 ref 而不是 state。
   */
  const draftRef = useRef(draft);

  useEffect(() => {
    setDraft(restSeconds === null ? '' : String(restSeconds));
    draftRef.current = restSeconds === null ? '' : String(restSeconds);
  }, [restSeconds]);

  const mine = timer.setId === setId && timer.status !== 'idle';
  const planned = restSeconds ?? DEFAULT_REST_SECONDS;

  const commitDraft = (): void => {
    const value = draftRef.current;
    if (value.trim() === '') {
      if (restSeconds !== null) onRestChange(null);
      return;
    }
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0) {
      if (parsed !== restSeconds) onRestChange(parsed === 0 ? null : parsed);
      return;
    }
    setDraft(restSeconds === null ? '' : String(restSeconds));
    draftRef.current = restSeconds === null ? '' : String(restSeconds);
  };

  const bumpPlanned = (delta: number): void => {
    const next = Math.max(0, planned + delta);
    setDraft(String(next));
    draftRef.current = String(next);
    onRestChange(next === 0 ? null : next);
  };

  const start = (): void => {
    if (planned > 0) startRest({ setId, exerciseName, seconds: planned });
  };

  const running = mine && timer.status === 'running';
  const paused = mine && timer.status === 'paused';
  const done = mine && timer.status === 'done';
  const live = running || paused;
  const progress = live ? 1 - timer.remainingMs / Math.max(1, timer.totalSeconds * 1000) : 0;

  return (
    <div className="mt-2" data-testid="rest-timer" data-state={mine ? timer.status : 'idle'}>
      {live ? (
        <div
          className={cn(
            'rounded-xl px-3 py-2 ring-1 transition',
            running ? 'bg-brand-50 ring-brand-200' : 'bg-amber-50 ring-amber-200',
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">
              {running ? '休息中' : '已暂停'}
            </span>
            <span
              className="ml-auto font-mono text-2xl font-bold tabular-nums text-slate-900"
              data-testid="rest-clock"
            >
              {formatRestClock(timer.remainingMs)}
            </span>
            <button
              type="button"
              onClick={() => (running ? pauseRest() : resumeRest())}
              data-testid="rest-pause"
              className="min-h-[34px] shrink-0 rounded-lg bg-white px-3 text-xs font-semibold text-slate-600 ring-1 ring-slate-300"
            >
              {running ? '暂停' : '继续'}
            </button>
            <button
              type="button"
              onClick={() => adjustRest(STEP)}
              data-testid="rest-add"
              className="min-h-[34px] shrink-0 rounded-lg bg-white px-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-300"
            >
              +15
            </button>
            <button
              type="button"
              onClick={stopRest}
              aria-label="结束休息计时"
              data-testid="rest-stop"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-slate-400"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/70">
            <div
              className={cn('h-full rounded-full', running ? 'bg-brand-600' : 'bg-amber-500')}
              style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            />
          </div>
        </div>
      ) : null}

      {done ? (
        <div
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-white"
          data-testid="rest-done"
        >
          <span className="text-sm font-semibold">休息结束</span>
          <span className="ml-auto text-xs text-white/70">歇了 {timer.totalSeconds}s</span>
          <button
            type="button"
            onClick={restartRest}
            data-testid="rest-restart"
            className="min-h-[32px] rounded-lg bg-white/15 px-3 text-xs font-semibold"
          >
            再来一轮
          </button>
          <button
            type="button"
            onClick={stopRest}
            aria-label="关闭"
            className="flex h-[32px] w-[32px] items-center justify-center rounded-lg text-white/70"
          >
            ✕
          </button>
        </div>
      ) : null}

      {!mine ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">休息</span>
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => bumpPlanned(-STEP)}
              aria-label="减少 15 秒"
              className="h-9 w-8 shrink-0 rounded-lg text-slate-400 ring-1 ring-slate-200 disabled:opacity-40"
            >
              −
            </button>
            <input
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              value={draft}
              disabled={disabled}
              placeholder={String(DEFAULT_REST_SECONDS)}
              onChange={(event) => {
                draftRef.current = event.target.value;
                setDraft(event.target.value);
              }}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              aria-label="休息秒数"
              data-testid="rest-input"
              className="field h-9 min-w-0 flex-1 px-1 text-center text-base font-semibold"
            />
            <span className="shrink-0 text-[11px] text-slate-400">秒</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => bumpPlanned(STEP)}
              aria-label="增加 15 秒"
              className="h-9 w-8 shrink-0 rounded-lg text-slate-400 ring-1 ring-slate-200 disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={disabled || planned <= 0}
            onClick={start}
            data-testid="rest-start"
            className="min-h-[36px] shrink-0 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white disabled:opacity-40"
          >
            ▶ 开始
          </button>
        </div>
      ) : null}
    </div>
  );
}
