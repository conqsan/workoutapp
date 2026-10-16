/**
 * FitLog 图标系统 · 人体组件（STYLE ROUND 2：粗圆路径构造）
 *
 * 两版试下来的结论：
 *   - **不要**实心几何大躯干（梯形 / 三角 / 衬衫形块面）—— 僵硬、机械、不像参考图
 *   - 躯干 = 一条略收窄的**粗圆路径**（胸 → 腰两段），窄、简单、和四肢连成一体
 *   - 四肢 = **粗圆路径**；只在粗细上做一点点区分（上臂略粗于小臂、大腿略粗于小腿），
 *     不做多边形、不做锥形块
 *   - 关节不画圆点：圆头路径自然重叠即可，轮廓连续
 *   - 手 / 脚 = 路径自己的圆头（不额外画圆点）
 *   - 头沿用第二版的小圆（直径 22px），比躯干窄
 *
 * 视觉层级：人体剪影 > 运动箭头 > 器械。
 * 组件：Head / Torso（胸 + 腰两段）/ UpperArm / Forearm / Thigh / LowerLeg / Foot。
 */

export const INK = '#3F3F3F';

/** 全库统一尺寸表。调粗细只改这里，不要按动作单独调。 */
export const WIDTHS = {
  head: 20, // 直径（r = 10）—— 规格 18–23px，比第一版的 30 小 1/3
  chest: 17, // 躯干上段
  waist: 14.5, // 躯干下段（腰 → 髋），略微收窄
  'upper-arm': 13,
  forearm: 11.5,
  thigh: 14.5,
  'lower-leg': 12,
  foot: 10.5,
};

export const HEAD_R = WIDTHS.head / 2;
/** 手臂从躯干轴两侧偏移多少出发 —— 很小，靠圆头重叠形成肩，避免「三角肩」 */
export const SHOULDER_OFFSET = 5.5;
const TAPER_POINT = 0.45;

function stroke(a, b, width, part) {
  return (
    `<line data-part="${part}" data-w="${width}" x1="${a[0]}" y1="${a[1]}" ` +
    `x2="${b[0]}" y2="${b[1]}" stroke="${INK}" stroke-width="${width}" ` +
    `stroke-linecap="round" stroke-linejoin="round" />`
  );
}

/** 躯干：两段略收窄的粗圆路径（胸 → 腰），不是填充多边形 */
export function torso(neck, hip) {
  if (!neck || !hip) return '';
  const mid = [
    neck[0] + (hip[0] - neck[0]) * TAPER_POINT,
    neck[1] + (hip[1] - neck[1]) * TAPER_POINT,
  ];
  return (
    stroke(neck, mid, WIDTHS.chest, 'torso-chest') + stroke(mid, hip, WIDTHS.waist, 'torso-waist')
  );
}

/**
 * 躯干局部坐标（+y 由颈指向髋）到画布的旋转角。
 * 局部 +y 经 rotate(θ) 落到 (-sinθ, cosθ)，令其等于颈→髋单位向量即可。
 * （写成 atan2(dy,dx)+90 会把躯干整体转 180°，肩髋颠倒 —— 这个坑踩过一次。）
 */
export function torsoAngle(neck, hip) {
  return (Math.atan2(-(hip[0] - neck[0]), hip[1] - neck[1]) * 180) / Math.PI;
}

/** 肩关节：从脖子沿躯干轴往下一点点，再向两侧偏 SHOULDER_OFFSET */
export function shoulderPoint(neck, hip, _view, side) {
  const dx = hip[0] - neck[0];
  const dy = hip[1] - neck[1];
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return [
    neck[0] - uy * SHOULDER_OFFSET * side + ux * 5,
    neck[1] + ux * SHOULDER_OFFSET * side + uy * 5,
  ];
}

export function head(center) {
  if (!center) return '';
  return `<circle data-part="head" cx="${center[0]}" cy="${center[1]}" r="${HEAD_R}" fill="${INK}" />`;
}

/**
 * 把关节坐标渲染成人体。
 *
 * pose.points 需要的键：head, neck, hip, elbowL/R, wristL/R, kneeL/R, ankleL/R, toeL/R。
 * 手臂从「肩点」出发（不是脖子中心），和躯干圆头自然重叠；缺失的关节自动跳过。
 */
export function figure(pose, _view = 'side') {
  const p = pose.points ?? {};
  const hidden = new Set(pose.hide ?? []);
  const visible = (name) => !hidden.has(name) && p[name] !== undefined;
  const parts = [torso(p.neck, p.hip)];

  for (const key of ['L', 'R']) {
    const elbow = `elbow${key}`;
    const wrist = `wrist${key}`;
    const knee = `knee${key}`;
    const ankle = `ankle${key}`;
    const toe = `toe${key}`;
    const shoulder = shoulderPoint(p.neck, p.hip, _view, key === 'L' ? -1 : 1);

    if (visible(elbow)) parts.push(stroke(shoulder, p[elbow], WIDTHS['upper-arm'], 'upper-arm'));
    if (visible(elbow) && visible(wrist)) {
      parts.push(stroke(p[elbow], p[wrist], WIDTHS.forearm, 'forearm'));
    }
    if (visible(knee)) parts.push(stroke(p.hip, p[knee], WIDTHS.thigh, 'thigh'));
    if (visible(knee) && visible(ankle)) {
      parts.push(stroke(p[knee], p[ankle], WIDTHS['lower-leg'], 'lower-leg'));
    }
    if (visible(ankle) && visible(toe)) parts.push(stroke(p[ankle], p[toe], WIDTHS.foot, 'foot'));
  }

  parts.push(head(p.head));
  return parts.filter((part) => part !== '').join('');
}

/** 人体（含头）的包围盒，用来做留白与小尺寸可读性检查 */
export function figureBounds(pose, _view = 'side') {
  const p = pose.points ?? {};
  const hidden = new Set(pose.hide ?? []);
  const xs = [];
  const ys = [];

  const radii = {
    head: HEAD_R,
    neck: WIDTHS.chest / 2,
    hip: WIDTHS.waist / 2,
    elbowL: WIDTHS['upper-arm'] / 2,
    elbowR: WIDTHS['upper-arm'] / 2,
    wristL: WIDTHS.forearm / 2,
    wristR: WIDTHS.forearm / 2,
    kneeL: WIDTHS.thigh / 2,
    kneeR: WIDTHS.thigh / 2,
    ankleL: WIDTHS['lower-leg'] / 2,
    ankleR: WIDTHS['lower-leg'] / 2,
    toeL: WIDTHS.foot / 2,
    toeR: WIDTHS.foot / 2,
  };

  const add = (point, radius) => {
    if (!point) return;
    xs.push(point[0] - radius, point[0] + radius);
    ys.push(point[1] - radius, point[1] + radius);
  };

  for (const [name, point] of Object.entries(p)) {
    if (hidden.has(name)) continue;
    add(point, radii[name] ?? 6);
  }

  if (xs.length === 0) return null;
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}
