/**
 * 「一组有几个重量框」的纯逻辑（递减组）。
 *
 * 为什么单独一层：训练页和「历史详情」里的组编辑都要同一套规则，写两遍一定会漂。
 * 规则（由 shared/defaults/exercises.json 的 weightSlots 决定）：
 *   - 普通动作 1 个框：填第 1 段的重量与次数
 *   - 递减组 3 个框：**每段各自的重量与次数**；前两段必填，第 3 段可选
 * 段数上限 3：再多的话手机上就没法用了，而且现实里也罕见。
 */

import { formatWeightValue, roundWeight, setSegments } from './weight';

const MAX_SLOTS = 3;

/** 一组最多几段（把动作上的 weightSlots 收敛到 1～3） */
export function slotCount(weightSlots: number | undefined): number {
  if (weightSlots === undefined || !Number.isFinite(weightSlots)) return 1;
  const count = Math.trunc(weightSlots);
  return count > 1 ? Math.min(count, MAX_SLOTS) : 1;
}

/** 必填的段数：普通动作 1 段，递减组前 2 段 */
export function requiredSlotCount(weightSlots: number | undefined): number {
  return Math.min(slotCount(weightSlots), 2);
}

/** 这一组有多少段（已填的段数，含第一段） */
export function segmentCount(set: {
  weight: number;
  dropWeights?: readonly number[] | undefined;
}): number {
  return 1 + (set.dropWeights?.length ?? 0);
}

/** 把一组拆成输入框里的字符串，按段数补齐空字符串 */
export function weightInputValues(
  set: { weight: number; dropWeights?: readonly number[] | undefined },
  slots: number,
): string[] {
  const segments = [set.weight, ...(set.dropWeights ?? [])];
  return Array.from({ length: slots }, (_, index) => {
    const value = segments[index];
    return typeof value === 'number' && Number.isFinite(value) ? formatWeightValue(value) : '';
  });
}

export type SegmentParseResult =
  | { ok: true; weight: number; reps: number; dropWeights: number[]; dropReps: number[] }
  | {
      ok: false;
      /** incomplete：还差另一半（保留用户输入，只提示）；invalid：填的东西本身不合法（还原） */
      kind: 'incomplete' | 'invalid';
      index: number;
      field: 'weight' | 'reps';
      message: string;
    };

/**
 * 解析递减组的输入框（每段各有重量与次数）。
 *
 * 规则：
 *   - 前 `required` 段（普通动作 1 段、递减组 2 段）重量与次数都必须填
 *   - 第 3 段可选，但要么都填、要么都不填（只填一半会报错，避免记成有头无尾）
 *   - 不允许跳填：第 2 段空着时直接填第 3 段会被拦下
 */
export function parseSegmentInputs(
  weights: readonly string[],
  reps: readonly string[],
  weightSlots: number | undefined,
): SegmentParseResult {
  const slots = slotCount(weightSlots);
  const required = requiredSlotCount(weightSlots);
  const parsed: Array<{ weight: number; reps: number }> = [];

  for (let index = 0; index < slots; index += 1) {
    const rawWeight = (weights[index] ?? '').trim();
    const rawReps = (reps[index] ?? '').trim();
    const label = `第 ${index + 1} 段`;

    if (rawWeight === '') {
      // 重量是「这一段到底练没练」的标志：重量空着就当这一段没填。
      // 必填段报错；可选段（第 3 段）直接结束 —— 这样把第 3 段的重量清掉就能整段去掉，
      // 不用先删次数再删重量（那种顺序会被校验挡住）。
      if (index < required) {
        return {
          ok: false,
          kind: 'incomplete',
          index,
          field: 'weight',
          message: `${label}重量必填`,
        };
      }
      break;
    }
    if (rawReps === '') {
      return {
        ok: false,
        kind: 'incomplete',
        index,
        field: 'reps',
        message: `${label}次数必填`,
      };
    }

    const weight = Number(rawWeight);
    if (!Number.isFinite(weight) || weight < 0) {
      return {
        ok: false,
        kind: 'invalid',
        index,
        field: 'weight',
        message: '重量请填不小于 0 的数字',
      };
    }
    const parsedReps = Number(rawReps);
    if (!Number.isInteger(parsedReps) || parsedReps <= 0) {
      return {
        ok: false,
        kind: 'invalid',
        index,
        field: 'reps',
        message: '次数请填大于 0 的整数',
      };
    }

    parsed.push({ weight: roundWeight(weight), reps: parsedReps });
  }

  const [first, ...drops] = parsed;
  return {
    ok: true,
    weight: first?.weight ?? 0,
    reps: first?.reps ?? 1,
    dropWeights: drops.map((segment) => segment.weight),
    dropReps: drops.map((segment) => segment.reps),
  };
}

/** 次数输入框的初始值（按段数补齐空字符串） */
export function repsInputValues(
  set: { reps: number; dropReps?: readonly number[] | undefined },
  slots: number,
): string[] {
  const all = [set.reps, ...(set.dropReps ?? [])];
  return Array.from({ length: slots }, (_, index) => {
    const value = all[index];
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  });
}

/**
 * 芯片上的短摘要：「80×10」；递减组「20×10 / 15×8 / 10×6」。
 * 传 unit 时每段带上单位（「80kg×10」），测试与无障碍用这个。
 */
export function formatSegmentWeights(
  set: {
    weight: number;
    reps: number;
    dropWeights?: readonly number[] | undefined;
    dropReps?: readonly number[] | undefined;
  },
  unit = '',
): string {
  return setSegments(set)
    .map((segment) => `${formatWeightValue(segment.weight)}${unit}×${segment.reps}`)
    .join(' / ');
}

/** 界面上的完整写法：「80kg × 10」；递减组「20kg × 10 → 15kg × 8 → 10kg × 6」 */
export function formatSetSummary(set: {
  weight: number;
  reps: number;
  dropWeights?: readonly number[] | undefined;
  dropReps?: readonly number[] | undefined;
  weightUnit: string;
}): string {
  return setSegments(set)
    .map((segment) => `${formatWeightValue(segment.weight)}${set.weightUnit} × ${segment.reps}`)
    .join(' → ');
}

/**
 * 「存下来的值」的指纹：只有它变了才需要把输入框同步回已保存的值。
 * 用它当 useEffect 的依赖（基本类型，天然稳定），就不会出现「打字过程中被外部更新改掉」
 * 或者「每次渲染都重挂输入框、把焦点弄丢」这两种毛病。
 */
export function storedSegmentsKey(set: {
  weight: number;
  reps: number;
  dropWeights?: readonly number[] | undefined;
  dropReps?: readonly number[] | undefined;
  weightUnit: string;
}): string {
  return [
    set.weight,
    set.reps,
    (set.dropWeights ?? []).join(','),
    (set.dropReps ?? []).join(','),
    set.weightUnit,
  ].join('|');
}
