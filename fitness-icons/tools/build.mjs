/**
 * FitLog 图标系统 · 构建脚本
 *
 *   node tools/build.mjs
 *
 * 做三件事：
 *   1. 读 exercises.json，用 components/ 里的组件拼出每个动作的**独立 SVG**
 *      （输出到 <category>/<id>.svg，256×256，内部不含任何文字）
 *   2. 生成 preview/contact-sheet.svg（10 个图标同尺寸排列，名称放在图标外）
 *   3. 生成 preview/size-test.svg（256 / 128 / 64 / 48 / 32 五档缩略，检查小尺寸可读性）
 *   4. 打印每个图标的人体包围盒与「墨水量」，用来判断留白和视觉重量是否一致
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { figure, figureBounds, HEAD_R, shoulderPoint, WIDTHS } from '../components/human/index.mjs';
import * as equipment from '../components/equipment/index.mjs';
import { arrow } from '../components/arrows/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const CANVAS = 256;
const LABEL_COLOR = '#6B7280';
const FONT = "-apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif";

function renderProp(prop) {
  switch (prop.type) {
    case 'floor':
      return equipment.floorLine(prop.y, { x1: prop.x1, x2: prop.x2 });
    case 'bar':
      return equipment.bar(prop.from, prop.to, { width: prop.width });
    case 'barbell':
      return equipment.barbell(prop.from, prop.to, {
        plates: prop.plates !== false,
        plateR: prop.plateR,
      });
    case 'dumbbell':
      return equipment.dumbbell(prop.at[0], prop.at[1], { angle: prop.angle, len: prop.len });
    case 'kettlebell':
      return equipment.kettlebell(prop.at[0], prop.at[1], { r: prop.r });
    case 'bench':
      return equipment.bench(prop.x, prop.y, prop.w, prop.h, { legs: prop.legs });
    case 'seat':
      return equipment.bench(prop.x, prop.y, prop.w, prop.h);
    case 'backrest':
      return equipment.bench(prop.x, prop.y, prop.w, prop.h, { part: 'backrest' });
    case 'pull-up-bar':
      return equipment.pullUpBar(prop.from, prop.to);
    case 'cable-machine':
      return equipment.cableMachine({
        x: prop.x,
        y: prop.y,
        w: prop.w,
        h: prop.h,
        pulleyY: prop.pulleyY,
        cableTo: prop.cableTo,
      });
    default:
      throw new Error(`未知器械类型：${prop.type}`);
  }
}

/** 图标内容（不含外层 <svg>），便于内联进 Contact Sheet */
function iconLayers(exercise) {
  const pose = exercise.pose;
  const props = (pose.props ?? []).map(renderProp).join('');
  // 视角决定躯干轮廓（正面看宽度、侧视看厚度），所以要把 view 传进去
  const body = figure(pose, exercise.view);
  const arrows = (pose.arrows ?? []).map(arrow).join('');

  return (
    `<g data-layer="equipment">${props}</g>` +
    `<g data-layer="figure">${body}</g>` +
    `<g data-layer="arrows">${arrows}</g>`
  );
}

function standaloneSvg(exercise) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" ` +
    `width="${CANVAS}" height="${CANVAS}" fill="none" role="img" aria-label="${exercise.name}">` +
    iconLayers(exercise) +
    `</svg>\n`
  );
}

function nestedIcon(exercise, x, y, size) {
  return (
    `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${CANVAS} ${CANVAS}" ` +
    `overflow="visible">${iconLayers(exercise)}</svg>`
  );
}

function label(text, x, y, size = 20) {
  return (
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${LABEL_COLOR}" ` +
    `text-anchor="middle">${text}</text>`
  );
}

/** 简单流式排布：图标按格子横向排，超过 maxWidth 换行 */
function flowGrid(exercises, { tile, gap, maxWidth, startX, startY, labelHeight }) {
  const perRow = Math.max(1, Math.floor((maxWidth - startX * 2 + gap) / (tile + gap)));
  const rows = Math.ceil(exercises.length / perRow);
  const parts = [];

  exercises.forEach((exercise, index) => {
    const column = index % perRow;
    const row = Math.floor(index / perRow);
    const x = startX + column * (tile + gap);
    const y = startY + row * (tile + labelHeight + gap);
    parts.push(nestedIcon(exercise, x, y, tile));
    parts.push(
      label(
        exercise.name,
        x + tile / 2,
        y + tile + labelHeight - 6,
        Math.max(11, Math.min(20, tile / 6)),
      ),
    );
  });

  return {
    svg: parts.join(''),
    // 返回这一块内容在画布上的绝对底边与右边界，调用方据此往下排
    height: startY + rows * (tile + labelHeight + gap) - gap,
    width: startX + perRow * (tile + gap) - gap + startX,
  };
}

function contactSheet(exercises) {
  const tile = CANVAS;
  const gap = 24;
  const labelHeight = 44;
  const columns = 5;
  const rows = Math.ceil(exercises.length / columns);
  const width = 48 * 2 + columns * tile + (columns - 1) * gap;
  const height = 96 + rows * (tile + labelHeight) + (rows - 1) * gap + 48;
  const parts = [
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#FFFFFF" />`,
    label('FitLog · 动作图标 Contact Sheet（10 个基准动作）', width / 2, 52, 28),
  ];

  exercises.forEach((exercise, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 48 + column * (tile + gap);
    const y = 96 + row * (tile + labelHeight + gap);
    parts.push(
      `<rect x="${x - 12}" y="${y - 12}" width="${tile + 24}" height="${tile + 24}" rx="20" fill="#F8FAFC" />`,
    );
    parts.push(nestedIcon(exercise, x, y, tile));
    parts.push(label(exercise.name, x + tile / 2, y + tile + 30, 22));
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    parts.join('') +
    `</svg>\n`
  );
}

function sizeTest(exercises) {
  const sizes = [256, 128, 64, 48, 32];
  const parts = [];
  let y = 64;
  let width = 1560;

  parts.push(label('FitLog · 小尺寸可读性检查（256 / 128 / 64 / 48 / 32）', 48, 40, 24));

  for (const size of sizes) {
    const gap = Math.max(16, size * 0.22);
    const grid = flowGrid(exercises, {
      tile: size,
      gap,
      maxWidth: width,
      startX: 120,
      startY: y + 34,
      labelHeight: Math.max(22, size * 0.3),
    });

    parts.push(label(`${size} × ${size}`, 48, y + 60, 20));
    parts.push(grid.svg);
    width = Math.max(width, grid.width);
    y = grid.height + 40;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${y}" width="${width}" height="${y}">` +
    `<rect x="0" y="0" width="${width}" height="${y}" fill="#FFFFFF" />` +
    parts.join('') +
    `</svg>\n`
  );
}

/** 人体墨水量（各部件面积近似求和），用来比较视觉重量 */
function inkArea(exercise) {
  const pose = exercise.pose;
  const p = pose.points;
  const view = exercise.view;
  const hidden = new Set(pose.hide ?? []);
  const dist = (a, b) => (a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0);

  const torsoLength = dist(p.neck, p.hip);
  let ink = torsoLength * (WIDTHS.chest * 0.45 + WIDTHS.waist * 0.55) + Math.PI * HEAD_R * HEAD_R;

  for (const key of ['L', 'R']) {
    if (hidden.has(`elbow${key}`)) continue;
    const shoulder = shoulderPoint(p.neck, p.hip, view, key === 'L' ? -1 : 1);
    const seg = (a, b, part) => WIDTHS[part] * dist(a, b);
    ink += seg(shoulder, p[`elbow${key}`], 'upper-arm');
    ink += seg(p[`elbow${key}`], p[`wrist${key}`], 'forearm');
    ink += seg(p.hip, p[`knee${key}`], 'thigh');
    ink += seg(p[`knee${key}`], p[`ankle${key}`], 'lower-leg');
    ink += seg(p[`ankle${key}`], p[`toe${key}`], 'foot');
  }

  return Math.round(ink);
}

async function main() {
  const exercises = JSON.parse(await readFile(path.join(ROOT, 'exercises.json'), 'utf8'));
  const categories = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core', 'full_body'];

  for (const category of categories) {
    await mkdir(path.join(ROOT, category), { recursive: true });
  }
  await mkdir(path.join(ROOT, 'preview'), { recursive: true });
  await rm(path.join(ROOT, 'preview', 'contact-sheet.svg'), { force: true });

  console.log('id                         canvas margins (x/y)     ink   file');
  console.log('-'.repeat(78));

  for (const exercise of exercises) {
    const bounds = figureBounds(exercise.pose, exercise.view);
    if (!bounds) throw new Error(`${exercise.id} 没有人形数据`);

    const margins = [
      Math.round(bounds.minX),
      CANVAS - Math.round(bounds.maxX),
      Math.round(bounds.minY),
      CANVAS - Math.round(bounds.maxY),
    ];
    if (margins.some((margin) => margin < 8)) {
      console.warn(`  ! ${exercise.id} 人体贴边了：左/右/上/下 = ${margins.join('/')}`);
    }

    const file = path.join(ROOT, exercise.category, exercise.icon);
    await writeFile(file, standaloneSvg(exercise), 'utf8');

    console.log(
      `${exercise.id.padEnd(26)} ${margins.join('/').padEnd(22)} ${String(inkArea(exercise)).padStart(4)}   ${exercise.category}/${exercise.icon}`,
    );
  }

  await writeFile(path.join(ROOT, 'preview', 'contact-sheet.svg'), contactSheet(exercises), 'utf8');
  await writeFile(path.join(ROOT, 'preview', 'size-test.svg'), sizeTest(exercises), 'utf8');

  console.log('-'.repeat(78));
  console.log(`共 ${exercises.length} 个图标 + preview/contact-sheet.svg + preview/size-test.svg`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
