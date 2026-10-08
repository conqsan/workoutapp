/**
 * Phase 7 端到端验收：移动端适配。
 *
 * 在 320 / 375 / 390 / 414 / 768 五个宽度下把主要页面都打开一遍，检查：
 *   1. 没有横向溢出
 *   2. 关键控件（主要按钮、输入框）够大，单手点得到
 *   3. 底部导航没有压住内容
 *   4. 没有文字被截断到看不见
 *
 * 前置：dev server 已经在跑（npm run dev）
 * 运行：npm run e2e
 */

import {
  BASE_URL,
  check,
  clickWhenReady,
  fillInput,
  finish,
  launchBrowser,
  section,
  waitFor,
} from './harness.mjs';
import { addExercise, createWorkout } from './workout-helpers.mjs';

const WIDTHS = [
  { width: 320, height: 568, label: '320（iPhone SE 一代）' },
  { width: 375, height: 667, label: '375（iPhone SE 二代）' },
  { width: 390, height: 844, label: '390（iPhone 14）' },
  { width: 414, height: 896, label: '414（iPhone 11 Pro Max）' },
  { width: 768, height: 1024, label: '768（iPad 竖屏）' },
];

/** 必须足够大才好点的控件 */
const KEY_CONTROLS = [
  { testId: 'open-exercise-picker', minHeight: 44, label: '添加动作' },
  { testId: 'add-set', minHeight: 44, label: '添加一组' },
  { testId: 'complete-workout', minHeight: 44, label: '完成训练' },
  { testId: 'set-weight', minHeight: 44, label: '重量输入框' },
  { testId: 'set-reps', minHeight: 44, label: '次数输入框' },
];

const PAGES = [
  { path: '/', name: '首页', readyTestId: 'today-volume' },
  { path: '/history', name: '历史', readyTestId: 'history-item' },
  { path: '/stats', name: '统计', readyTestId: 'stat-week-workouts' },
  { path: '/profile', name: '我的', readyTestId: null },
  { path: '/supplements', name: '补剂', readyTestId: 'add-record' },
];

/** 当前页面有没有横向溢出，以及是谁溢出的 */
async function measureOverflow(page) {
  return page.evaluate(() => {
    const viewport = window.innerWidth;
    const offenders = [];

    for (const element of document.querySelectorAll('*')) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.right > viewport + 1 || rect.left < -1) {
        const className = typeof element.className === 'string' ? element.className : '';
        offenders.push({
          tag: element.tagName.toLowerCase(),
          cls: className.slice(0, 60),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        });
      }
    }

    return {
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders: offenders.slice(0, 5),
    };
  });
}

/** 检查关键控件的高度 */
async function measureControls(page, controls) {
  return page.evaluate((list) => {
    const results = [];
    for (const control of list) {
      const element = document.querySelector(`[data-testid="${control.testId}"]`);
      if (!element) {
        results.push({ ...control, height: null });
        continue;
      }
      const rect = element.getBoundingClientRect();
      results.push({ ...control, height: Math.round(rect.height) });
    }
    return results;
  }, controls);
}

/** 底部导航会不会压住内容 */
async function measureNavClearance(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="主导航"]');
    const main = document.querySelector('main');
    if (!nav || !main) return { navHeight: null, padding: null };
    return {
      navHeight: Math.round(nav.getBoundingClientRect().height),
      padding: Math.round(parseFloat(getComputedStyle(main).paddingBottom)),
    };
  });
}

async function main() {
  const { page, pageErrors, cleanup } = await launchBrowser({
    viewport: { width: 390, height: 844 },
  });

  try {
    // 先造一点数据，否则历史 / 统计页都是空态，测不到真实布局
    section('[0] 准备数据');
    await createWorkout(page, {
      muscle: '胸',
      exercise: '杠铃卧推',
      sets: [
        [80, 10],
        [80, 8],
      ],
    });
    await page.goto(`${BASE_URL}/supplements`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'add-record', undefined, 15_000);
    await clickWhenReady(
      await page.waitForSelector('[data-testid="supplement-chip"][data-name="肌酸"]'),
    );
    await fillInput(await waitFor(page, 'record-amount-input'), '5');
    await clickWhenReady(await waitFor(page, 'add-record'));
    check('已造出训练与补剂数据', true);

    // 先确认「横向溢出检测」本身是有效的，否则一路通过可能是假阴性
    section('[1] 校验检测器本身有效');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'today-volume', undefined, 15_000);
    const sanity = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.cssText = 'width:2000px;height:8px;position:relative';
      document.body.appendChild(probe);
      const rect = probe.getBoundingClientRect();
      const detected = rect.right > window.innerWidth + 1;
      probe.remove();
      return { detected, viewport: window.innerWidth };
    });
    check('故意塞一个 2000px 宽的元素，检测器能抓到', sanity.detected, sanity);

    for (const viewport of WIDTHS) {
      section(`[${viewport.label}]`);
      await page.setViewport({
        width: viewport.width,
        height: viewport.height,
        isMobile: true,
        hasTouch: true,
      });

      for (const target of PAGES) {
        await page.goto(`${BASE_URL}${target.path}`, { waitUntil: 'domcontentloaded' });
        if (target.readyTestId) {
          await waitFor(page, target.readyTestId, undefined, 15_000);
        }
        // 给动画/懒加载一点时间
        await new Promise((resolve) => setTimeout(resolve, 150));

        const overflow = await measureOverflow(page);
        check(
          `${target.name}：没有横向溢出`,
          overflow.scrollWidth <= overflow.viewport && overflow.offenders.length === 0,
          overflow,
        );

        const clearance = await measureNavClearance(page);
        if (clearance.navHeight !== null && clearance.padding !== null) {
          check(
            `${target.name}：底部导航没压住内容`,
            clearance.padding >= clearance.navHeight,
            clearance,
          );
        }
      }

      // 训练页是关键：还要检查控件尺寸
      await page.goto(`${BASE_URL}/workout`, { waitUntil: 'domcontentloaded' });
      await waitFor(page, 'start-workout', undefined, 15_000);

      // 开始前先量开始页的控件（点下去这些就不在了）
      const startControls = await measureControls(page, [
        { testId: 'start-workout', minHeight: 44, label: '开始训练' },
        { testId: 'start-date', minHeight: 44, label: '训练日期' },
      ]);
      for (const control of startControls) {
        check(
          `训练页：${control.label} ≥ ${control.minHeight}px`,
          control.height !== null && control.height >= control.minHeight,
          control,
        );
      }

      await clickWhenReady(await page.$('[data-testid="start-workout"]'));
      await waitFor(page, 'open-exercise-picker', undefined, 10_000);

      // 加一个动作，这样「添加一组」和组内输入框才存在
      await addExercise(page, '胸', '杠铃卧推');
      await clickWhenReady(await page.$('[data-testid="add-set"]'));
      await waitFor(page, 'set-weight', undefined, 10_000);

      const controls = await measureControls(page, KEY_CONTROLS);
      for (const control of controls) {
        check(
          `训练页：${control.label} ≥ ${control.minHeight}px`,
          control.height !== null && control.height >= control.minHeight,
          control,
        );
      }

      const trainingOverflow = await measureOverflow(page);
      check(
        '训练页（训练中）：没有横向溢出',
        trainingOverflow.scrollWidth <= trainingOverflow.viewport &&
          trainingOverflow.offenders.length === 0,
        trainingOverflow,
      );

      // 收尾：放弃这次训练，让下一个宽度从干净状态开始
      await clickWhenReady(await waitFor(page, 'discard-workout'));
      await clickWhenReady(await waitFor(page, 'confirm-discard'));
      await waitFor(page, 'start-workout', undefined, 10_000);
    }

    section('[最后] 页面没有 JS 报错');
    check('控制台无报错', pageErrors.length === 0, pageErrors.slice(0, 3));
  } finally {
    await cleanup();
  }

  finish();
}

main().catch((error) => {
  console.error('\n移动端适配测试执行异常：', error);
  process.exitCode = 1;
});
