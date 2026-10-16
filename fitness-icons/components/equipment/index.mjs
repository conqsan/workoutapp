/**
 * FitLog 图标系统 · 器械组件（PHASE 1）
 *
 * 规则：
 *   - 主色 DARK_GRAY #3F3F3F；只允许「场景线」（地面 / 钢索）用 CONTEXT 浅灰
 *   - 几何、简化、圆角；不画真实机械结构（螺丝、配重销、扶手细节一律不画）
 *   - 器械永远画在人体**下一层**（build 时先输出器械，再输出人体）
 */

export const INK = '#3F3F3F';
/** 场景线专用（地面线 / 钢索）。参考图里的地面线也是浅灰，不是纯深灰。 */
export const CONTEXT = '#BDBDBD';

/** STYLE ROUND 1：器械整体减重 15–25%，不能压过人形 */
export const BAR_W = 6;
export const PLATE_R = 13;
export const DUMBBELL_LEN = 26;
export const FLOOR_W = 5;

export function floorLine(y, { x1 = 32, x2 = 224 } = {}) {
  return (
    `<line data-part="floor" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" ` +
    `stroke="${CONTEXT}" stroke-width="${FLOOR_W}" stroke-linecap="round" stroke-linejoin="round" />`
  );
}

/** 一根横杆（杠铃杆 / 器械支架 / 踏板都用它） */
export function bar(from, to, { width = BAR_W, part = 'bar' } = {}) {
  return (
    `<line data-part="${part}" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}" ` +
    `stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />`
  );
}

/** 配重片：实心圆；hole = true 时用 evenodd 挖一个透明孔 */
export function weightPlate(cx, cy, { r = PLATE_R, hole = false } = {}) {
  if (!hole) {
    return `<circle data-part="weight-plate" cx="${cx}" cy="${cy}" r="${r}" fill="${INK}" />`;
  }

  const inner = Math.max(3, r - 9);
  const d =
    `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0 Z ` +
    `M ${cx - inner},${cy} a ${inner},${inner} 0 1,0 ${inner * 2},0 a ${inner},${inner} 0 1,0 ${-inner * 2},0 Z`;

  return `<path data-part="weight-plate" d="${d}" fill="${INK}" fill-rule="evenodd" />`;
}

export function barbell(from, to, { plates = true, plateR = PLATE_R } = {}) {
  const parts = [bar(from, to)];
  if (plates) {
    parts.push(weightPlate(from[0] - 2, from[1], { r: plateR }));
    parts.push(weightPlate(to[0] + 2, to[1], { r: plateR }));
  }
  return parts.join('');
}

/** 哑铃：以 (cx,cy) 为中心、可旋转（0 = 水平，90 = 垂直） */
export function dumbbell(cx, cy, { angle = 0, len = DUMBBELL_LEN } = {}) {
  const half = len / 2;
  const inner =
    bar([cx - half, cy], [cx + half, cy], { width: 8, part: 'dumbbell-bar' }) +
    `<rect data-part="dumbbell-plate" x="${cx - half - 7}" y="${cy - 11}" width="9" height="22" rx="4" fill="${INK}" />` +
    `<rect data-part="dumbbell-plate" x="${cx + half - 2}" y="${cy - 11}" width="9" height="22" rx="4" fill="${INK}" />`;

  return angle === 0 ? inner : `<g transform="rotate(${angle} ${cx} ${cy})">${inner}</g>`;
}

/** 卧推凳 / 座椅 / 靠背：一块圆角横板，可以带两条腿落到地面 */
export function bench(x, y, w, h, { legs = null, part = 'bench' } = {}) {
  const top = `<rect data-part="${part}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(7, h / 2)}" fill="${INK}" />`;
  if (!legs) return top;

  const legW = 9;
  const left = x + 10;
  const right = x + w - 10 - legW;
  return (
    top +
    `<rect data-part="bench-leg" x="${left}" y="${y + h}" width="${legW}" height="${legs - (y + h)}" rx="4" fill="${INK}" />` +
    `<rect data-part="bench-leg" x="${right}" y="${y + h}" width="${legW}" height="${legs - (y + h)}" rx="4" fill="${INK}" />`
  );
}

/** 壶铃：实心球 + 上方手柄 */
export function kettlebell(cx, cy, { r = 15 } = {}) {
  const handleR = r * 0.72;
  return (
    `<path data-part="kettlebell-handle" d="M ${cx - handleR},${cy - r * 0.6} ` +
    `A ${handleR},${handleR} 0 0 1 ${cx + handleR},${cy - r * 0.6}" ` +
    `stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" />` +
    `<circle data-part="kettlebell-body" cx="${cx}" cy="${cy}" r="${r}" fill="${INK}" />`
  );
}

/** 单杠：一根粗横杆 + 两端短竖杆（未来引体向上会用） */
export function pullUpBar(from, to, { stub = 14 } = {}) {
  return (
    bar(from, to, { width: 9, part: 'pull-up-bar' }) +
    bar([from[0] + 4, from[1]], [from[0] + 4, from[1] - stub], { width: 8, part: 'bar-post' }) +
    bar([to[0] - 4, to[1]], [to[0] - 4, to[1] - stub], { width: 8, part: 'bar-post' })
  );
}

/** 简化绳索机：配重柱 + 滑轮 + 钢索 */
export function cableMachine({ x, y, w = 20, h = 170, pulleyY = null, cableTo = null }) {
  const pulley = pulleyY ?? y + 14;
  const parts = [
    `<rect data-part="cable-stack" x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${INK}" />`,
    `<circle data-part="cable-pulley" cx="${x + w / 2}" cy="${pulley}" r="7" fill="${INK}" />`,
  ];

  if (cableTo) {
    parts.push(
      `<line data-part="cable" x1="${x + w / 2}" y1="${pulley}" x2="${cableTo[0]}" y2="${cableTo[1]}" ` +
        `stroke="${CONTEXT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`,
    );
  }

  return parts.join('');
}
