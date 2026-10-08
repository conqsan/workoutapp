/** 训练页相关的元素操作，供 workout-flow / history-flow 共用 */

import {
  BASE_URL,
  clickWhenReady,
  fillInput,
  setInputValue,
  waitFor,
  waitIn,
  waitUntil,
} from './harness.mjs';

/** 本地时区的 'YYYY-MM-DD'（N 天前） */
export function daysAgoKey(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 在训练页完整创建一次训练（含指定日期、动作与各组），最后点完成 */
export async function createWorkout(page, { date, muscle, exercise, sets }) {
  await page.goto(`${BASE_URL}/workout`, { waitUntil: 'domcontentloaded' });
  await waitFor(page, 'start-workout', undefined, 15_000);

  if (date) {
    await fillInput(await waitFor(page, 'start-date'), date);
  }

  await clickWhenReady(await page.$('[data-testid="start-workout"]'));
  await waitFor(page, 'open-exercise-picker');

  const card = await addExercise(page, muscle, exercise);
  for (const [weight, reps] of sets) {
    await addSet(page, card, weight, reps);
  }

  await clickWhenReady(await page.$('[data-testid="complete-workout"]'));
  const done = await waitUntil(async () => (await page.content()).includes('训练已完成'));
  if (!done) throw new Error(`创建 ${date ?? '今天'} 的训练没有完成`);
}

export async function countSets(page) {
  return page.$$eval('[data-testid="set-chip"]', (nodes) => nodes.length);
}

/**
 * 每个组芯片上的摘要，例如 ["80kg×10", "80kg×8"]。
 * 组现在是横向芯片排列、只编辑选中的那一组，所以读芯片摘要而不是输入框的值。
 */
export async function cardSetSummaries(card) {
  return card.$$eval('[data-testid="set-chip"]', (nodes) =>
    nodes.map((node) => node.getAttribute('data-summary')),
  );
}

/** 当前正在编辑的那一组的输入框内容 */
export async function activeSetValues(card) {
  const weight = await card.$('[data-testid="set-weight"]');
  const reps = await card.$('[data-testid="set-reps"]');
  if (!weight || !reps) return null;
  return {
    weight: await weight.evaluate((el) => el.value),
    reps: await reps.evaluate((el) => el.value),
  };
}

export async function cardByName(page, name) {
  return waitIn(page, 'exercise-card', name);
}

/**
 * 展开指定动作。
 * 动作卡片是手风琴（一次只展开一个），要操作某个动作的组就得先把它展开。
 */
export async function openExercise(page, name) {
  const card = await cardByName(page, name);
  const toggle = await card.$('[data-testid="exercise-toggle"]');
  if (!toggle) throw new Error(`动作「${name}」没有展开按钮`);

  const alreadyOpen = await toggle.evaluate((el) => el.getAttribute('aria-expanded') === 'true');
  if (!alreadyOpen) {
    await clickWhenReady(toggle);
    await waitUntil(async () => {
      const refreshed = await cardByName(page, name);
      const refreshedToggle = await refreshed.$('[data-testid="exercise-toggle"]');
      return (
        (await refreshedToggle?.evaluate((el) => el.getAttribute('aria-expanded') === 'true')) ===
        true
      );
    });
  }

  return cardByName(page, name);
}

/** 添加一组并填好重量/次数（新组会自动选中，直接填当前编辑器即可） */
export async function addSet(page, card, weight, reps) {
  const before = (await card.$$('[data-testid="set-chip"]')).length;
  await clickWhenReady(await card.$('[data-testid="add-set"]'));

  const appeared = await waitUntil(
    async () => (await card.$$('[data-testid="set-chip"]')).length === before + 1,
  );
  if (!appeared) throw new Error(`点了「添加一组」但组数没增加（仍是 ${before} 组）`);

  const weightInput = await card.$('[data-testid="set-weight"]');
  const repsInput = await card.$('[data-testid="set-reps"]');
  if (!weightInput || !repsInput) throw new Error('拿不到这一组的输入框');

  await setInputValue(weightInput, weight);
  await setInputValue(repsInput, reps);
}

export async function addExercise(page, muscleName, exerciseName) {
  await clickWhenReady(await page.waitForSelector('[data-testid="open-exercise-picker"]'));
  await clickWhenReady(await waitIn(page, 'muscle-chip', muscleName));
  await clickWhenReady(await waitIn(page, 'exercise-option', exerciseName));

  // 新加的动作会自动展开；等它的「添加一组」出现再返回，后续操作才有落脚点
  const expanded = await waitUntil(
    async () => (await page.$$('[data-testid="add-set"]')).length === 1,
  );
  if (!expanded) throw new Error(`加入「${exerciseName}」之后没有自动展开`);

  return cardByName(page, exerciseName);
}

/** 快捷按钮在保存过程中是 disabled 的，必须等它可用再点 */
export async function clickQuickWeight(card, label) {
  const clicked = await waitUntil(() =>
    card.evaluate((cardEl, text) => {
      const button = [...cardEl.querySelectorAll('button')].find(
        (candidate) => candidate.textContent?.trim() === text,
      );
      if (!button || button.disabled) return false;
      button.click();
      return true;
    }, label),
  );
  if (!clicked) throw new Error(`快捷按钮 ${label} 一直点不了`);
}
