/**
 * 生成 MASTER HUMAN SILHOUETTE SYSTEM：
 *   components/human/*.svg      七个可复用部件（各自独立成文件）
 *   master_poses/*.svg          六个 master 姿势（只有人体，没有器械 / 箭头 / 文字）
 *   master_poses/sheet.svg      六个并排，用来做「同一个人」一致性检查
 *
 *   node tools/build.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bounds,
  CANVAS,
  figure,
  HEAD_D,
  HEAD_R,
  INK,
  LENGTHS,
  round,
  torso,
  WIDTHS,
} from './human-system.mjs';
import { POSES } from './poses.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function svg(inner, { width = CANVAS, height = CANVAS } = {}) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" ` +
    `width="${width}" height="${height}" fill="none">${inner}</svg>\n`
  );
}

function verticalBar(cx, cy, length, width, part) {
  const top = cy - length / 2;
  return (
    `<line data-part="${part}" data-w="${round(width)}" data-length="${round(length)}" ` +
    `x1="${cx}" y1="${round(top)}" x2="${cx}" y2="${round(top + length)}" stroke="${INK}" ` +
    `stroke-width="${round(width)}" stroke-linecap="round" stroke-linejoin="round" />`
  );
}

/** 七个部件：都在 256×256 画布里居中竖放，便于对照 */
function components() {
  const cx = CANVAS / 2;
  const neck = [cx, 40];
  const hip = [cx, 40 + LENGTHS.torso];

  return [
    {
      file: 'head.svg',
      body:
        `<circle data-part="head" data-d="${HEAD_D}" cx="${cx}" cy="${CANVAS / 2}" ` +
        `r="${HEAD_R}" fill="${INK}" />`,
    },
    {
      file: 'torso.svg',
      body: `<g data-length="${round(LENGTHS.torso)}">${torso(neck, hip)}</g>`,
    },
    {
      file: 'upper_arm.svg',
      body: verticalBar(cx, CANVAS / 2, LENGTHS.upperArm, WIDTHS.upperArm, 'upper-arm'),
    },
    {
      file: 'forearm.svg',
      body: verticalBar(cx, CANVAS / 2, LENGTHS.forearm, WIDTHS.forearm, 'forearm'),
    },
    {
      file: 'thigh.svg',
      body: verticalBar(cx, CANVAS / 2, LENGTHS.thigh, WIDTHS.thigh, 'thigh'),
    },
    {
      file: 'lower_leg.svg',
      body: verticalBar(cx, CANVAS / 2, LENGTHS.lowerLeg, WIDTHS.lowerLeg, 'lower-leg'),
    },
    {
      file: 'foot.svg',
      body: verticalBar(cx, CANVAS / 2, LENGTHS.foot, WIDTHS.foot, 'foot'),
    },
  ];
}

async function main() {
  await mkdir(path.join(ROOT, 'components', 'human'), { recursive: true });
  await mkdir(path.join(ROOT, 'master_poses'), { recursive: true });

  for (const component of components()) {
    await writeFile(
      path.join(ROOT, 'components', 'human', component.file),
      svg(component.body),
      'utf8',
    );
    console.log(`components/human/${component.file}`);
  }

  for (const pose of POSES) {
    const body = figure(pose);
    const box = bounds(pose);
    await writeFile(path.join(ROOT, 'master_poses', `${pose.id}.svg`), svg(body), 'utf8');
    console.log(
      `master_poses/${pose.id}.svg   ${[
        Math.round(box.minX),
        Math.round(CANVAS - box.maxX),
        Math.round(box.minY),
        Math.round(CANVAS - box.maxY),
      ].join('/')}  高 ${Math.round(box.maxY - box.minY)}`,
    );
  }

  // 一致性测试图：六个并排（不写任何文字，纯人体）
  const gap = 16;
  const width = POSES.length * CANVAS + (POSES.length - 1) * gap;
  const sheet = POSES.map((pose, index) => {
    const x = index * (CANVAS + gap);
    return `<svg x="${x}" y="0" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">${figure(pose)}</svg>`;
  }).join('');
  await writeFile(
    path.join(ROOT, 'master_poses', 'sheet.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${CANVAS}" width="${width}" height="${CANVAS}" fill="none">${sheet}</svg>\n`,
    'utf8',
  );
  console.log(`master_poses/sheet.svg（6 个并排，顺序 01→06）`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
