/**
 * 六个 MASTER 姿势（同一个人，只换关节位置）。
 *
 * 全部关节都由 human-system 的**共享长度 + 角度**推出来，所以「同一个人」是构造上保证的，
 * 不是靠肉眼对齐。角度约定：0° = 向右，90° = 向下。
 */

import { at, chain, HEAD_OFFSET, LENGTHS } from './human-system.mjs';

const { torso, upperArm, forearm, thigh, lowerLeg, foot } = LENGTHS;

/** 肩点：从颈点沿躯干轴向下 SHOULDER.along，再沿垂直方向偏 SHOULDER.side */
function shoulder(neck, torsoAngle, side, along = 6, offset = 7) {
  const base = at(neck, torsoAngle, along);
  return at(base, torsoAngle - 90, offset * side);
}

/** 头：从颈点沿躯干轴反方向退 HEAD_OFFSET */
function headOf(neck, torsoAngle, tilt = 0) {
  return at(neck, torsoAngle + 180 + tilt, HEAD_OFFSET);
}

// ------------------------------------------------------------------ 01 正面站姿
function frontStanding() {
  const neck = [128, 76];
  const torsoAngle = 90;
  const hip = at(neck, torsoAngle, torso);

  return {
    id: 'front_standing',
    label: 'MASTER_01 · FRONT STANDING',
    view: 'front',
    head: headOf(neck, torsoAngle),
    neck,
    hip,
    arms: [
      // 手臂略微外展（104°/76°），和躯干之间留出可见的负空间 —— 参考图的站姿就是这样
      {
        points: chain(shoulder(neck, torsoAngle, -1), [
          [104, upperArm],
          [98, forearm],
        ]),
      },
      {
        points: chain(shoulder(neck, torsoAngle, 1), [
          [76, upperArm],
          [82, forearm],
        ]),
      },
    ],
    legs: [
      // 正面站姿：两脚略微外八（左脚朝左、右脚朝右），和侧视的脚尖高度对齐
      {
        points: chain(hip, [
          [80, thigh],
          [85, lowerLeg],
          [160, foot],
        ]),
      },
      {
        points: chain(hip, [
          [100, thigh],
          [95, lowerLeg],
          [20, foot],
        ]),
      },
    ],
  };
}

// ------------------------------------------------------------------ 02 侧面站姿
function sideStanding() {
  const neck = [128, 76];
  const torsoAngle = 90;
  const hip = at(neck, torsoAngle, torso);
  // 侧视只画靠镜头的一侧：手臂挂在躯干前方一点，和躯干轮廓贴住但不重叠成一坨
  const shoulderNear = [148, 82];

  return {
    id: 'side_standing',
    label: 'MASTER_02 · SIDE STANDING',
    view: 'side',
    head: headOf(neck, torsoAngle),
    neck,
    hip,
    arms: [
      {
        points: chain(shoulderNear, [
          [92, upperArm],
          [88, forearm],
        ]),
      },
    ],
    legs: [
      {
        points: chain(hip, [
          [88, thigh],
          [90, lowerLeg],
          [20, foot],
        ]),
      },
    ],
  };
}

// ------------------------------------------------------------------ 03 四分之三站姿
function threeQuarterStanding() {
  const neck = [128, 76];
  const torsoAngle = 94;
  const hip = at(neck, torsoAngle, torso);

  return {
    id: 'three_quarter_standing',
    label: 'MASTER_03 · THREE QUARTER STANDING',
    view: 'three-quarter',
    head: headOf(neck, torsoAngle, -8),
    neck,
    hip,
    arms: [
      {
        points: chain(shoulder(neck, torsoAngle, -1, 6, 13), [
          [102, upperArm],
          [96, forearm],
        ]),
      },
      {
        points: chain(shoulder(neck, torsoAngle, 1, 6, 13), [
          [78, upperArm],
          [84, forearm],
        ]),
      },
    ],
    legs: [
      {
        points: chain(hip, [
          [90, thigh],
          [85, lowerLeg],
          [160, foot],
        ]),
      },
      {
        points: chain(at(hip, 90, 0), [
          [82, thigh],
          [95, lowerLeg],
          [20, foot],
        ]),
      },
    ],
  };
}

// ------------------------------------------------------------------ 04 深蹲
function squat() {
  const neck = [100, 84];
  const torsoAngle = 62;
  const hip = at(neck, torsoAngle, torso);

  return {
    id: 'squat',
    label: 'MASTER_04 · SQUAT',
    view: 'side',
    head: headOf(neck, torsoAngle),
    neck,
    hip,
    arms: [
      {
        points: chain(shoulder(neck, torsoAngle, -1), [
          [100, upperArm],
          [74, forearm],
        ]),
      },
    ],
    legs: [
      {
        points: chain(hip, [
          [48, thigh],
          [96, lowerLeg],
          [8, foot],
        ]),
      },
    ],
  };
}

// ------------------------------------------------------------------ 05 俯卧撑
function pushup() {
  const neck = [84, 132];
  const torsoAngle = 30;
  const hip = at(neck, torsoAngle, torso);

  return {
    id: 'pushup',
    label: 'MASTER_05 · PUSH-UP',
    view: 'side',
    head: headOf(neck, torsoAngle),
    neck,
    hip,
    arms: [
      {
        points: chain(shoulder(neck, torsoAngle, -1), [
          [88, upperArm],
          [92, forearm],
        ]),
      },
    ],
    legs: [
      {
        points: chain(hip, [
          [30, thigh],
          [30, lowerLeg],
          [58, foot],
        ]),
      },
    ],
  };
}

// ------------------------------------------------------------------ 06 仰卧
function supine() {
  const neck = [92, 192];
  const torsoAngle = 2;
  const hip = at(neck, torsoAngle, torso);

  return {
    id: 'supine',
    label: 'MASTER_06 · SUPINE',
    view: 'side',
    head: headOf(neck, torsoAngle),
    neck,
    hip,
    arms: [
      {
        points: chain(shoulder(neck, torsoAngle, 1, 6, 7), [
          [6, upperArm],
          [4, forearm],
        ]),
      },
    ],
    legs: [
      {
        points: chain(hip, [
          [-40, thigh],
          [80, lowerLeg],
          [6, foot],
        ]),
      },
    ],
  };
}

export const POSES = [
  frontStanding(),
  sideStanding(),
  threeQuarterStanding(),
  squat(),
  pushup(),
  supine(),
];
