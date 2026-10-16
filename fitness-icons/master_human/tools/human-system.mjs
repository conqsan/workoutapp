/**
 * FITLOG · MASTER HUMAN SILHOUETTE SYSTEM
 *
 * 唯一权威参考是**最初上传的那张健身图标参考图**。下面的比例是从那张图里量出来的，
 * 不是自己发明的：
 *
 *   约 7 头身（以头径 d 为单位）
 *     head       1.00 d
 *     torso      2.20 d   （颈 → 髋）
 *     upper arm  1.60 d
 *     forearm    1.50 d
 *     thigh      2.00 d
 *     lower leg  1.90 d
 *     foot       0.90 d
 *
 *   粗细（同样以 d 为单位）
 *     torso      1.13 d（胸）→ 0.96 d（腰）—— 比头略宽，是全身上下最粗的一段
 *     upper arm  0.61 d
 *     forearm    0.52 d
 *     thigh      0.67 d
 *     lower leg  0.57 d
 *     foot       0.50 d
 *
 * 构造语言（和参考图一致）：
 *   - 头：实心小圆，无五官 / 无头发 / 无描边
 *   - 躯干：**两段略收窄的粗圆路径**（胸 → 腰），不是填充多边形、不是衬衫 / 护甲
 *   - 四肢：**粗圆路径**（round cap + round join），近端略粗、远端略细
 *   - 关节：不画圆点，靠圆头路径自然重叠 —— 轮廓连续、没有几何连接节点
 *   - 手 / 脚：路径自己的圆头
 *   - 只有一个颜色 #3F3F3F，背景透明
 */

export const INK = '#3F3F3F';
export const CANVAS = 256;

/** 头径：落在 18–23px 区间内，同时保证 7 头身的整体高度 ≈ 167px */
export const HEAD_D = 23;
export const HEAD_R = HEAD_D / 2;

export const LENGTHS = {
  torso: 2.2 * HEAD_D, // 50.6
  upperArm: 1.6 * HEAD_D, // 36.8
  forearm: 1.5 * HEAD_D, // 34.5
  thigh: 2.0 * HEAD_D, // 46
  lowerLeg: 1.9 * HEAD_D, // 43.7
  foot: 0.9 * HEAD_D, // 20.7
};

export const WIDTHS = {
  chest: 1.13 * HEAD_D, // 26
  waist: 0.96 * HEAD_D, // 22
  upperArm: 0.61 * HEAD_D, // 14
  forearm: 0.52 * HEAD_D, // 12
  thigh: 0.67 * HEAD_D, // 15.4
  lowerLeg: 0.57 * HEAD_D, // 13.1
  foot: 0.5 * HEAD_D, // 11.5
};

/**
 * 头心到颈点的距离（沿躯干轴向上）：头的下沿压进肩部圆头里一点 ——
 * 参考图的站姿几乎没有脖子，头是「坐在肩膀上」的。
 */
export const HEAD_OFFSET = 23;
/**
 * 肩点：从颈点沿躯干轴向下、再向两侧偏。
 * side 取 15：手臂的中心落在躯干轮廓边缘外，正面 / 四分之三看得到两条手臂
 * （参考图里的站姿，肩到肩的宽度大约是 2 个头径）。
 */
export const SHOULDER = { along: 6, side: 15 };
const TAPER_AT = 0.45;

export const rad = (deg) => (deg * Math.PI) / 180;

/** 从一个点按「角度 + 长度」推下一个点（角度：0 = 右，90 = 下） */
export function at(point, angle, length) {
  return [point[0] + Math.cos(rad(angle)) * length, point[1] + Math.sin(rad(angle)) * length];
}

/** 按 [角度, 长度] 序列推开一串关节 */
export function chain(point, steps) {
  const points = [point];
  let current = point;
  for (const [angle, length] of steps) {
    current = at(current, angle, length);
    points.push(current);
  }
  return points;
}

export const round = (value) => Math.round(value * 10) / 10;

function stroke(a, b, width, part) {
  return (
    `<line data-part="${part}" data-w="${round(width)}" x1="${round(a[0])}" y1="${round(a[1])}" ` +
    `x2="${round(b[0])}" y2="${round(b[1])}" stroke="${INK}" stroke-width="${round(width)}" ` +
    `stroke-linecap="round" stroke-linejoin="round" />`
  );
}

/** 躯干：胸段 + 腰段，两段圆头自然叠成一条略收窄的躯干 */
export function torso(neck, hip) {
  const mid = [neck[0] + (hip[0] - neck[0]) * TAPER_AT, neck[1] + (hip[1] - neck[1]) * TAPER_AT];
  return (
    stroke(neck, mid, WIDTHS.chest, 'torso-chest') + stroke(mid, hip, WIDTHS.waist, 'torso-waist')
  );
}

function head(center) {
  return `<circle data-part="head" cx="${round(center[0])}" cy="${round(center[1])}" r="${round(HEAD_R)}" fill="${INK}" />`;
}

/**
 * 渲染一个人体。
 *
 * pose = {
 *   head, neck, hip,
 *   arms: [ { shoulder, points: [shoulder, elbow, wrist] } | null, ... ],   // near / far
 *   legs: [ { points: [hip, knee, ankle, toe] } | null, ... ],
 * }
 */
export function figure(pose) {
  const parts = [torso(pose.neck, pose.hip)];

  for (const arm of pose.arms.filter(Boolean)) {
    const [shoulder, elbow, wrist] = arm.points;
    parts.push(stroke(shoulder, elbow, WIDTHS.upperArm, 'upper-arm'));
    parts.push(stroke(elbow, wrist, WIDTHS.forearm, 'forearm'));
  }

  for (const leg of pose.legs.filter(Boolean)) {
    const [hip, knee, ankle, toe] = leg.points;
    parts.push(stroke(hip, knee, WIDTHS.thigh, 'thigh'));
    parts.push(stroke(knee, ankle, WIDTHS.lowerLeg, 'lower-leg'));
    parts.push(stroke(ankle, toe, WIDTHS.foot, 'foot'));
  }

  parts.push(head(pose.head));
  return parts.join('');
}

/** 一个姿势的包围盒（含圆头半径），用于留白与尺寸检查 */
export function bounds(pose) {
  const points = [
    [pose.head, HEAD_R],
    [pose.neck, WIDTHS.chest / 2],
    [pose.hip, WIDTHS.waist / 2],
  ];
  for (const arm of pose.arms.filter(Boolean)) {
    points.push([arm.points[1], WIDTHS.upperArm / 2], [arm.points[2], WIDTHS.forearm / 2]);
  }
  for (const leg of pose.legs.filter(Boolean)) {
    points.push(
      [leg.points[1], WIDTHS.thigh / 2],
      [leg.points[2], WIDTHS.lowerLeg / 2],
      [leg.points[3], WIDTHS.foot / 2],
    );
  }

  const xs = points.flatMap(([point, radius]) => [point[0] - radius, point[0] + radius]);
  const ys = points.flatMap(([point, radius]) => [point[1] - radius, point[1] + radius]);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}
