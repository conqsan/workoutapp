/**
 * 递减组（drop set）端到端验收。
 *
 * 「飞鸟递减组」这个动作一组要填 3 段的重量与次数（前 2 段必填、第 3 段可选）。
 * 这一条流程验证：录入、必填校验、训练总量按每段自己的次数累加、完成训练，
 * 以及历史详情里同样能改某一段。
 *
 * 前置：dev server 已经在跑（npm run dev）
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
  setInputValue,
  textOf,
  waitFor,
  waitUntil,
} from './harness.mjs';
import { addExercise } from './workout-helpers.mjs';

async function chipSummary(card) {
  const chip = await card.$('[data-testid="set-chip"]');
  if (!chip) return null;
  return chip.evaluate((el) => el.getAttribute('data-summary'));
}

async function main() {
  const { page, pageErrors, cleanup } = await launchBrowser();

  try {
    section('[1] 飞鸟递减组有 3 个重量框');
    await page.goto(`${BASE_URL}/workout`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'start-workout', undefined, 15_000);
    await clickWhenReady(await page.$('[data-testid="start-workout"]'));
    await waitFor(page, 'open-exercise-picker');

    const card = await addExercise(page, '肩', '飞鸟递减组');
    await clickWhenReady(await card.$('[data-testid="add-set"]'));
    await waitFor(page, 'set-weight', undefined, 10_000);

    const weightInputs = await card.$$(
      '[data-testid="set-weight"], [data-testid="set-weight-2"], [data-testid="set-weight-3"]',
    );
    check('出现了 3 个重量框', weightInputs.length === 3, weightInputs.length);
    const repsInputs = await card.$$(
      '[data-testid="set-reps"], [data-testid="set-reps-2"], [data-testid="set-reps-3"]',
    );
    check('每一段各有一个次数框', repsInputs.length === 3, repsInputs.length);
    check(
      '页面上写明了前两段必填',
      (await card.evaluate((el) => el.textContent ?? '')).includes('前 2 段必填'),
      await card.evaluate((el) => el.textContent ?? ''),
    );
    check(
      '普通动作仍然是 1 个重量框（没被递减组影响）',
      (await page.$$eval('[data-testid="set-weight"]', (nodes) => nodes.length)) === 1,
    );

    section('[2] 必填校验：只填第一段不让完成训练');
    await setInputValue(await waitFor(page, 'set-weight'), 20);
    await clickWhenReady(await page.$('[data-testid="complete-workout"]'));

    check(
      '提示「还差第 2 段的重量」',
      await waitUntil(async () =>
        (await page.evaluate(() => document.body.innerText)).includes('还差第 2 段'),
      ),
      await page.evaluate(() => document.body.innerText.slice(0, 200)),
    );
    check('训练没有完成（还在训练中）', (await page.content()).includes('训练中'));

    section('[3] 填满三段：20 / 15 / 10 × 10');
    await setInputValue(await waitFor(page, 'set-weight-2'), 15);

    section('[2.5] 只填了重量、没填次数 → 也拦下');
    check(
      '提示「第 2 段次数必填」',
      await waitUntil(async () =>
        (await page.evaluate(() => document.body.innerText)).includes('第 2 段次数必填'),
      ),
      await page.evaluate(() => document.body.innerText.slice(0, 200)),
    );

    section('[3] 每段各自填次数：20×10 / 15×8 / 10×6');
    await setInputValue(await waitFor(page, 'set-reps-2'), 8);
    check(
      '两段时芯片是 20kg×10 / 15kg×8',
      await waitUntil(async () => (await chipSummary(card)) === '20kg×10 / 15kg×8'),
      await chipSummary(card),
    );
    check(
      '总量只算两段 = 20×10 + 15×8 = 320 kg',
      normalizeNumberText(await textOf(page, 'total-volume')).includes('320kg'),
      await textOf(page, 'total-volume'),
    );

    await setInputValue(await waitFor(page, 'set-weight-3'), 10);
    await setInputValue(await waitFor(page, 'set-reps-3'), 6);
    check(
      '三段时芯片是 20kg×10 / 15kg×8 / 10kg×6',
      await waitUntil(async () => (await chipSummary(card)) === '20kg×10 / 15kg×8 / 10kg×6'),
      await chipSummary(card),
    );
    check(
      '总量 20×10 + 15×8 + 10×6 = 380 kg',
      normalizeNumberText(await textOf(page, 'total-volume')).includes('380kg'),
      await textOf(page, 'total-volume'),
    );

    if (process.env.E2E_SCREENSHOT_DROP_SET) {
      await page.screenshot({ path: process.env.E2E_SCREENSHOT_DROP_SET, fullPage: true });
    }

    section('[4] 第 3 段可选：整段清空后退回两段');
    await setInputValue(await waitFor(page, 'set-weight-3'), '');
    check(
      '清空第 3 段后芯片回到 20kg×10 / 15kg×8',
      await waitUntil(async () => (await chipSummary(card)) === '20kg×10 / 15kg×8'),
      await chipSummary(card),
    );
    check(
      '总量回到 320 kg，没有报错',
      normalizeNumberText(await textOf(page, 'total-volume')).includes('320kg'),
      await textOf(page, 'total-volume'),
    );

    section('[5] 完成训练并查看历史详情');
    await setInputValue(await waitFor(page, 'set-weight-3'), 10);
    await setInputValue(await waitFor(page, 'set-reps-3'), 6);
    await clickWhenReady(await page.$('[data-testid="complete-workout"]'));
    check('训练完成', await waitUntil(async () => (await page.content()).includes('训练已完成')));
    check(
      '已完成页显示三段各自的次数',
      (await page.evaluate(() => document.body.innerText)).includes(
        '20kg × 10 → 15kg × 8 → 10kg × 6',
      ),
      await page.evaluate(() => document.body.innerText.slice(0, 300)),
    );

    await page.goto(`${BASE_URL}/history`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'history-item', undefined, 15_000);
    await clickWhenReady(await page.$('[data-testid="history-item"]'));
    await waitFor(page, 'history-exercise', undefined, 10_000);
    const detailText = await page.evaluate(() => document.body.innerText);
    check(
      '历史详情显示 20kg × 10 → 15kg × 8 → 10kg × 6',
      detailText.includes('20kg × 10 → 15kg × 8 → 10kg × 6'),
      detailText.slice(0, 300),
    );
    check('训练总量 380 kg', detailText.includes('380 kg'), detailText.slice(0, 300));

    section('[6] 历史里改第 2 段：15kg×8 → 12kg×10');
    const setRow = await waitFor(page, 'history-set');
    await clickWhenReady(await setRow.$('[data-testid="edit-set"]'));
    await fillInput(await waitFor(page, 'edit-set-weight-2'), '12');
    await fillInput(await waitFor(page, 'edit-set-reps-2'), '10');
    await clickWhenReady(await waitFor(page, 'save-set'));

    check(
      '详情更新为 20kg × 10 → 12kg × 10 → 10kg × 6',
      await waitUntil(async () =>
        (await page.evaluate(() => document.body.innerText)).includes(
          '20kg × 10 → 12kg × 10 → 10kg × 6',
        ),
      ),
      await page.evaluate(() => document.body.innerText.slice(0, 300)),
    );
    check(
      '总量跟着重算成 20×10 + 12×10 + 10×6 = 380 kg',
      await waitUntil(async () =>
        (await page.evaluate(() => document.body.innerText)).includes('380 kg'),
      ),
      await page.evaluate(() => document.body.innerText.slice(0, 300)),
    );

    section('[7] 页面没有 JS 报错');
    check('控制台无报错', pageErrors.length === 0, pageErrors.slice(0, 3));
  } finally {
    await cleanup();
  }

  finish();
}

main().catch((error) => {
  console.error('\n递减组端到端测试执行异常：', error);
  process.exitCode = 1;
});
