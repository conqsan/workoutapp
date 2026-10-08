/**
 * Phase 4 端到端验收：补剂记录的增 / 改 / 删 / 刷新后仍在。
 *
 * 前置：dev server 已经在跑（npm run dev）
 * 运行：npm run e2e
 */

import {
  BASE_URL,
  check,
  clickWhenReady,
  finish,
  launchBrowser,
  section,
  setInputValue,
  waitFor,
  waitIn,
  waitUntil,
} from './harness.mjs';

async function recordRows(page) {
  return page.$$('[data-testid="supplement-record"]');
}

async function rowTexts(page) {
  const rows = await recordRows(page);
  return Promise.all(
    rows.map((row) => row.evaluate((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())),
  );
}

/** 名称和用量是两个相邻元素，textContent 拼起来没有空格，比较时统一去掉空白 */
async function compactRowTexts(page) {
  return (await rowTexts(page)).map((text) => text.replace(/\s/g, ''));
}

/** 选补剂 → 填用量 → 选时间 → 添加 */
async function addRecord(page, supplementName, amount, consumptionTime) {
  const chip = await waitIn(page, 'supplement-chip', supplementName);
  await clickWhenReady(chip);

  const amountInput = await waitFor(page, 'record-amount-input');
  await setInputValue(amountInput, amount);

  if (consumptionTime) {
    const preset = await page.evaluateHandle((label) => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.find((button) => button.textContent?.trim() === label) ?? null;
    }, consumptionTime);
    const element = preset.asElement();
    if (!element) throw new Error(`找不到时间选项 ${consumptionTime}`);
    await clickWhenReady(element);
  }

  await clickWhenReady(await waitFor(page, 'add-record'));
}

async function main() {
  const { page, pageErrors, cleanup } = await launchBrowser();

  try {
    section('[1] 从首页进入补剂页');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'today-supplements', undefined, 15_000);

    check('首页有「今日补剂」区块', (await page.content()).includes('今日补剂'));
    const entry = await page.evaluateHandle(() => {
      const links = [...document.querySelectorAll('a')];
      return links.find((link) => link.getAttribute('href') === '/supplements') ?? null;
    });
    const entryElement = entry.asElement();
    check('首页提供了进入补剂页的入口', entryElement !== null);
    await clickWhenReady(entryElement);

    await waitFor(page, 'add-record');
    check('进入 /supplements 页面', page.url().endsWith('/supplements'), page.url());
    check('页面标题是「补剂」', (await page.content()).includes('补剂'));

    section('[2] 记录肌酸 5g（训练后）');
    const chipNames = await page.$$eval('[data-testid="supplement-chip"]', (nodes) =>
      nodes.map((node) => node.getAttribute('data-name')),
    );
    check(
      '默认三个补剂都在（增肌粉 / 肌酸 / 蛋白粉）',
      ['增肌粉', '肌酸', '蛋白粉'].every((name) => chipNames.includes(name)),
      chipNames,
    );

    await addRecord(page, '肌酸', 5, '训练后');
    check(
      '出现 1 条记录',
      await waitUntil(async () => (await recordRows(page)).length === 1),
      await recordRows(page),
    );
    check(
      '记录内容是「肌酸 5g · 训练后」',
      (await compactRowTexts(page))[0]?.includes('肌酸5g·训练后'),
      await rowTexts(page),
    );

    section('[3] 再记录蛋白粉 30g 和增肌粉 100g');
    await addRecord(page, '蛋白粉', 30, '训练后');
    await addRecord(page, '增肌粉', 100, '早餐');

    check(
      '共 3 条记录',
      await waitUntil(async () => (await recordRows(page)).length === 3),
      await recordRows(page),
    );
    const texts = await compactRowTexts(page);
    check(
      '蛋白粉 30g 在列表里',
      texts.some((text) => text.includes('蛋白粉30g')),
      texts,
    );
    check(
      '增肌粉 100g 在列表里',
      texts.some((text) => text.includes('增肌粉100g')),
      texts,
    );

    if (process.env.E2E_SCREENSHOT_SUPPLEMENTS) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: process.env.E2E_SCREENSHOT_SUPPLEMENTS });
      console.log(`  · 截图已保存：${process.env.E2E_SCREENSHOT_SUPPLEMENTS}`);
    }

    section('[4] 刷新页面 —— 验收：数据必须还在');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitFor(page, 'add-record', undefined, 15_000);
    check(
      '刷新后 3 条记录都还在',
      await waitUntil(async () => (await recordRows(page)).length === 3),
      await recordRows(page),
    );
    check(
      '刷新后内容也没变',
      (await compactRowTexts(page)).some((text) => text.includes('肌酸5g·训练后')),
      await rowTexts(page),
    );

    section('[5] 修改记录：肌酸 5g → 8g');
    const firstRow = (await recordRows(page))[0];
    const editButton = await firstRow.$('[data-testid="edit-record"]');
    await clickWhenReady(editButton);

    const editAmount = await waitIn(firstRow, 'record-amount');
    await setInputValue(editAmount, 8);
    await clickWhenReady(await firstRow.$('[data-testid="save-record"]'));

    check(
      '用量改成 8g',
      await waitUntil(async () =>
        (await compactRowTexts(page)).some((text) => text.includes('肌酸8g')),
      ),
      await rowTexts(page),
    );

    section('[6] 删除记录：蛋白粉');
    const rowsBefore = await compactRowTexts(page);
    const targetIndex = rowsBefore.findIndex((text) => text.includes('蛋白粉'));
    check('找到蛋白粉那条', targetIndex >= 0, rowsBefore);

    const targetRow = (await recordRows(page))[targetIndex];
    await clickWhenReady(await targetRow.$('[data-testid="remove-record"]'));
    await clickWhenReady(await targetRow.$('[data-testid="confirm-remove-record"]'));

    check(
      '删完只剩 2 条',
      await waitUntil(async () => (await recordRows(page)).length === 2),
      await recordRows(page),
    );
    check(
      '列表里不再有蛋白粉',
      !(await compactRowTexts(page)).some((text) => text.includes('蛋白粉')),
      await rowTexts(page),
    );

    section('[7] 首页能看到今天的补剂');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'today-supplements', undefined, 15_000);
    const homeText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('首页显示肌酸', homeText.includes('肌酸'), homeText.slice(0, 200));
    check('首页不再显示蛋白粉', !homeText.includes('蛋白粉'), homeText.slice(0, 200));

    section('[8] 页面没有 JS 报错');
    check('控制台无报错', pageErrors.length === 0, pageErrors.slice(0, 3));
  } finally {
    await cleanup();
  }

  finish();
}

main().catch((error) => {
  console.error('\n补剂流程端到端测试执行异常：', error);
  process.exitCode = 1;
});
