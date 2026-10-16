/**
 * FitLog 图标系统 · 运动箭头组件（PHASE 1）
 *
 * 规则：
 *   - 颜色固定 #35C9B5，线宽 8，圆头圆角，实心三角箭头
 *   - 只表达方向（up / down / left / right / push / pull），不做装饰
 *   - 必须画在人体轮廓**外侧**，不压肢体
 *   - heads: 'to'（单向）| 'both'（上下/来回，例如深蹲、卧推的起落）
 */

export const TURQUOISE = '#35C9B5';
export const ARROW_W = 8;

const HEAD_LEN = 16;
const HEAD_SPREAD = 9;

function triangle(tip, angle) {
  const backX = tip[0] - Math.cos(angle) * HEAD_LEN;
  const backY = tip[1] - Math.sin(angle) * HEAD_LEN;
  const left = [backX - Math.sin(angle) * HEAD_SPREAD, backY + Math.cos(angle) * HEAD_SPREAD];
  const right = [backX + Math.sin(angle) * HEAD_SPREAD, backY - Math.cos(angle) * HEAD_SPREAD];

  return `<polygon data-part="arrow-head" points="${tip[0]},${tip[1]} ${left[0]},${left[1]} ${right[0]},${right[1]}" fill="${TURQUOISE}" />`;
}

function shaft(d, part = 'arrow') {
  return (
    `<path data-part="${part}" d="${d}" stroke="${TURQUOISE}" stroke-width="${ARROW_W}" ` +
    `stroke-linecap="round" stroke-linejoin="round" fill="none" />`
  );
}

/**
 * 箭头。
 *   from/to：端点；curve：二次贝塞尔的控制点（省略即直线，用于壶铃摆动那种弧线）
 *   heads：'to' | 'both'
 */
export function arrow({ from, to, curve, heads = 'to' }) {
  if (!from || !to) return '';
  const parts = [];

  if (curve) {
    // 曲线：箭头方向取「控制点 → 终点」的切线
    const shortFrom = [
      from[0] + (curve[0] - from[0]) * 0.08,
      from[1] + (curve[1] - from[1]) * 0.08,
    ];
    parts.push(
      shaft(`M ${shortFrom[0]},${shortFrom[1]} Q ${curve[0]},${curve[1]} ${to[0]},${to[1]}`),
    );
    parts.push(triangle(to, Math.atan2(to[1] - curve[1], to[0] - curve[0])));
    return parts.join('');
  }

  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const tail = [from[0] + Math.cos(angle) * 8, from[1] + Math.sin(angle) * 8];

  if (heads === 'both') {
    const start = [from[0] - Math.cos(angle) * 8, from[1] - Math.sin(angle) * 8];
    parts.push(shaft(`M ${start[0]},${start[1]} L ${to[0]},${to[1]}`));
    parts.push(triangle(from, angle + Math.PI));
  } else {
    parts.push(shaft(`M ${tail[0]},${tail[1]} L ${to[0]},${to[1]}`));
  }

  parts.push(triangle(to, angle));
  return parts.join('');
}
