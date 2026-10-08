/**
 * Phase 5 端到端验收：历史列表与详情。
 *
 * 前置：dev server 已经在跑（npm run dev）
 * 运行：npm run e2e
 *
 * 验收要求造三天数据（10/1 胸、10/3 背、10/6 腿），这里通过训练页的
 * 「训练日期」补记功能真实创建，然后检查排序、详情、以及补剂不会串日期。
 */

import {
  BASE_URL,
  check,
  clickWhenReady,
  fillInput,
  finish,
  launchBrowser,
  normalizeNumberText,
  section,
  waitFor,
  waitUntil,
} from './harness.mjs';
import { addExercise, addSet } from './workout-helpers.mjs';
import { createWorkout } from './workout-helpers.mjs';

async function historyItems(page) {
  return page.$$('[data-testid="history-item"]');
}

async function historyDates(page) {
  return page.$$eval('[data-testid="history-item"]', (nodes) =>
    nodes.map((node) => node.getAttribute('data-date')),
  );
}

async function itemByDate(page, date) {
  return page.$(`[data-testid="history-item"][data-date="${date}"]`);
}

async function main() {
  const { page, pageErrors, cleanup } = await launchBrowser();

  try {
    section('[1] 补记三天训练（10/1 胸、10/3 背、10/6 腿）');
    await createWorkout(page, {
      date: '2026-10-01',
      muscle: '胸',
      exercise: '杠铃卧推',
      sets: [
        [80, 10],
        [80, 8],
      ],
    });
    check('10月1日 胸 已记录', true);

    await createWorkout(page, {
      date: '2026-10-03',
      muscle: '背',
      exercise: '杠铃划船',
      sets: [[60, 10]],
    });
    check('10月3日 背 已记录', true);

    await createWorkout(page, {
      date: '2026-10-06',
      muscle: '腿',
      exercise: '深蹲',
      sets: [[100, 5]],
    });
    check('10月6日 腿 已记录', true);

    section('[2] 给 10/6 记一条补剂（用来验证补剂不会串日期）');
    await page.goto(`${BASE_URL}/supplements`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'add-record', undefined, 15_000);
    await fillInput(await waitFor(page, 'record-date'), '2026-10-06');
    await clickWhenReady(
      await page.waitForSelector('[data-testid="supplement-chip"][data-name="肌酸"]'),
    );
    await fillInput(await waitFor(page, 'record-amount-input'), '5');
    await clickWhenReady(await waitFor(page, 'add-record'));
    check(
      '10月6日 记了一条肌酸 5g',
      await waitUntil(
        async () => (await page.$$('[data-testid="supplement-record"]')).length === 1,
      ),
    );

    section('[3] 历史列表：排序与摘要');
    await page.goto(`${BASE_URL}/history`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'history-item', undefined, 15_000);

    const dates = await historyDates(page);
    check('列出 3 次训练', dates.length === 3, dates);
    check(
      '按日期倒序：10/6 → 10/3 → 10/1',
      JSON.stringify(dates) === JSON.stringify(['2026-10-06', '2026-10-03', '2026-10-01']),
      dates,
    );

    const listText = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="history-item"]')].map((node) =>
        (node.textContent ?? '').replace(/\s+/g, ''),
      ),
    );

    check(
      '10/1 那条显示「胸」和 2 组、训练总量 1440kg（80×10 + 80×8）',
      listText[2]?.includes('胸') &&
        listText[2]?.includes('1个动作') &&
        listText[2]?.includes('2组') &&
        listText[2]?.includes('1,440kg'),
      listText[2],
    );
    check(
      '10/3 那条显示「背」和 1 组、600kg',
      listText[1]?.includes('背') && listText[1]?.includes('600kg'),
      listText[1],
    );
    check(
      '10/6 那条显示「腿」和 500kg（100×5）',
      listText[0]?.includes('腿') && listText[0]?.includes('500kg'),
      listText[0],
    );

    if (process.env.E2E_SCREENSHOT_HISTORY_LIST) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: process.env.E2E_SCREENSHOT_HISTORY_LIST });
      console.log(`  · 截图已保存：${process.env.E2E_SCREENSHOT_HISTORY_LIST}`);
    }

    section('[4] 进入 10/1 详情（验收：数据不能混）');
    await clickWhenReady(await itemByDate(page, '2026-10-01'));
    await page.waitForFunction(() => location.pathname.startsWith('/history/'), { timeout: 8000 });
    await waitFor(page, 'history-exercise', undefined, 10_000);

    check('跳到详情页', page.url().includes('/history/'), page.url());
    check('标题是「训练详情」', (await page.content()).includes('训练详情'));

    const detailText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    check('显示日期 2026年10月1日', detailText.includes('2026年10月1日'), detailText.slice(0, 120));
    check('显示部位「胸」', detailText.includes('胸'));
    check('显示动作「杠铃卧推」', detailText.includes('杠铃卧推'));
    check(
      '两组数据是 80kg × 10 和 80kg × 8',
      detailText.includes('80kg × 10') && detailText.includes('80kg × 8'),
      detailText,
    );
    check('显示训练总量 1,440 kg', detailText.includes('1,440 kg'), detailText);
    check('没有混进背或腿的动作', !detailText.includes('杠铃划船') && !detailText.includes('深蹲'));

    const exerciseNames = await page.$$eval('[data-testid="history-exercise"]', (nodes) =>
      nodes.map((node) => node.getAttribute('data-name')),
    );
    check('详情里只有 1 个动作', exerciseNames.length === 1, exerciseNames);

    const supplementText = await page.$eval('[data-testid="history-supplements"]', (node) =>
      (node.textContent ?? '').replace(/\s+/g, ''),
    );
    check('10/1 当天没有补剂记录', supplementText.includes('这一天没有补剂记录'), supplementText);

    if (process.env.E2E_SCREENSHOT_HISTORY_DETAIL) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: process.env.E2E_SCREENSHOT_HISTORY_DETAIL });
      console.log(`  · 截图已保存：${process.env.E2E_SCREENSHOT_HISTORY_DETAIL}`);
    }

    section('[5] 进入 10/6 详情（补剂应该对应这一天）');
    await page.goto(`${BASE_URL}/history`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'history-item', undefined, 15_000);
    await clickWhenReady(await itemByDate(page, '2026-10-06'));
    await waitFor(page, 'history-exercise', undefined, 10_000);

    const sixthText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    check('显示日期 2026年10月6日', sixthText.includes('2026年10月6日'), sixthText.slice(0, 120));
    check('显示部位「腿」和动作「深蹲」', sixthText.includes('腿') && sixthText.includes('深蹲'));
    check('显示 100kg × 5', sixthText.includes('100kg × 5'), sixthText);
    check('显示训练总量 500 kg', sixthText.includes('500 kg'), sixthText);
    check('当天补剂里有肌酸 5g', /肌酸/.test(sixthText) && sixthText.includes('5g'), sixthText);
    check('没有混进胸的动作', !sixthText.includes('杠铃卧推'));

    section('[6] 底部导航仍然可用');
    await clickWhenReady(await page.waitForSelector('a[href="/history"]'));
    await waitFor(page, 'history-item', undefined, 10_000);
    check('从详情返回历史列表', page.url().endsWith('/history'), page.url());
    check(
      '列表总数被 normalize 后仍是 3',
      normalizeNumberText(await page.evaluate(() => document.body.innerText)).includes('共3次训练'),
    );

    section('[7] 页面没有 JS 报错');
    check('控制台无报错', pageErrors.length === 0, pageErrors.slice(0, 3));
  } finally {
    await cleanup();
  }

  finish();
}

main().catch((error) => {
  console.error('\n历史记录端到端测试执行异常：', error);
  process.exitCode = 1;
});
