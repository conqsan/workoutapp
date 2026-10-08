/**
 * 备份 / 恢复的端到端流程。
 *
 * 覆盖 Phase 9 的三件事：导出 JSON、导出 CSV、导入 JSON（合并 + 去重 + 报错）。
 * 这里刻意导两次、也导一个坏文件 —— 「导入」最容易出事的地方不是正常路径，
 * 而是重复导入和格式不对：那两种情况必须不产生重复数据、不静默失败。
 *
 * 需要先跑着 `npm run dev`。
 */

import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  BASE_URL,
  check,
  clickWhenReady,
  finish,
  launchBrowser,
  section,
  sleep,
  textOf,
  waitFor,
  waitUntil,
} from './harness.mjs';
import { createWorkout, daysAgoKey } from './workout-helpers.mjs';

/** 备份里的组数（训练 → 动作 → 组，三层都是嵌套的） */
function countBackupSets(backup) {
  return backup.data.workouts.reduce(
    (total, workout) =>
      total +
      workout.exercises.reduce((inner, exercise) => inner + (exercise.sets?.length ?? 0), 0),
    0,
  );
}

/** 等浏览器把文件落盘（下载是异步的，不能点完就读） */
async function waitForDownload(dir, extension, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const files = await readdir(dir).catch(() => []);
    const hit = files.find(
      (name) => name.endsWith(extension) && !name.endsWith('.crdownload') && !name.endsWith('.tmp'),
    );
    if (hit) return path.join(dir, hit);
    await sleep(200);
  }
  return null;
}

async function clearDir(dir) {
  for (const name of await readdir(dir).catch(() => [])) {
    await rm(path.join(dir, name), { force: true, recursive: true });
  }
}

async function statusText(page) {
  const handle = await page.$('[data-testid="backup-status"]');
  if (!handle) return '';
  return handle.evaluate((el) => el.textContent ?? '');
}

/** 等状态区变成指定的成功 / 失败状态 */
async function waitForStatus(page, kind, includes) {
  return waitUntil(async () => {
    const handle = await page.$('[data-testid="backup-status"]');
    if (!handle) return false;
    const actualKind = await handle.evaluate((el) => el.getAttribute('data-kind'));
    if (actualKind !== kind) return false;
    const text = await handle.evaluate((el) => el.textContent ?? '');
    return text.includes(includes);
  });
}

async function uploadBackup(page, filePath) {
  const input = await page.$('[data-testid="import-file"]');
  if (!input) throw new Error('找不到导入文件的 input');
  await input.uploadFile(filePath);
}

async function exportJson(page, downloadDir) {
  await clearDir(downloadDir);
  await clickWhenReady(await page.$('[data-testid="export-json"]'));
  const file = await waitForDownload(downloadDir, '.json');
  if (!file) throw new Error('点了「导出 JSON」但下载目录里没有出现文件');
  return { file, backup: JSON.parse(await readFile(file, 'utf8')) };
}

/** 另一台设备上的备份：部位 / 动作 / 补剂的 id 都和本机不一样，只能按名字认 */
function makeFixtures() {
  const createdAt = '2026-08-20T09:00:00.000Z';

  const backup = {
    format: 'fitlog-backup',
    version: 1,
    appVersion: '0.1.0',
    exportedAt: createdAt,
    data: {
      muscles: [{ id: 'm_other', name: '胸', sortOrder: 1 }],
      exercises: [
        {
          id: 'e_other',
          name: '杠铃卧推',
          muscleId: 'm_other',
          description: null,
          isCustom: false,
          sortOrder: 0,
        },
      ],
      supplements: [{ id: 'sup_other', name: '蛋白粉', unit: 'g', isDefault: true, sortOrder: 0 }],
      supplementRecords: [
        {
          id: 'sr_other',
          supplementId: 'sup_other',
          date: '2026-08-20',
          amount: 30,
          unit: 'g',
          consumptionTime: '训练后',
          note: '',
          createdAt,
        },
      ],
      workouts: [
        {
          id: 'w_other',
          date: '2026-08-20',
          startTime: createdAt,
          endTime: '2026-08-20T10:00:00.000Z',
          note: '从旧手机导进来的',
          status: 'completed',
          createdAt,
          updatedAt: createdAt,
          exercises: [
            {
              id: 'we_other',
              workoutId: 'w_other',
              exerciseId: 'e_other',
              exerciseName: '杠铃卧推',
              muscleId: 'm_other',
              muscleName: '胸',
              sortOrder: 0,
              note: '',
              createdAt,
              sets: [
                {
                  id: 's_other_1',
                  workoutExerciseId: 'we_other',
                  setNumber: 1,
                  weight: 60,
                  weightUnit: 'kg',
                  reps: 12,
                  restSeconds: 60,
                  note: '',
                  completed: true,
                  createdAt,
                },
                {
                  id: 's_other_2',
                  workoutExerciseId: 'we_other',
                  setNumber: 2,
                  weight: 60,
                  weightUnit: 'kg',
                  reps: 10,
                  restSeconds: null,
                  note: '',
                  completed: true,
                  createdAt,
                },
              ],
            },
          ],
        },
      ],
    },
  };

  return { backup, notABackup: { hello: 'world' } };
}

async function main() {
  const { page, jsErrors, cleanup } = await launchBrowser();
  const downloads = await mkdtemp(path.join(tmpdir(), 'fitlog-downloads-'));
  const fixtures = await mkdtemp(path.join(tmpdir(), 'fitlog-fixtures-'));

  const client = await page.createCDPSession();
  await client.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloads,
    eventsEnabled: true,
  });

  const { backup: fixture, notABackup } = makeFixtures();
  const goodFixturePath = path.join(fixtures, 'old-phone-backup.json');
  const badFixturePath = path.join(fixtures, 'not-a-backup.json');
  await writeFile(goodFixturePath, JSON.stringify(fixture, null, 2), 'utf8');
  await writeFile(badFixturePath, JSON.stringify(notABackup, null, 2), 'utf8');

  try {
    section('[1] 准备本机数据：今天练一次胸');
    await createWorkout(page, {
      date: daysAgoKey(0),
      muscle: '胸',
      exercise: '杠铃卧推',
      sets: [
        [80, 10],
        [75, 8],
      ],
    });
    check('本机已经记录了一次训练', true);

    section('[2] 「我的」页的数据概览');
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'backup-card');
    check('「我的」页有数据备份卡片', true);
    check(
      '概览显示 1 次训练 / 2 组',
      await waitUntil(async () => {
        const text = await textOf(page, 'data-overview');
        return text.includes('1 次训练') && text.includes('2 组');
      }),
      await textOf(page, 'data-overview'),
    );

    // 和别的流程一样，想看界面就设这个环境变量
    if (process.env.E2E_SCREENSHOT_PROFILE) {
      await page.screenshot({ path: process.env.E2E_SCREENSHOT_PROFILE, fullPage: true });
    }

    section('[3] 导出 JSON');
    const first = await exportJson(page, downloads);
    check(
      '点了导出就真的下载了文件',
      path.basename(first.file).startsWith('fitlog-backup-'),
      path.basename(first.file),
    );
    check(
      '文件是带格式标记和版本号的备份',
      first.backup.format === 'fitlog-backup' && first.backup.version === 1,
      { format: first.backup.format, version: first.backup.version },
    );
    check(
      '备份里有 1 次训练、2 组',
      first.backup.data.workouts.length === 1 && countBackupSets(first.backup) === 2,
      { workouts: first.backup.data.workouts.length, sets: countBackupSets(first.backup) },
    );
    check(
      '页面上给出了导出成功的提示',
      await waitForStatus(page, 'ok', '已导出完整备份'),
      await statusText(page),
    );

    section('[4] 导出 CSV');
    await clearDir(downloads);
    await clickWhenReady(await page.$('[data-testid="export-csv"]'));
    const csvFile = await waitForDownload(downloads, '.csv');
    check('CSV 也下载成功了', csvFile !== null, csvFile);
    const csv = csvFile ? await readFile(csvFile, 'utf8') : '';
    check(
      'CSV 有表头和换算列',
      csv.includes('训练日期') && csv.includes('本组训练量(kg)'),
      csv.split('\r\n')[0],
    );
    check(
      'CSV 一行 = 一组（表头 + 2 行）',
      csv.split('\r\n').filter((line) => line !== '').length === 3,
      csv.split('\r\n').length,
    );
    check(
      'CSV 里有这次的动作与换算后的训练量',
      csv.includes('杠铃卧推') && csv.includes('800'),
      csv,
    );

    section('[5] 导入另一台设备的备份（id 不同，按名字合并）');
    await uploadBackup(page, goodFixturePath);
    check('导入成功并给出提示', await waitForStatus(page, 'ok', '已导入'), await statusText(page));
    check(
      '提示里说明了跳过多少条重复',
      (await statusText(page)).includes('跳过重复'),
      await statusText(page),
    );
    check(
      '概览刷新成 2 次训练',
      await waitUntil(async () => (await textOf(page, 'data-overview')).includes('2 次训练')),
      await textOf(page, 'data-overview'),
    );

    section('[6] 再导出一份，检查合并结果没有重复');
    const merged = await exportJson(page, downloads);
    const chestMuscles = merged.backup.data.muscles.filter((muscle) => muscle.name === '胸');
    const benchExercises = merged.backup.data.exercises.filter(
      (exercise) => exercise.name === '杠铃卧推',
    );
    check(
      '「胸」只有一个（没有把默认部位再加一遍）',
      chestMuscles.length === 1,
      chestMuscles.length,
    );
    check('「杠铃卧推」也只有一个', benchExercises.length === 1, benchExercises.length);
    check(
      '导入的动作挂在本机已有的「胸」上',
      benchExercises.every((exercise) => exercise.muscleId === chestMuscles[0]?.id),
      benchExercises.map((exercise) => exercise.muscleId),
    );
    check(
      '训练变成 2 次',
      merged.backup.data.workouts.length === 2,
      merged.backup.data.workouts.length,
    );
    check(
      '导入那次训练的动作名保留了下来',
      merged.backup.data.workouts.some(
        (workout) =>
          workout.date === '2026-08-20' &&
          workout.exercises.some((exercise) => exercise.exerciseName === '杠铃卧推'),
      ),
    );
    check(
      '「蛋白粉」没有被加成两种',
      merged.backup.data.supplements.filter((item) => item.name === '蛋白粉').length === 1,
    );
    check(
      '补剂记录也导进来了',
      merged.backup.data.supplementRecords.length === 1,
      merged.backup.data.supplementRecords.length,
    );

    section('[7] 同一份再导一次：不产生重复');
    await uploadBackup(page, goodFixturePath);
    check(
      '提示本机已经有这些数据',
      await waitForStatus(page, 'ok', '已经有这些数据'),
      await statusText(page),
    );
    const twice = await exportJson(page, downloads);
    check(
      '训练仍然只有 2 次',
      twice.backup.data.workouts.length === 2,
      twice.backup.data.workouts.length,
    );
    check('组数没有翻倍', countBackupSets(twice.backup) === 4, countBackupSets(twice.backup));

    section('[8] 导错文件：明确报错，且不写入任何数据');
    await uploadBackup(page, badFixturePath);
    check(
      '提示这不是 FitLog 的备份',
      await waitForStatus(page, 'error', '不是有效的 FitLog 备份'),
      await statusText(page),
    );
    check(
      '错误提示里带了具体原因（format）',
      (await statusText(page)).includes('format'),
      await statusText(page),
    );

    const afterBad = await exportJson(page, downloads);
    check(
      '坏文件没有动到本机数据',
      afterBad.backup.data.workouts.length === 2 && countBackupSets(afterBad.backup) === 4,
      { workouts: afterBad.backup.data.workouts.length, sets: countBackupSets(afterBad.backup) },
    );

    section('[9] 页面没有 JS 报错');
    check('没有 JS 异常', jsErrors.length === 0, jsErrors);
  } finally {
    await cleanup();
    await rm(downloads, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined);
    await rm(fixtures, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined);
  }

  finish();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
