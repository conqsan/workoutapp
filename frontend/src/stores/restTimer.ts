import { useSyncExternalStore } from 'react';

/**
 * 组间休息计时器。
 *
 * 为什么放在 stores 而不是 SetRow 里：手风琴只展开一个动作、一次只渲染选中的那一组，
 * 计时器如果活在组件 state 里，一换组就没了。这里做成模块级单例 + localStorage，
 * 所以切组、折叠动作、甚至刷新页面，倒计时都还在。
 *
 * 同一时间只有一个休息计时器（现实中就是练完一组歇一会儿），
 * 在别的组上再点开始会接管当前这个。
 */

const STORAGE_KEY = 'fitlog:rest-timer';
const TICK_MS = 250;

export type RestTimerStatus = 'idle' | 'running' | 'paused' | 'done';

export interface RestTimerState {
  status: RestTimerStatus;
  /** 这个计时器属于哪一组（WorkoutSet.id） */
  setId: string | null;
  /** 动作名，给页面顶部的常驻条显示用 */
  exerciseName: string;
  /** 这一轮休息的总秒数 */
  totalSeconds: number;
  /** 剩余毫秒；running 时按 endsAt 实时折算 */
  remainingMs: number;
}

interface Persisted {
  status: RestTimerStatus;
  setId: string | null;
  exerciseName: string;
  totalSeconds: number;
  /** running 时是结束时间戳；其余状态是剩余毫秒 */
  endsAt: number | null;
  remainingMs: number;
}

const IDLE: RestTimerState = {
  status: 'idle',
  setId: null,
  exerciseName: '',
  totalSeconds: 0,
  remainingMs: 0,
};

let state: RestTimerState = IDLE;
let endsAt: number | null = null;
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;
/** 结束提示音只响一次；AudioContext 必须由用户手势创建，所以在这里懒加载 */
let audio: AudioContext | null = null;

function secondsLeft(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000));
}

function emit(): void {
  for (const listener of listeners) listener();
}

function persist(): void {
  try {
    const payload: Persisted = {
      status: state.status,
      setId: state.setId,
      exerciseName: state.exerciseName,
      totalSeconds: state.totalSeconds,
      endsAt,
      remainingMs: state.remainingMs,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 隐私模式 / 存储满了都不影响计时本身
  }
}

function stopTicker(): void {
  if (ticker !== null) {
    clearInterval(ticker);
    ticker = null;
  }
}

/** 每 250ms 折一次剩余时间；只有「显示出来的秒数」变了才通知，避免无谓重渲染 */
function tick(): void {
  if (state.status !== 'running' || endsAt === null) return;
  const remainingMs = Math.max(0, endsAt - Date.now());
  if (remainingMs <= 0) {
    finish();
    return;
  }
  if (secondsLeft(remainingMs) === secondsLeft(state.remainingMs)) return;
  state = { ...state, remainingMs };
  persist();
  emit();
}

function startTicker(): void {
  stopTicker();
  ticker = setInterval(tick, TICK_MS);
}

function beep(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    void audio.resume();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.45);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.5);
  } catch {
    // 没有音频权限就算了，界面上的「休息结束」照样在
  }
}

function finish(): void {
  stopTicker();
  endsAt = null;
  state = { ...state, status: 'done', remainingMs: 0 };
  persist();
  emit();
  beep();
  try {
    navigator.vibrate?.([120, 80, 120]);
  } catch {
    // 桌面端没有震动
  }
}

function load(): void {
  let stored: Persisted | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    stored = raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    stored = null;
  }
  if (!stored || !stored.setId || !stored.status || stored.status === 'idle') {
    state = IDLE;
    return;
  }

  const total = Number(stored.totalSeconds);
  if (!Number.isFinite(total) || total <= 0) {
    state = IDLE;
    return;
  }

  state = {
    status: stored.status,
    setId: stored.setId,
    exerciseName: typeof stored.exerciseName === 'string' ? stored.exerciseName : '',
    totalSeconds: total,
    remainingMs: Math.max(0, Number(stored.remainingMs) || 0),
  };

  if (stored.status === 'running' && typeof stored.endsAt === 'number') {
    endsAt = stored.endsAt;
    const remaining = endsAt - Date.now();
    if (remaining <= 0) {
      // 关掉页面期间已经到点了：直接进入完成态，不补响提示音
      endsAt = null;
      state = { ...state, status: 'done', remainingMs: 0 };
      return;
    }
    state = { ...state, remainingMs: remaining };
    startTicker();
  }
}

load();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): RestTimerState {
  return state;
}

/** 组件里读计时器状态 */
export function useRestTimer(): RestTimerState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export interface StartRestOptions {
  setId: string;
  exerciseName: string;
  seconds: number;
}

/** 开始（或接管）休息计时 */
export function startRest({ setId, exerciseName, seconds }: StartRestOptions): void {
  const total = Math.round(seconds);
  if (!Number.isFinite(total) || total <= 0) return;

  // 一定要在用户手势里创建 AudioContext，否则结束提示音会被浏览器拦掉
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx && !audio) audio = new Ctx();
    void audio?.resume();
  } catch {
    // ignore
  }

  endsAt = Date.now() + total * 1000;
  state = {
    status: 'running',
    setId,
    exerciseName,
    totalSeconds: total,
    remainingMs: total * 1000,
  };
  persist();
  emit();
  startTicker();
}

export function pauseRest(): void {
  if (state.status !== 'running' || endsAt === null) return;
  const remainingMs = Math.max(0, endsAt - Date.now());
  endsAt = null;
  state = { ...state, status: 'paused', remainingMs };
  stopTicker();
  persist();
  emit();
}

export function resumeRest(): void {
  if (state.status !== 'paused' || state.remainingMs <= 0) return;
  endsAt = Date.now() + state.remainingMs;
  state = { ...state, status: 'running' };
  persist();
  emit();
  startTicker();
}

/** 在剩余时间上加 / 减一段；休息中觉得不够就 +15s，很常用 */
export function adjustRest(deltaSeconds: number): void {
  if (state.status === 'idle') return;
  const deltaMs = Math.round(deltaSeconds) * 1000;

  if (state.status === 'running' && endsAt !== null) {
    endsAt = Math.max(Date.now(), endsAt + deltaMs);
    state = { ...state, remainingMs: Math.max(0, endsAt - Date.now()) };
  } else {
    const next = Math.max(0, state.remainingMs + deltaMs);
    state = { ...state, status: next === 0 ? 'done' : state.status, remainingMs: next };
  }

  state = {
    ...state,
    totalSeconds: Math.max(1, state.totalSeconds + Math.round(deltaSeconds)),
  };
  persist();
  emit();
}

/** 用同样时长再来一轮 */
export function restartRest(): void {
  if (!state.setId) return;
  startRest({
    setId: state.setId,
    exerciseName: state.exerciseName,
    seconds: state.totalSeconds,
  });
}

export function stopRest(): void {
  stopTicker();
  endsAt = null;
  state = IDLE;
  persist();
  emit();
}

/** 00:00 格式；超过 1 小时也给个能看的写法 */
export function formatRestClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}
