/**
 * Phase 3 端到端验收：在真实浏览器里把训练流程完整走一遍。
 *
 * 前置：dev server 已经在跑（默认 http://localhost:5173，即 npm run dev）
 * 运行：npm run e2e
 */

import {
  BASE_URL,
  check,
  clickWhenReady,
  finish,
  launchBrowser,
  normalizeNumberText,
  section,
  setInputValue,
  textOf,
  waitFor,
  waitIn,
  waitUntil,
} from './harness.mjs';
import {
  addExercise,
  addSet,
  cardByName,
  cardSetValues,
  clickQuickWeight,
  countSets,
} from './workout-helpers.mjs';

async function main() {
  const { page, pageErrors, cleanup } = await launchBrowser();

  try {
    await page.goto(`${BASE_URL}/workout`, { waitUntil: 'domcontentloaded' });

    section('[1] 开始训练');
    await waitFor(page, 'start-workout', undefined, 15_000);
    check('未开始训练时显示「开始训练」按钮', true);

    await clickWhenReady(await page.$('[data-testid="start-workout"]'));
    await waitFor(page, 'open-exercise-picker');
    check('点击后进入训练中界面', true);
    check('顶部显示「训练中」', (await page.content()).includes('训练中'));

    section('[2] 选择部位 → 添加动作');
    const benchCard = await addExercise(page, '胸', '杠铃卧推');
    check('胸 → 杠铃卧推 已加入训练', benchCard !== null);
    check('显示训练部位：胸', (await page.content()).includes('训练部位：胸'));

    section('[3] 逐组录入卧推 80×10 / 80×8 / 75×10');
    for (const [weight, reps] of [
      [80, 10],
      [80, 8],
      [75, 10],
    ]) {
      await addSet(page, benchCard, weight, reps);
    }

    check('仍然停留在 /workout（没有误点底部导航）', page.url().endsWith('/workout'), page.url());
    check('共有 3 组', (await countSets(page)) === 3, await countSets(page));
    check(
      '每组重量分别是 80 / 80 / 75',
      JSON.stringify(await cardSetValues(benchCard)) === JSON.stringify(['80', '80', '75']),
      await cardSetValues(benchCard),
    );
    check(
      '训练总量 = 80×10 + 80×8 + 75×10 = 2190 kg',
      await waitUntil(async () =>
        normalizeNumberText(await textOf(page, 'total-volume')).includes('2190'),
      ),
      await textOf(page, 'total-volume'),
    );
    check(
      '总组数显示 3 组',
      (await textOf(page, 'total-sets')).includes('3'),
      await textOf(page, 'total-sets'),
    );

    section('[4] 快捷重量调整：75 → 点 +2.5 → 77.5');
    const firstWeight = (await benchCard.$$('[data-testid="set-weight"]'))[0];
    await setInputValue(firstWeight, 75);
    await clickQuickWeight(benchCard, '+2.5');

    check(
      '输入框变成 77.5',
      await waitUntil(async () => (await cardSetValues(benchCard))[0] === '77.5'),
      await cardSetValues(benchCard),
    );
    check(
      '总量随之更新 = 77.5×10 + 80×8 + 75×10 = 2165 kg',
      await waitUntil(async () =>
        normalizeNumberText(await textOf(page, 'total-volume')).includes('2165'),
      ),
      await textOf(page, 'total-volume'),
    );

    section('[5] 复制上一组');
    await clickWhenReady(await benchCard.$('[data-testid="copy-last-set"]'));
    check('复制后变成 4 组', await waitUntil(async () => (await countSets(page)) === 4));
    check(
      '新一组沿用上一组的重量 75',
      await waitUntil(async () => (await cardSetValues(benchCard))[3] === '75'),
      await cardSetValues(benchCard),
    );
    check(
      '组号正确（出现第 4 组）',
      (await benchCard.evaluate((el) => el.textContent ?? '')).includes('第 4 组'),
    );

    section('[6] 重量单位 kg ↔ lb');
    check(
      '切换前是 77.5（kg）',
      (await cardSetValues(benchCard))[0] === '77.5',
      await cardSetValues(benchCard),
    );
    check(
      '第 1 组有 kg / lb 两个单位按钮',
      (await benchCard.$$('[data-testid="weight-unit"]')).length === 8, // 4 组 × 2 个按钮
      (await benchCard.$$('[data-testid="weight-unit"]')).length,
    );

    const toLb = (await benchCard.$$('[data-testid="weight-unit"][data-unit="lb"]'))[0];
    await clickWhenReady(toLb);
    check(
      '切成 lb 后数值跟着换算：77.5kg → 170.86lb',
      await waitUntil(async () => (await cardSetValues(benchCard))[0] === '170.86'),
      await cardSetValues(benchCard),
    );
    check(
      '换算不会改变实际重量，训练总量仍是 2915kg',
      await waitUntil(async () =>
        normalizeNumberText(await textOf(page, 'total-volume')).includes('2915'),
      ),
      await textOf(page, 'total-volume'),
    );

    const backToKg = (await benchCard.$$('[data-testid="weight-unit"][data-unit="kg"]'))[0];
    await clickWhenReady(backToKg);
    check(
      '切回 kg 恢复成 77.5',
      await waitUntil(async () => (await cardSetValues(benchCard))[0] === '77.5'),
      await cardSetValues(benchCard),
    );

    section('[7] 再加一个部位：肩 → 哑铃侧平举，10×12 两组');
    const lateralCard = await addExercise(page, '肩', '哑铃侧平举');
    await addSet(page, lateralCard, 10, 12);
    await addSet(page, lateralCard, 10, 12);

    check('训练部位变成 胸 + 肩', (await page.content()).includes('胸 + 肩'));
    check('共 2 个动作', (await page.$$('[data-testid="exercise-card"]')).length === 2);
    check(
      '共 6 组',
      await waitUntil(async () => (await textOf(page, 'total-sets')).includes('6')),
      await textOf(page, 'total-sets'),
    );
    check(
      '动作列表是手风琴：同时只展开一个（DOM 里只有展开那个的组）',
      (await countSets(page)) === 2,
      await countSets(page),
    );

    section('[8] 刷新页面 —— 验收：数据必须还在');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitFor(page, 'total-sets', undefined, 15_000);

    // 刷新后默认展开第一个动作（杠铃卧推）
    const benchAfterReload = await cardByName(page, '杠铃卧推');
    const valuesAfterReload = await cardSetValues(benchAfterReload);

    check('刷新后仍是训练中', (await page.content()).includes('训练中'));
    check('刷新后动作还是 2 个', (await page.$$('[data-testid="exercise-card"]')).length === 2);
    check('刷新后杠铃卧推还是 4 组', valuesAfterReload.length === 4, valuesAfterReload.length);
    check(
      '刷新后每组的重量都还在（77.5 / 80 / 75 / 75）',
      JSON.stringify(valuesAfterReload) === JSON.stringify(['77.5', '80', '75', '75']),
      valuesAfterReload,
    );
    check(
      '刷新后总组数 6',
      (await textOf(page, 'total-sets')).includes('6'),
      await textOf(page, 'total-sets'),
    );

    if (process.env.E2E_SCREENSHOT) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: process.env.E2E_SCREENSHOT });
      console.log(`  · 截图已保存：${process.env.E2E_SCREENSHOT}`);
    }

    // 折叠起来的动作行 + 底部按钮，单独截一张（E2E_SCREENSHOT_BOTTOM=<路径>）
    if (process.env.E2E_SCREENSHOT_BOTTOM) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.screenshot({ path: process.env.E2E_SCREENSHOT_BOTTOM });
      console.log(`  · 截图已保存：${process.env.E2E_SCREENSHOT_BOTTOM}`);
    }

    section('[9] 完成训练');
    await clickWhenReady(await page.$('[data-testid="complete-workout"]'));
    check(
      '显示「训练已完成」',
      await waitUntil(async () => (await page.content()).includes('训练已完成')),
    );
    check('汇总里动作 2 个', (await page.content()).includes('2 个'));
    check('汇总里总组数 6 组', (await page.content()).includes('6 组'));

    section('[10] 再开一次训练，验证「上一次训练」提示');
    await page.goto(`${BASE_URL}/workout`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'start-workout', undefined, 15_000);

    // 回归：这一屏以前写死「今天还没有训练记录」，练完再进来还是那句话
    check(
      '今天已经练过，开始这一屏如实说明',
      (await textOf(page, 'workout-start-title')).includes('今天已经练过了'),
      await textOf(page, 'workout-start-title'),
    );
    check(
      '按钮变成「再练一次」',
      (await page.$eval('[data-testid="start-workout"]', (el) => el.textContent ?? '')).includes(
        '再练一次',
      ),
    );

    if (process.env.E2E_SCREENSHOT_START) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: process.env.E2E_SCREENSHOT_START });
      console.log(`  · 截图已保存：${process.env.E2E_SCREENSHOT_START}`);
    }

    await clickWhenReady(await page.$('[data-testid="start-workout"]'));
    await waitFor(page, 'open-exercise-picker');

    const secondBench = await addExercise(page, '胸', '杠铃卧推');
    const hint = await waitIn(secondBench, 'last-workout');
    const hintText = (await hint.evaluate((el) => el.textContent ?? '')).replace(/\s+/g, ' ');

    check('出现「上次训练」提示', hintText.includes('上次训练'), hintText);
    check(
      '提示里是上次的数据（77.5×10 / 80×8 / 75×10）',
      hintText.includes('77.5kg × 10') &&
        hintText.includes('80kg × 8') &&
        hintText.includes('75kg × 10'),
      hintText,
    );
    check(
      '提供「复制上次训练」按钮',
      (await secondBench.$('[data-testid="copy-last-workout"]')) !== null,
    );

    await clickWhenReady(await secondBench.$('[data-testid="copy-last-workout"]'));
    check('复制上次训练后得到 4 组', await waitUntil(async () => (await countSets(page)) === 4));

    section('[11] 页面没有 JS 报错');
    check('控制台无报错', pageErrors.length === 0, pageErrors.slice(0, 3));
  } finally {
    await cleanup();
  }

  finish();
}

main().catch((error) => {
  console.error('\n训练流程端到端测试执行异常：', error);
  process.exitCode = 1;
});
