/**
 * 组间休息计时器的端到端验收。
 *
 * 前置：dev server 已经在跑（npm run dev）。
 * 运行：node e2e/rest-timer-flow.mjs
 *
 * 覆盖：开始 / 暂停 / 继续 / +15s / 自然到点 / 再来一轮 /
 * 换动作后仍在计时 / 刷新后仍在计时。
 */

import {
  BASE_URL,
  check,
  finish,
  launchBrowser,
  section,
  setInputValue,
  textOf,
  waitFor,
  waitUntil,
} from './harness.mjs';
import { addExercise, addSet } from './workout-helpers.mjs';

/** "00:05" -> 5 */
function clockSeconds(text) {
  const match = /(\d+):(\d{2})/.exec(text ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

const waitClock = (page, predicate, timeout = 12_000) =>
  waitUntil(async () => {
    const text = await textOf(page, 'rest-clock');
    const seconds = clockSeconds(text);
    return seconds !== null && predicate(seconds);
  }, timeout);

async function main() {
  const { page, pageErrors, cleanup } = await launchBrowser();

  try {
    await page.goto(`${BASE_URL}/workout`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'start-workout', undefined, 15_000);
    await page.click('[data-testid="start-workout"]');
    await waitFor(page, 'open-exercise-picker');

    const card = await addExercise(page, '胸', '杠铃卧推');
    await addSet(page, card, 60, 8);

    section('[1] 休息框改成了计时器控件');
    check('有计时器组件', (await card.$('[data-testid="rest-timer"]')) !== null);
    check(
      '默认是空闲状态',
      (await card.$eval('[data-testid="rest-timer"]', (el) => el.dataset.state)) === 'idle',
    );
    check('有「开始」按钮', (await card.$('[data-testid="rest-start"]')) !== null);

    section('[2] 设定 6 秒休息时间');
    await setInputValue(await card.$('[data-testid="rest-input"]'), 6);
    check(
      '输入框保留 6',
      (await card.$eval('[data-testid="rest-input"]', (el) => el.value)) === '6',
      await card.$eval('[data-testid="rest-input"]', (el) => el.value),
    );

    section('[3] 手动开始倒计时');
    await page.click('[data-testid="rest-start"]');
    check(
      '进入计时状态',
      await waitUntil(
        async () =>
          (await card.$eval('[data-testid="rest-timer"]', (el) => el.dataset.state)) === 'running',
      ),
    );
    check(
      '倒计时从 6 秒开始',
      await waitClock(page, (s) => s === 6 || s === 5),
      await textOf(page, 'rest-clock'),
    );
    check('页面顶部出现常驻计时条', (await page.$('[data-testid="rest-timer-bar"]')) !== null);

    section('[4] 暂停后时间不再走');
    await page.click('[data-testid="rest-pause"]');
    await waitUntil(
      async () =>
        (await card.$eval('[data-testid="rest-timer"]', (el) => el.dataset.state)) === 'paused',
    );
    const frozen = clockSeconds(await textOf(page, 'rest-clock'));
    await new Promise((resolve) => setTimeout(resolve, 1500));
    check(
      '暂停 1.5 秒后读数不变',
      clockSeconds(await textOf(page, 'rest-clock')) === frozen,
      `${frozen} -> ${await textOf(page, 'rest-clock')}`,
    );

    section('[5] 继续 + 加时');
    await page.click('[data-testid="rest-pause"]');
    await waitUntil(
      async () =>
        (await card.$eval('[data-testid="rest-timer"]', (el) => el.dataset.state)) === 'running',
    );
    const beforeAdd = frozen;
    await page.click('[data-testid="rest-add"]');
    check(
      '+15s 之后剩余时间变长',
      await waitClock(page, (s) => s >= beforeAdd + 10),
      `${beforeAdd} -> ${await textOf(page, 'rest-clock')}`,
    );

    section('[6] 走到 0：显示「休息结束」');
    const totalLeft = clockSeconds(await textOf(page, 'rest-clock')) ?? 20;
    check(
      '自然到点后进入结束态',
      await waitUntil(
        async () => (await card.$('[data-testid="rest-done"]')) !== null,
        (totalLeft + 8) * 1000,
      ),
      totalLeft,
    );

    section('[7] 换到另一个动作，计时条还在');
    await page.click('[data-testid="rest-restart"]');
    await waitUntil(async () => (await page.$('[data-testid="rest-timer-bar"]')) !== null);
    const other = await addExercise(page, '肩', '哑铃侧平举');
    check('第二个动作已加入', other !== null);
    check('换动作后顶部仍有计时条', (await page.$('[data-testid="rest-timer-bar"]')) !== null);
    check(
      '计时条显示的是上一个动作的名字',
      (await textOf(page, 'rest-timer-bar')).includes('杠铃卧推'),
      await textOf(page, 'rest-timer-bar'),
    );

    section('[8] 刷新页面后计时继续');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitFor(page, 'rest-timer-bar', undefined, 15_000);
    check('刷新后计时条还在', (await page.$('[data-testid="rest-timer-bar"]')) !== null);
    check(
      '刷新后读数仍然有效',
      await waitClock(page, (s) => s > 0),
      await textOf(page, 'rest-clock'),
    );

    section('[9] 关闭计时');
    await page.click('[data-testid="rest-timer-bar-close"]');
    check(
      '关闭后计时条消失',
      await waitUntil(async () => (await page.$('[data-testid="rest-timer-bar"]')) === null),
    );

    section('[10] 页面没有 JS 报错');
    check('控制台无报错', pageErrors.length === 0, pageErrors.slice(0, 3));
  } finally {
    await cleanup();
  }

  finish();
}

main().catch((error) => {
  console.error('\n休息计时器端到端测试执行异常：', error);
  process.exitCode = 1;
});
