/**
 * Phase 8 端到端验收：PWA + 离线 + GitHub Pages 部署。
 *
 * 这条流程和别的不同：它**自己**用 GitHub Pages 的路径构建、自己起 `vite preview`，
 * 然后在这个「生产环境」上验证。原因有两个：
 *   1. service worker 只生产构建才注册（开发模式注册会把 HMR 缓存坏）
 *   2. 顺便验证子路径部署（/workoutapp/）真的能用，本地就能发现问题
 *
 * 不需要先跑 npm run dev。
 * 运行：npm run e2e:pwa
 */

import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PREVIEW_PORT = 4173;

/**
 * 必须用动态 import：harness 在模块加载时读 E2E_BASE_URL，
 * 所以要先把它设成 preview 的地址，再加载 harness。
 */
process.env.E2E_BASE_URL = `http://localhost:${PREVIEW_PORT}/workoutapp`;

const { check, finish, launchBrowser, section, waitFor, waitForHttp, runCommand } =
  await import('./harness.mjs');
const { createWorkout } = await import('./workout-helpers.mjs');

// 故意带尾斜杠：GitHub Actions 里 VITE_BASE_PATH 就是 /<仓库名>/
const BASE_PATH = '/workoutapp/';
const APP_URL = `http://localhost:${PREVIEW_PORT}${BASE_PATH}`;

/**
 * 杀掉整棵进程树。
 * Windows 上 npm 只是个壳，真正的 vite 是子进程 —— 只 kill 壳的话 preview 会
 * 一直活着占着 dist，下一次构建就会因为文件被占用而失败。
 */
function killTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function main() {
  section('[0] 用 GitHub Pages 的路径构建');
  await runCommand('npm', ['run', 'build'], {
    env: { ...process.env, VITE_BASE_PATH: BASE_PATH },
  });
  check('构建完成（VITE_BASE_PATH=/workoutapp/）', true);

  const dist = path.resolve(process.cwd(), 'dist');
  const indexHtml = await readFile(path.join(dist, 'index.html'), 'utf8');
  const notFoundHtml = await readFile(path.join(dist, '404.html'), 'utf8');

  check('index.html 里的资源都带上了部署前缀', indexHtml.includes('/workoutapp/assets/'));
  check(
    '生成了 404.html，内容与 index.html 一致（深链接刷新由它兜底）',
    indexHtml === notFoundHtml,
  );

  section('[1] 启动生产预览（等价于 GitHub Pages 上的静态托管）');
  const preview = spawn(
    'npm',
    ['run', 'preview', '--', '--port', String(PREVIEW_PORT), '--strictPort'],
    {
      cwd: process.cwd(),
      env: { ...process.env, VITE_BASE_PATH: BASE_PATH },
      stdio: 'ignore',
      shell: process.platform === 'win32',
    },
  );

  const { page, jsErrors, cleanup } = await launchBrowser({
    viewport: { width: 390, height: 844 },
  });

  try {
    await waitForHttp(APP_URL, 60_000);
    check(`预览服务已就绪：${APP_URL}`, true);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'today-volume', undefined, 20_000);
    check('子路径下 App 能正常打开', true);

    section('[2] PWA 清单与图标');
    const manifestHref = await page.$eval('link[rel="manifest"]', (el) => el.getAttribute('href'));
    check(
      '页面声明了 manifest',
      manifestHref?.includes('manifest.webmanifest') === true,
      manifestHref,
    );

    const manifest = await page.evaluate(async (href) => {
      const response = await fetch(href);
      return response.ok ? response.json() : null;
    }, manifestHref);

    check('manifest 可访问', manifest !== null);
    check('display 是 standalone', manifest?.display === 'standalone', manifest?.display);
    check('lang 是 zh-CN', manifest?.lang === 'zh-CN', manifest?.lang);
    check(
      '包含 192 / 512 图标',
      (manifest?.icons ?? []).some((icon) => icon.sizes === '192x192') &&
        (manifest?.icons ?? []).some((icon) => icon.sizes === '512x512'),
      manifest?.icons,
    );

    const iconStatuses = await page.evaluate(async (icons) => {
      const results = [];
      for (const icon of icons) {
        const response = await fetch(new URL(icon.src, document.baseURI));
        results.push({
          src: icon.src,
          ok: response.ok,
          type: response.headers.get('content-type'),
        });
      }
      return results;
    }, manifest?.icons ?? []);

    check(
      '所有图标都能取到且是 PNG',
      iconStatuses.length > 0 &&
        iconStatuses.every((item) => item.ok && (item.type ?? '').includes('image/png')),
      iconStatuses,
    );

    const touchIcon = await page.$eval('link[rel="apple-touch-icon"]', (el) =>
      el.getAttribute('href'),
    );
    check(
      '声明了 apple-touch-icon（iOS 加到主屏幕用）',
      touchIcon?.includes('.png') === true,
      touchIcon,
    );

    section('[3] service worker');
    const registration = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return null;
      const reg = await navigator.serviceWorker.ready;
      return { scope: reg.scope, active: reg.active !== null };
    });

    check('service worker 已注册并激活', registration?.active === true, registration);
    check(
      '作用域在子路径下（/workoutapp/）',
      registration?.scope.endsWith(BASE_PATH) === true,
      registration?.scope,
    );

    section('[4] 联网时：能正常记录一次训练');
    await createWorkout(page, {
      muscle: '胸',
      exercise: '杠铃卧推',
      sets: [
        [80, 10],
        [80, 8],
      ],
    });
    check('训练已保存', true);

    await page.goto(`${process.env.E2E_BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'today-volume', undefined, 20_000);
    const onlineText = await page.evaluate(() => document.body.innerText);
    check('联网时首页显示今天已训练', onlineText.includes('今天已经练过了'));
    check('联网时不显示离线提示', (await page.$('[data-testid="offline-banner"]')) === null);

    section('[5] 断网：刷新页面，App 和数据都还在');
    await page.setOfflineMode(true);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const loadedOffline = await waitFor(page, 'today-volume', undefined, 20_000)
      .then(() => true)
      .catch(() => false);
    check('断网后刷新，App 仍然能打开（service worker 缓存生效）', loadedOffline);

    if (loadedOffline) {
      const offlineText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      check(
        '断网后数据还在（今天已训练）',
        offlineText.includes('今天已经练过了'),
        offlineText.slice(0, 120),
      );
      check('断网后显示离线提示', (await page.$('[data-testid="offline-banner"]')) !== null);

      // 断网状态下继续记录一组，确认本地写入不受影响
      await page.goto(`${process.env.E2E_BASE_URL}/workout`, { waitUntil: 'domcontentloaded' });
      const canStillRecord = await waitFor(page, 'start-workout', undefined, 15_000)
        .then(() => true)
        .catch(() => false);
      check('断网后训练页也能打开', canStillRecord);
    }

    section('[6] 恢复网络');
    await page.setOfflineMode(false);
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'today-volume', undefined, 20_000);
    check('恢复联网后离线提示消失', (await page.$('[data-testid="offline-banner"]')) === null);
    check(
      '恢复联网后数据仍完整',
      (await page.evaluate(() => document.body.innerText)).includes('今天已经练过了'),
    );

    section('[7] 深链接（GitHub Pages 上靠 404.html 兜底）');
    const deepResponse = await page.goto(`${APP_URL}history`, { waitUntil: 'domcontentloaded' });
    check(
      `直接访问 ${BASE_PATH}history 能拿到页面`,
      deepResponse !== null && deepResponse.status() < 400,
      deepResponse?.status(),
    );
    check('深链接路由生效（显示历史页）', (await page.content()).includes('历史'));

    section('[8] 页面没有 JS 报错');
    // 只看真正的 JS 异常：这条流程故意不启动后端、还故意断网，
    // 资源请求失败的噪音是预期的，不算问题。
    check('没有 JS 异常', jsErrors.length === 0, jsErrors.slice(0, 3));
  } finally {
    await cleanup();
    killTree(preview);
  }

  finish();
}

main().catch((error) => {
  console.error('\nPWA 端到端测试执行异常：', error);
  process.exitCode = 1;
});
