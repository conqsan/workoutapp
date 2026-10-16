/**
 * MASTER HUMAN SILHOUETTE SYSTEM · 校验
 *
 *   node tools/validate.mjs
 *
 * 直接读生成的 SVG 来验证（不信任构建脚本的内存数据）：
 *   1. 六个姿势是不是「同一个人」—— 每段骨头的长度 / 粗细必须等于共享尺寸表
 *   2. 头是不是同一个（半径一致），人体层里只有头一个圆（没有关节圆点）
 *   3. 有没有多边形 / 填充块（禁止几何人偶、衬衫形躯干）
 *   4. 颜色是不是只有 #3F3F3F、背景透明、没有文字
 *   5. 留白是否足够，站姿高度是否一致
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CANVAS, HEAD_D, LENGTHS, WIDTHS } from './human-system.mjs';
import { POSES } from './poses.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

let failures = 0;
let checks = 0;

function check(name, ok, detail = '') {
  checks += 1;
  if (ok) console.log(`  \u2713 ${name}${detail ? `  ${detail}` : ''}`);
  else {
    failures += 1;
    console.error(`  \u2717 ${name}${detail ? `  ${detail}` : ''}`);
  }
}

const section = (title) => console.log(`\n${title}`);
const attr = (element, name) => Number(element.match(new RegExp(`${name}="(-?[\\d.]+)"`))?.[1]);
const elements = (svg, part) =>
  [...svg.matchAll(new RegExp(`<[^>]*data-part="${part}"[^>]*>`, 'g'))].map((match) => match[0]);

function lineLength(element) {
  const x1 = attr(element, 'x1');
  const y1 = attr(element, 'y1');
  const x2 = attr(element, 'x2');
  const y2 = attr(element, 'y2');
  return Math.hypot(x2 - x1, y2 - y1);
}

const PART_TO_LENGTH = {
  'upper-arm': LENGTHS.upperArm,
  forearm: LENGTHS.forearm,
  thigh: LENGTHS.thigh,
  'lower-leg': LENGTHS.lowerLeg,
  foot: LENGTHS.foot,
};
const PART_TO_WIDTH = {
  'upper-arm': WIDTHS.upperArm,
  forearm: WIDTHS.forearm,
  thigh: WIDTHS.thigh,
  'lower-leg': WIDTHS.lowerLeg,
  foot: WIDTHS.foot,
};

async function main() {
  const files = [];
  for (const pose of POSES) {
    const file = path.join(ROOT, 'master_poses', `${pose.id}.svg`);
    files.push({ pose, svg: await readFile(file, 'utf8') });
  }

  section('[1] 同一个人：所有骨头的长度都必须等于共享尺寸表');
  const lengthProblems = [];
  let segmentCount = 0;
  for (const { pose, svg } of files) {
    for (const [part, expected] of Object.entries(PART_TO_LENGTH)) {
      for (const element of elements(svg, part)) {
        segmentCount += 1;
        const length = lineLength(element);
        if (Math.abs(length - expected) > 1.5) {
          lengthProblems.push(`${pose.id}/${part} ${length.toFixed(1)}≠${expected.toFixed(1)}`);
        }
      }
    }
  }
  check(
    '每段骨头长度一致（±1.5px）',
    lengthProblems.length === 0,
    lengthProblems.length ? lengthProblems.join('；') : `共 ${segmentCount} 段`,
  );
  check(
    '躯干（颈→髋）长度一致',
    files.every(({ svg }) => {
      const chest = elements(svg, 'torso-chest')[0];
      const waist = elements(svg, 'torso-waist')[0];
      if (!chest || !waist) return false;
      return Math.abs(lineLength(chest) + lineLength(waist) - LENGTHS.torso) < 1.5;
    }),
    `${LENGTHS.torso.toFixed(1)}px`,
  );

  section('[2] 头与关节');
  const heads = files.map(({ svg }) => elements(svg, 'head'));
  check(
    '每个姿势恰好一个实心圆头',
    heads.every((list) => list.length === 1),
  );
  check(
    `头半径一致（d=${HEAD_D}px，约 7 头身里的小头）`,
    heads.every((list) => attr(list[0], 'r') === HEAD_D / 2),
  );
  check(
    '人体层里只有头一个圆（没有关节圆点 / 连接节点）',
    files.every(({ svg }) => (svg.match(/<circle/g) ?? []).length === 1),
  );

  section('[3] 构造：只有粗圆路径');
  check(
    '没有任何多边形 / 填充块（禁止几何人偶、衬衫形躯干）',
    files.every(({ svg }) => !/<polygon|<rect|<path|<ellipse/.test(svg)),
  );
  const widths = files.flatMap(({ svg }) =>
    [...svg.matchAll(/data-w="([\d.]+)"/g)].map((match) => Number(match[1])),
  );
  const allowed = new Set([WIDTHS.chest, WIDTHS.waist, ...Object.values(PART_TO_WIDTH)]);
  check(
    '所有粗细都来自共享尺寸表',
    widths.every((width) => [...allowed].some((value) => Math.abs(value - width) < 0.2)),
    `出现 ${[...new Set(widths)].sort((a, b) => a - b).join(' / ')}`,
  );
  check(
    '每段都是 round cap + round join',
    files.every(({ svg }) =>
      [...svg.matchAll(/<line[^>]*>/g)].every(
        (match) =>
          match[0].includes('stroke-linecap="round"') &&
          match[0].includes('stroke-linejoin="round"'),
      ),
    ),
  );
  check(
    '四肢近端比远端粗（上臂>小臂、大腿>小腿）',
    WIDTHS.upperArm > WIDTHS.forearm && WIDTHS.thigh > WIDTHS.lowerLeg,
    `上臂 ${WIDTHS.upperArm.toFixed(1)} / 小臂 ${WIDTHS.forearm.toFixed(1)}，大腿 ${WIDTHS.thigh.toFixed(1)} / 小腿 ${WIDTHS.lowerLeg.toFixed(1)}`,
  );
  check(
    '躯干比头略宽（是全身上下最粗的一段），但仍属「窄」',
    WIDTHS.chest > HEAD_D && WIDTHS.chest <= 28,
    `胸 ${WIDTHS.chest.toFixed(1)} vs 头 ${HEAD_D}`,
  );

  section('[4] 颜色 / 背景 / 文字');
  check(
    '只有 #3F3F3F 一种颜色',
    files.every(({ svg }) => {
      const colors = [
        ...new Set(
          [...svg.matchAll(/(?:stroke|fill)="(#[0-9A-Fa-f]{6}|none)"/g)].map((m) =>
            m[1].toLowerCase(),
          ),
        ),
      ];
      return colors.every((color) => color === '#3f3f3f' || color === 'none');
    }),
  );
  check(
    '背景透明（没有背景矩形）',
    files.every(({ svg }) => !/<rect/.test(svg)),
  );
  check(
    '没有文字 / 标签',
    files.every(({ svg }) => !/<text|<tspan|<title/.test(svg)),
  );
  check(
    '没有第二个颜色（不含青绿箭头等）',
    files.every(({ svg }) => !svg.includes('35C9B5')),
  );

  section('[5] 留白与站姿高度');
  const margins = POSES.map((pose) => {
    const { minX, minY, maxX, maxY } = boundsOf(pose);
    return {
      id: pose.id,
      left: Math.round(minX),
      right: Math.round(CANVAS - maxX),
      top: Math.round(minY),
      bottom: Math.round(CANVAS - maxY),
    };
  });
  const tight = margins.filter((m) => Math.min(m.left, m.right, m.top, m.bottom) < 12);
  check(
    '四周留白 ≥ 12px',
    tight.length === 0,
    tight.map((m) => `${m.id}(${m.left}/${m.right}/${m.top}/${m.bottom})`).join(' ') ||
      `最小 ${Math.min(...margins.flatMap((m) => [m.left, m.right, m.top, m.bottom]))}px`,
  );

  const standing = ['front_standing', 'side_standing', 'three_quarter_standing'].map((id) => {
    const pose = POSES.find((item) => item.id === id);
    const box = boundsOf(pose);
    return { id, height: Math.round(box.maxY - box.minY) };
  });
  const heights = standing.map((item) => item.height);
  check(
    '三个站姿高度一致（±3px）',
    Math.max(...heights) - Math.min(...heights) <= 3,
    standing.map((item) => `${item.id} ${item.height}`).join('  '),
  );

  console.log('');
  if (failures > 0) {
    console.error(
      `主人体系统校验失败：${checks - failures}/${checks} 项通过，${failures} 项未通过。\n`,
    );
    process.exitCode = 1;
  } else {
    console.log(`主人体系统校验全部通过（${checks}/${checks}）。\n`);
  }
}

/** 用人体模块的包围盒（这里重新 import 以避免循环依赖的错觉） */
function boundsOf(pose) {
  const points = [];
  const add = (point, radius) =>
    points.push([point[0] - radius, point[0] + radius, point[1] - radius, point[1] + radius]);
  add(pose.head, HEAD_D / 2);
  add(pose.neck, WIDTHS.chest / 2);
  add(pose.hip, WIDTHS.waist / 2);
  for (const arm of pose.arms.filter(Boolean)) {
    add(arm.points[1], WIDTHS.upperArm / 2);
    add(arm.points[2], WIDTHS.forearm / 2);
  }
  for (const leg of pose.legs.filter(Boolean)) {
    add(leg.points[1], WIDTHS.thigh / 2);
    add(leg.points[2], WIDTHS.lowerLeg / 2);
    add(leg.points[3], WIDTHS.foot / 2);
  }
  return {
    minX: Math.min(...points.map((p) => p[0])),
    maxX: Math.max(...points.map((p) => p[1])),
    minY: Math.min(...points.map((p) => p[2])),
    maxY: Math.max(...points.map((p) => p[3])),
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
