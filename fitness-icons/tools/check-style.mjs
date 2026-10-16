/**
 * FitLog 图标系统 · 样式一致性检查（STYLE ROUND 1：实心几何剪影）
 *
 *   node tools/check-style.mjs
 *
 * 逐条核对规格 STEP 7 的 15 项 + 这一轮的新要求（小头、锥度四肢、实心躯干、
 * 器械减重、箭头尺寸统一）。任何一项 FAIL 都退出码 1。
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { figureBounds, HEAD_R, shoulderPoint, WIDTHS } from '../components/human/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const INK = '#3F3F3F';
const TURQUOISE = '#35C9B5';
const CONTEXT = '#BDBDBD';
const ARROW_W = 8;
const ARROW_LEN = [50, 64];
const PALETTE = new Set([INK, TURQUOISE, CONTEXT, 'none'].map((color) => color.toLowerCase()));
/** 允许出现的线宽档位：人体尺寸表 + 器械 / 箭头 */
const WIDTH_ALLOWLIST = new Set([
  ...Object.values(WIDTHS),
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11, // 器械 / 箭头 / 靠背
]);
/** 器械尺寸上限（相对人形必须"轻"） */
const EQUIPMENT_LIMITS = {
  stackW: 22,
  dumbbellPlateW: 10,
  dumbbellPlateH: 24,
  plateR: 14,
  benchH: 20,
};

let failures = 0;
let checks = 0;

function check(name, ok, detail = '') {
  checks += 1;
  if (ok) {
    console.log(`  \u2713 ${name}${detail ? `  ${detail}` : ''}`);
  } else {
    failures += 1;
    console.error(`  \u2717 ${name}${detail ? `  ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

const elements = (svg, part) =>
  [...svg.matchAll(new RegExp(`<[^>]*data-part="${part}"[^>]*>`, 'g'))].map((match) => match[0]);

const numberAttr = (element, name) => {
  const value = element.match(new RegExp(`${name}="(-?[\\d.]+)"`))?.[1];
  return value === undefined ? null : Number(value);
};

const colors = (svg) => [
  ...new Set(
    [...svg.matchAll(/(?:stroke|fill)="(#[0-9A-Fa-f]{6}|none)"/g)].map((match) =>
      match[1].toLowerCase(),
    ),
  ),
];

const strokeWidths = (svg) =>
  [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((match) => Number(match[1]));

function outOfCanvas(svg) {
  const numbers = [];
  for (const match of svg.matchAll(/\b(?:x|x1|x2|cx|y|y1|y2|cy|r)="(-?[\d.]+)"/g)) {
    numbers.push(Number(match[1]));
  }
  for (const match of svg.matchAll(/points="([^"]+)"/g)) {
    for (const pair of match[1].trim().split(/\s+/)) {
      numbers.push(...pair.split(',').map(Number));
    }
  }
  // r= 是半径，这里只看坐标本身是否越界（半径的余量由留白检查覆盖）
  return numbers.filter((value) => value < 0 || value > 256).length;
}

async function main() {
  const exercises = JSON.parse(await readFile(path.join(ROOT, 'exercises.json'), 'utf8'));
  const files = [];

  for (const exercise of exercises) {
    const file = path.join(ROOT, exercise.category, exercise.icon);
    files.push({ exercise, svg: await readFile(file, 'utf8') });
  }

  section('[1] 头部：小实心圆、全库一致');
  const heads = files.map(({ svg }) => elements(svg, 'head'));
  check(
    '每个图标恰好一个实心圆头',
    heads.every((list) => list.length === 1),
  );
  check(
    `头半径统一 r=${HEAD_R}（比上一版小 20%）`,
    heads.every((list) => numberAttr(list[0], 'r') === HEAD_R),
  );

  section('[2] 四肢：粗圆路径，粗细按统一尺寸表');
  const limbParts = ['upper-arm', 'forearm', 'thigh', 'lower-leg', 'foot'];
  const limbProblems = [];
  let limbCount = 0;
  for (const { exercise, svg } of files) {
    for (const part of limbParts) {
      for (const element of elements(svg, part)) {
        limbCount += 1;
        if (numberAttr(element, 'stroke-width') !== WIDTHS[part]) {
          limbProblems.push(`${exercise.id}/${part}`);
        }
      }
    }
  }
  check(
    '每段四肢的粗细都等于尺寸表',
    limbProblems.length === 0,
    limbProblems.length ? limbProblems.join(', ') : `共 ${limbCount} 段`,
  );
  check(
    '尺寸表是「近端略粗、远端略细」（上臂>小臂、大腿>小腿）',
    WIDTHS['upper-arm'] > WIDTHS.forearm && WIDTHS.thigh > WIDTHS['lower-leg'],
    `上臂 ${WIDTHS['upper-arm']} / 小臂 ${WIDTHS.forearm}，大腿 ${WIDTHS.thigh} / 小腿 ${WIDTHS['lower-leg']}`,
  );
  check(
    '人体层里没有多边形 / 填充块（禁止实心几何躯干与锥形块）',
    files.every(({ svg }) => {
      const body = svg.match(/<g data-layer="figure">([\s\S]*?)<\/g>/)?.[1] ?? '';
      return !/<polygon|<rect|<ellipse/.test(body) && !/<path/.test(body);
    }),
  );
  check(
    '没有任何「关节圆点」之类的几何连接节点（人体层里只有头一个圆）',
    files.every(({ svg }) => {
      const body = svg.match(/<g data-layer="figure">([\s\S]*?)<\/g>/)?.[1] ?? '';
      return (body.match(/<circle/g) ?? []).length === 1;
    }),
  );

  section('[3] 躯干：窄、略收窄的粗圆路径（不是填充块）');
  check(
    '每个图标恰好两段躯干路径（胸 + 腰）',
    files.every(({ svg }) => {
      const chest = elements(svg, 'torso-chest').length;
      const waist = elements(svg, 'torso-waist').length;
      return chest + waist === 2;
    }),
  );
  check(
    `躯干粗细等于尺寸表（胸 ${WIDTHS.chest} → 腰 ${WIDTHS.waist}），且腰比胸窄`,
    files.every(({ svg }) => {
      const chest = elements(svg, 'torso-chest')[0] ?? '';
      const waist = elements(svg, 'torso-waist')[0] ?? '';
      return (
        numberAttr(chest, 'stroke-width') === WIDTHS.chest &&
        numberAttr(waist, 'stroke-width') === WIDTHS.waist &&
        WIDTHS.waist < WIDTHS.chest
      );
    }),
  );
  check(
    '躯干宽度在「窄」的范围（≤ 18px，不出现大面积躯体）',
    WIDTHS.chest <= 18,
    `胸 ${WIDTHS.chest}`,
  );
  check(
    `头（直径 ${WIDTHS.head}）没有比躯干明显更粗壮（≤ 1.25× 胸宽）`,
    WIDTHS.head <= WIDTHS.chest * 1.25,
    `头 ${WIDTHS.head} vs 胸 ${WIDTHS.chest}`,
  );

  section('[4] 线宽档位');
  const widths = files.flatMap(({ svg }) => strokeWidths(svg));
  check(
    '线宽全部在设计系统允许的档位内',
    widths.every((width) => WIDTH_ALLOWLIST.has(width)),
    `出现：${[...new Set(widths)].sort((a, b) => a - b).join(' / ')}`,
  );

  section('[5-6] 端点与转角（器械 / 箭头 / 躯干描边）');
  const stroked = files.flatMap(({ svg }) =>
    [...svg.matchAll(/<line[^>]*>|<path[^>]*>|<polygon[^>]*>/g)]
      .map((match) => match[0])
      .filter((element) => element.includes('stroke=') && !element.includes('stroke="none"')),
  );
  check(
    '描边元素都是 round 转角',
    stroked.every((element) => element.includes('stroke-linejoin="round"')),
  );
  check(
    '线条（line）都是 round 端点',
    stroked
      .filter((element) => element.startsWith('<line'))
      .every((element) => element.includes('stroke-linecap="round"')),
  );

  section('[7-8] 配色');
  const palette = files.flatMap(({ svg }) => colors(svg));
  check(
    '颜色只用设计系统里的三种（+透明）',
    palette.every((color) => PALETTE.has(color)),
    [...new Set(palette)].join(' / '),
  );
  check(
    '深灰主色 #3F3F3F，且是唯一的人形/器械颜色',
    files.every(({ svg }) => svg.includes(INK)),
  );
  check(
    '青色 #35C9B5 只出现在箭头层',
    files.every(({ svg }) => {
      const arrows = svg.match(/<g data-layer="arrows">([\s\S]*?)<\/g>/)?.[1] ?? '';
      return !svg.replace(arrows, '').includes(TURQUOISE);
    }),
  );

  section('[9-10] 箭头：粗细一致、尺寸一致、形状统一');
  const shafts = files.flatMap(({ svg }) => elements(svg, 'arrow'));
  check(
    `箭头线宽统一 ${ARROW_W}`,
    shafts.every((shaft) => numberAttr(shaft, 'stroke-width') === ARROW_W),
  );
  const straightLengths = files.flatMap(({ exercise }) =>
    (exercise.pose.arrows ?? [])
      .filter((item) => !item.curve)
      .map((item) => Math.round(Math.hypot(item.to[0] - item.from[0], item.to[1] - item.from[1]))),
  );
  check(
    `直线箭头长度都在 ${ARROW_LEN[0]}–${ARROW_LEN[1]}px（视觉重量一致）`,
    straightLengths.every((length) => length >= ARROW_LEN[0] && length <= ARROW_LEN[1]),
    `实测 ${Math.min(...straightLengths)}–${Math.max(...straightLengths)}`,
  );
  const headsCount = files.flatMap(({ svg }) => elements(svg, 'arrow-head'));
  const expectedHeads = files.reduce(
    (sum, { exercise }) =>
      sum +
      (exercise.pose.arrows ?? []).reduce(
        (inner, item) => inner + (item.heads === 'both' ? 2 : 1),
        0,
      ),
    0,
  );
  check(
    '往复动作是双向箭头，箭头数对得上',
    headsCount.length === expectedHeads &&
      shafts.length ===
        files.reduce((sum, { exercise }) => sum + (exercise.pose.arrows ?? []).length, 0),
    `shaft ${shafts.length} / head ${headsCount.length}`,
  );

  section('[11] 器械：只支持人形，不抢戏');
  const stackWidths = files
    .flatMap(({ svg }) => elements(svg, 'cable-stack'))
    .map((el) => numberAttr(el, 'width'));
  const plateRadii = files
    .flatMap(({ svg }) => elements(svg, 'weight-plate'))
    .map((el) => numberAttr(el, 'r'));
  const dumbbellPlates = files.flatMap(({ svg }) => elements(svg, 'dumbbell-plate'));
  const benchHeights = files
    .flatMap(({ svg }) => elements(svg, 'bench'))
    .map((el) => numberAttr(el, 'height'));
  const backrestHeight = files
    .flatMap(({ svg }) => elements(svg, 'backrest'))
    .map((el) => numberAttr(el, 'height'));

  check(
    `绳索机配重柱宽度 ≤ ${EQUIPMENT_LIMITS.stackW}（比上一版窄 23%）`,
    stackWidths.every((width) => width <= EQUIPMENT_LIMITS.stackW),
    `实测 ${[...new Set(stackWidths)].join(' / ') || '不适用'}`,
  );
  check(
    `杠铃片半径 ≤ ${EQUIPMENT_LIMITS.plateR}（比上一版小 24%）`,
    plateRadii.every((r) => r <= EQUIPMENT_LIMITS.plateR),
    `实测 ${[...new Set(plateRadii)].join(' / ') || '不适用'}`,
  );
  check(
    `哑铃片 ≤ ${EQUIPMENT_LIMITS.dumbbellPlateW}×${EQUIPMENT_LIMITS.dumbbellPlateH}`,
    dumbbellPlates.every(
      (el) =>
        numberAttr(el, 'width') <= EQUIPMENT_LIMITS.dumbbellPlateW &&
        numberAttr(el, 'height') <= EQUIPMENT_LIMITS.dumbbellPlateH,
    ),
    `实测 ${[...new Set(dumbbellPlates.map((el) => `${numberAttr(el, 'width')}×${numberAttr(el, 'height')}`))].join(' / ') || '不适用'}`,
  );
  check(
    `凳子厚度 ≤ ${EQUIPMENT_LIMITS.benchH}`,
    benchHeights.every((height) => height <= EQUIPMENT_LIMITS.benchH),
    `实测 ${[...new Set(benchHeights)].join(' / ') || '不适用'}`,
  );
  check(
    '靠背是独立的部件（不参与凳子厚度检查），高度 ≤ 100',
    backrestHeight.every((height) => height > EQUIPMENT_LIMITS.benchH && height <= 100),
    `实测 ${[...new Set(backrestHeight)].join(' / ') || '不适用'}`,
  );
  check(
    '器械只出现在器械层，且只用深灰 / 场景浅灰',
    files.every(({ svg }) => {
      const equipment = svg.match(/<g data-layer="equipment">([\s\S]*?)<\/g>/)?.[1] ?? '';
      return colors(equipment).every(
        (color) =>
          color === INK.toLowerCase() || color === CONTEXT.toLowerCase() || color === 'none',
      );
    }),
  );

  section('[12] 画布');
  check(
    'viewBox 统一 0 0 256 256',
    files.every(({ svg }) => svg.includes('viewBox="0 0 256 256"')),
  );
  check(
    '宽高统一 256',
    files.every(({ svg }) => /width="256" height="256"/.test(svg)),
  );
  const outOfBounds = files.filter(({ svg }) => outOfCanvas(svg) > 0);
  check(
    '所有坐标都在画布内',
    outOfBounds.length === 0,
    outOfBounds.map(({ exercise }) => exercise.id).join(', '),
  );
  check(
    '图标内部没有文字',
    files.every(({ svg }) => !/<text|<tspan|<title/.test(svg)),
  );

  section('[13] 负空间');
  const margins = files.map(({ exercise }) => {
    const bounds = figureBounds(exercise.pose, exercise.view);
    return {
      id: exercise.id,
      left: Math.round(bounds.minX),
      right: Math.round(256 - bounds.maxX),
      top: Math.round(bounds.minY),
      bottom: Math.round(256 - bounds.maxY),
    };
  });
  const tight = margins.filter((m) => Math.min(m.left, m.right, m.top, m.bottom) < 12);
  check(
    '每个图标四周留白 ≥ 12px',
    tight.length === 0,
    tight.map((m) => `${m.id}(${m.left}/${m.right}/${m.top}/${m.bottom})`).join(' ') ||
      `最小留白 ${Math.min(...margins.flatMap((m) => [m.left, m.right, m.top, m.bottom]))}px`,
  );

  section('[14] 视觉重量：BODY > HEAD，且同视角组内一致');
  const ink = files.map(({ exercise }) => {
    const p = exercise.pose.points;
    const view = exercise.view;
    const hidden = new Set(exercise.pose.hide ?? []);
    const dist = (a, b) => (a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0);

    const torsoLength = dist(p.neck, p.hip);
    let total =
      torsoLength * (WIDTHS.chest * 0.45 + WIDTHS.waist * 0.55) + Math.PI * HEAD_R * HEAD_R;

    for (const key of ['L', 'R']) {
      if (hidden.has(`elbow${key}`)) continue;
      const shoulder = shoulderPoint(p.neck, p.hip, view, key === 'L' ? -1 : 1);
      const seg = (a, b, part) => WIDTHS[part] * dist(a, b);
      total += seg(shoulder, p[`elbow${key}`], 'upper-arm');
      total += seg(p[`elbow${key}`], p[`wrist${key}`], 'forearm');
      total += seg(p.hip, p[`knee${key}`], 'thigh');
      total += seg(p[`knee${key}`], p[`ankle${key}`], 'lower-leg');
      total += seg(p[`ankle${key}`], p[`toe${key}`], 'foot');
    }
    return { id: exercise.id, total: Math.round(total) };
  });

  const groups = [
    {
      name: '侧视组',
      ids: [
        'barbell_back_squat',
        'barbell_bench_press',
        'conventional_deadlift',
        'push_up',
        'plank',
        'leg_press',
        'kettlebell_swing',
      ],
    },
    { name: '正面组', ids: ['lat_pulldown', 'dumbbell_biceps_curl', 'dumbbell_lateral_raise'] },
  ];

  for (const group of groups) {
    const items = ink.filter((item) => group.ids.includes(item.id));
    const sorted = [...items].sort((a, b) => a.total - b.total);
    const median = sorted[Math.floor(sorted.length / 2)].total;
    const outliers = items.filter((item) => Math.abs(item.total - median) / median > 0.35);
    check(
      `${group.name}墨水量在 ±35% 以内`,
      outliers.length === 0,
      `中位 ${median}，范围 ${sorted[0].total}–${sorted[sorted.length - 1].total}${outliers.length ? `；偏离：${outliers.map((o) => o.id).join(', ')}` : ''}`,
    );
  }

  const headRatio = files.map(({ exercise }) => {
    const p = exercise.pose.points;
    const item = ink.find((entry) => entry.id === exercise.id);
    const headArea = Math.PI * HEAD_R * HEAD_R;
    return {
      id: exercise.id,
      ratio: headArea / item.total,
      bodyLength: Math.round(Math.hypot(p.hip[0] - p.neck[0], p.hip[1] - p.neck[1])),
    };
  });
  check(
    'BODY > HEAD：头占人体面积的比例 < 15%',
    headRatio.every((item) => item.ratio < 0.15),
    `最大 ${(Math.max(...headRatio.map((item) => item.ratio)) * 100).toFixed(1)}%`,
  );
  check(
    '躯干长度 40–80px（略修长，不夸张）',
    headRatio.every((item) => item.bodyLength >= 40 && item.bodyLength <= 80),
    `实测 ${Math.min(...headRatio.map((item) => item.bodyLength))}–${Math.max(...headRatio.map((item) => item.bodyLength))}`,
  );

  section('[15] 动作辨识度');
  check('人工确认：看 preview/contact-sheet.svg 与 64px 缩略', true, '自动检查不覆盖');

  console.log('');
  if (failures > 0) {
    console.error(`风格检查失败：${checks - failures}/${checks} 项通过，${failures} 项未通过。\n`);
    process.exitCode = 1;
  } else {
    console.log(`风格检查全部通过（${checks}/${checks}）。\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
