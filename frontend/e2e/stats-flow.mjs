/**
 * Phase 6 端到端验收：统计页。
 *
 * 前置：dev server 已经在跑（npm run dev）
 * 运行：npm run e2e
 *
 * 数据设计（刻意让断言与「今天是几号」无关）：
 *   - 今天第 1 次：胸 杠铃卧推 80×10 + 80×8  → 1440kg
 *   - 今天第 2 次：肩 哑铃侧平举 10×12       → 120kg
 *   - 60 天前：胸 杠铃卧推 70×10             → 700kg
 * 60 天前一定不在本周、也不在近 30 天，所以「本周 / 近 30 天」都是今天的 2 次、合计 1560kg。
 * 注意：normalizeNumberText 会去掉千分位逗号，比较时用不带逗号的写法。
 * 界面上的日期边界数学由 scripts/stats-test.ts 用固定日期单独测。
 */

import {
  BASE_URL,
  check,
  clickWhenReady,
  finish,
  launchBrowser,
  normalizeNumberText,
  section,
  textOf,
  waitFor,
  waitUntil,
} from './harness.mjs';
import { createWorkout, daysAgoKey } from './workout-helpers.mjs';

async function muscleRowTexts(page) {
  return page.$$eval('[data-testid="stat-muscles"] li', (nodes) =>
    nodes.map((node) => (node.textContent ?? '').replace(/\s+/g, '')),
  );
}

async function exerciseRowTexts(page) {
  return page.$$eval('[data-testid="stat-exercises"] li', (nodes) =>
    nodes.map((node) => (node.textContent ?? '').replace(/\s+/g, '')),
  );
}

async function main() {
  const { page, pageErrors, cleanup } = await launchBrowser();

  try {
    section('[1] 造数据：今天两次动作 + 60 天前一次');
    await createWorkout(page, {
      muscle: '胸',
      exercise: '杠铃卧推',
      sets: [
        [80, 10],
        [80, 8],
      ],
    });
    check('今天的卧推已记录', true);

    await createWorkout(page, {
      muscle: '肩',
      exercise: '哑铃侧平举',
      sets: [[10, 12]],
    });
    check('今天的侧平举已记录', true);

    const pastDate = daysAgoKey(60);
    await createWorkout(page, {
      date: pastDate,
      muscle: '胸',
      exercise: '杠铃卧推',
      sets: [[70, 10]],
    });
    check(`60 天前（${pastDate}）的卧推已补记`, true);

    section('[2] 训练天数：本周 / 近 30 天');
    await page.goto(`${BASE_URL}/stats`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'stat-week-workouts', undefined, 15_000);

    check(
      '本周 1 天（今天练了两次也只算一天；60 天前那次不算）',
      (await textOf(page, 'stat-week-workouts')).replace(/\s+/g, '') === '1天',
      await textOf(page, 'stat-week-workouts'),
    );
    check(
      '近 30 天 1 天（60 天前那次不在窗口内）',
      (await textOf(page, 'stat-last30-workouts')).replace(/\s+/g, '') === '1天',
      await textOf(page, 'stat-last30-workouts'),
    );
    check(
      '累计 2 天 / 3 次训练（含 60 天前那次）',
      (await page.evaluate(() => document.body.innerText)).includes('累计 2 天 / 3 次训练'),
    );

    section('[3] 训练总量：今天 / 本周 / 近 30 天');
    // 今天：80×10 + 80×8 + 10×12 = 800 + 640 + 120 = 1560
    check(
      '今天的训练总量 = 1,560 kg',
      normalizeNumberText(await textOf(page, 'stat-today-volume')).includes('1560kg'),
      await textOf(page, 'stat-today-volume'),
    );
    check(
      '本周训练总量 = 1,560 kg（60 天前那次不算）',
      normalizeNumberText(await textOf(page, 'stat-week-volume')).includes('1560kg'),
      await textOf(page, 'stat-week-volume'),
    );
    check(
      '近 30 天训练总量 = 1,560 kg',
      normalizeNumberText(await textOf(page, 'stat-last30-volume')).includes('1560kg'),
      await textOf(page, 'stat-last30-volume'),
    );

    section('[4] 各部位 / 各动作训练次数');
    // 各动作训练次数是按部位折叠的（默认只展开第一组），先全部展开再逐个核对
    await clickWhenReady(await waitFor(page, 'toggle-exercise-groups'));
    const muscles = await muscleRowTexts(page);
    check(
      '胸练了 2 次',
      muscles.some((text) => text.startsWith('胸') && text.includes('2次')),
      muscles,
    );
    check(
      '肩练了 1 次',
      muscles.some((text) => text.startsWith('肩') && text.includes('1次')),
      muscles,
    );
    check('胸排在肩前面（次数多的在前）', muscles[0]?.startsWith('胸'), muscles);

    const exercises = await exerciseRowTexts(page);
    check(
      '杠铃卧推练了 2 次、3 组',
      exercises.some(
        (text) => text.includes('杠铃卧推') && text.includes('2次') && text.includes('3组'),
      ),
      exercises,
    );
    check(
      '哑铃侧平举练了 1 次',
      exercises.some((text) => text.includes('哑铃侧平举') && text.includes('1次')),
      exercises,
    );

    section('[4.5] 各动作训练次数按部位分组');
    const groupNames = await page.$$eval('[data-testid="exercise-group"]', (nodes) =>
      nodes.map((node) => node.getAttribute('data-name')),
    );
    check(
      '分组就是练过的部位（胸 / 肩）',
      groupNames.includes('胸') && groupNames.includes('肩'),
      groupNames,
    );
    check(
      '每组标题写着动作数与组数',
      (
        await page.$eval(
          '[data-testid="exercise-group"][data-name="胸"]',
          (node) => node.textContent ?? '',
        )
      ).includes('1 个动作'),
      await page.$eval(
        '[data-testid="exercise-group"][data-name="胸"]',
        (node) => node.textContent ?? '',
      ),
    );

    // 全部收起 → 一条动作都不显示；再展开 → 都回来（动作多了也不用把页面拉成长条）
    await clickWhenReady(await waitFor(page, 'toggle-exercise-groups'));
    check(
      '全部收起后看不到任何动作',
      await waitUntil(async () => (await exerciseRowTexts(page)).length === 0),
      await exerciseRowTexts(page),
    );
    await clickWhenReady(await waitFor(page, 'toggle-exercise-groups'));
    check(
      '重新展开后所有部位的动作都在',
      await waitUntil(async () => {
        const texts = await exerciseRowTexts(page);
        return (
          texts.some((text) => text.includes('杠铃卧推')) &&
          texts.some((text) => text.includes('哑铃侧平举'))
        );
      }),
      await exerciseRowTexts(page),
    );

    section('[5] 动作重量变化（默认选中练得最多的动作）');
    await waitFor(page, 'trend-chart', undefined, 10_000);
    check('渲染了趋势图', (await page.$('[data-testid="trend-chart"]')) !== null);
    check(
      '默认选中的是杠铃卧推',
      normalizeNumberText(await page.evaluate(() => document.body.innerText)).includes(
        '每次训练中「杠铃卧推」的最大重量',
      ),
    );

    check(
      '最大重量 80 kg',
      (await textOf(page, 'trend-max')).includes('80'),
      await textOf(page, 'trend-max'),
    );
    check(
      '最近重量 80 kg（今天那次）',
      (await textOf(page, 'trend-latest')).includes('80'),
      await textOf(page, 'trend-latest'),
    );
    check(
      '总训练量 = 800 + 640 + 700 = 2,140 kg',
      normalizeNumberText(await textOf(page, 'trend-volume')).includes('2140kg'),
      await textOf(page, 'trend-volume'),
    );

    if (process.env.E2E_SCREENSHOT_STATS) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: process.env.E2E_SCREENSHOT_STATS });
      console.log(`  · 截图已保存：${process.env.E2E_SCREENSHOT_STATS}`);
    }

    section('[6] 切换到另一个动作');
    // 动作选项现在按部位分组：先切到「肩」，再选侧平举
    const lateralChip = await page.waitForSelector('[data-testid="trend-muscle"][data-name="肩"]');
    await clickWhenReady(lateralChip);
    await clickWhenReady(
      await page.waitForSelector('[data-testid="trend-exercise"][data-name="哑铃侧平举"]'),
    );
    check(
      '图表跟随切换（副标题变成哑铃侧平举）',
      await waitUntil(async () =>
        normalizeNumberText(await page.evaluate(() => document.body.innerText)).includes(
          '每次训练中「哑铃侧平举」的最大重量',
        ),
      ),
    );
    check(
      '侧平举最大重量 10 kg',
      await waitUntil(async () => (await textOf(page, 'trend-max')).includes('10')),
      await textOf(page, 'trend-max'),
    );

    section('[7] 首页「今日概览」用的是同一套数据');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'today-volume', undefined, 15_000);

    check(
      '今日部位 胸 + 肩',
      (await textOf(page, 'today-muscles')).includes('胸') &&
        (await textOf(page, 'today-muscles')).includes('肩'),
      await textOf(page, 'today-muscles'),
    );
    check(
      '今日动作 2 个',
      (await textOf(page, 'today-exercises')).includes('2'),
      await textOf(page, 'today-exercises'),
    );
    check(
      '今日组数 3 组',
      (await textOf(page, 'today-sets')).includes('3'),
      await textOf(page, 'today-sets'),
    );
    check(
      '今日训练总量 1,560 kg',
      normalizeNumberText(await textOf(page, 'today-volume')).includes('1560kg'),
      await textOf(page, 'today-volume'),
    );
    check(
      '首页显示「今天已经练过了」',
      (await page.evaluate(() => document.body.innerText)).includes('今天已经练过了'),
    );

    section('[8] 进行中的训练不计入统计');
    await page.goto(`${BASE_URL}/workout`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'start-workout', undefined, 15_000);
    await clickWhenReady(await page.$('[data-testid="start-workout"]'));
    await waitFor(page, 'open-exercise-picker');

    await page.goto(`${BASE_URL}/stats`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'stat-week-workouts', undefined, 15_000);
    const statsText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

    check(
      '页面提示有进行中的训练未计入',
      statsText.includes('进行中的训练没有计入'),
      statsText.slice(0, 160),
    );
    check(
      '本周仍然是 1 天',
      (await textOf(page, 'stat-week-workouts')).replace(/\s+/g, '') === '1天',
    );
    check(
      '今天的训练总量仍然是 1,560 kg（没把空训练算进去）',
      normalizeNumberText(await textOf(page, 'stat-today-volume')).includes('1560kg'),
    );

    section('[9] 同名动作（胸 / 三头）在趋势里只出现一次');
    // 先把上一节留下的进行中训练放弃掉，才能重新开始训练
    await page.goto(`${BASE_URL}/workout`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'discard-workout', undefined, 10_000);
    await clickWhenReady(await waitFor(page, 'discard-workout'));
    await clickWhenReady(await waitFor(page, 'confirm-discard'));
    await waitFor(page, 'start-workout', undefined, 10_000);

    // 「双杠臂屈伸」默认在胸和三头各有一条（两个不同的动作 id，其实是同一个动作）
    await createWorkout(page, { muscle: '胸', exercise: '双杠臂屈伸', sets: [[20, 8]] });
    await createWorkout(page, { muscle: '三头', exercise: '双杠臂屈伸', sets: [[25, 6]] });

    await page.goto(`${BASE_URL}/stats`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'stat-week-workouts', undefined, 15_000);

    // 动作按部位分组了：先在「胸」下找「双杠臂屈伸」
    await clickWhenReady(
      await page.waitForSelector('[data-testid="trend-muscle"][data-name="胸"]'),
    );

    const chipNames = await page.$$eval('[data-testid="trend-exercise"]', (nodes) =>
      nodes.map((node) => node.getAttribute('data-name')),
    );
    check('趋势里的动作名没有重复', new Set(chipNames).size === chipNames.length, chipNames);
    check(
      '「双杠臂屈伸」只出现一次',
      chipNames.filter((name) => name === '双杠臂屈伸').length === 1,
      chipNames,
    );

    await clickWhenReady(
      await page.waitForSelector('[data-testid="trend-exercise"][data-name="双杠臂屈伸"]'),
    );
    check(
      '合并后取两边的最大重量 25 kg（只看胸那条会是 20）',
      await waitUntil(async () => (await textOf(page, 'trend-max')).includes('25')),
      await textOf(page, 'trend-max'),
    );
    check(
      '总训练量把两个部位合起来算：20×8 + 25×6 = 310 kg',
      normalizeNumberText(await textOf(page, 'trend-volume')).includes('310kg'),
      await textOf(page, 'trend-volume'),
    );

    section('[10] 页面没有 JS 报错');
    check('控制台无报错', pageErrors.length === 0, pageErrors.slice(0, 3));
  } finally {
    await cleanup();
  }

  finish();
}

main().catch((error) => {
  console.error('\n统计页端到端测试执行异常：', error);
  process.exitCode = 1;
});
