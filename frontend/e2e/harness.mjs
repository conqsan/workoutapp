/**
 * 端到端测试的公共部分：断言计数、等待工具、浏览器启动/关闭、元素操作。
 * 具体的业务流程写在 workout-flow.mjs / supplements-flow.mjs 里。
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
export const STEP_TIMEOUT = 12_000;

const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ------------------------------------------------------------------ 断言

let failures = 0;
let checks = 0;

export function check(name, condition, extra) {
  checks += 1;
  if (condition) {
    console.log(`  \u2713 ${name}`);
  } else {
    failures += 1;
    console.error(`  \u2717 ${name}`);
    if (extra !== undefined) console.error('    实际结果:', JSON.stringify(extra));
  }
}

export function section(title) {
  console.log(`\n${title}`);
}

/** 打印小结并设置退出码 */
export function finish() {
  console.log('');
  if (failures > 0) {
    console.error(`失败：${checks - failures}/${checks} 项通过，${failures} 项未通过。\n`);
    process.exitCode = 1;
  } else {
    console.log(`全部通过（${checks}/${checks}）。\n`);
  }
}

// ------------------------------------------------------------------ 浏览器

function findBrowser() {
  const found = BROWSER_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      `找不到可用的浏览器，请把路径加进 frontend/e2e/harness.mjs 的 BROWSER_CANDIDATES。\n` +
        `已尝试：\n${BROWSER_CANDIDATES.join('\n')}`,
    );
  }
  return found;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(2000, () => request.destroy(new Error('timeout')));
  });
}

/**
 * Windows 上 msedge.exe 启动后会立刻把活交给子进程然后自己退出（exit code 0），
 * Puppeteer 的 launch() 会因为「进程已经没了」判定失败。
 * 所以这里自己把它拉起来，等调试端口就绪之后用 CDP 连上去。
 *
 * 返回的对象带一个 cleanup()，无论测试成功失败都要调用。
 */
export async function launchBrowser({ viewport = { width: 390, height: 844 } } = {}) {
  const browserPath = findBrowser();
  const profileDir = await mkdtemp(path.join(tmpdir(), 'fitlog-e2e-'));
  const port = await findFreePort();

  const child = spawn(
    browserPath,
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const deadline = Date.now() + 25_000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      await httpGetJson(`http://127.0.0.1:${port}/json/version`);
      const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
      const page = await browser.newPage();
      await page.setViewport({ ...viewport, isMobile: true, hasTouch: true });

      /** 真正的 JS 异常（页面崩了、未捕获的 Promise 之类） */
      const jsErrors = [];
      /** 上面这些 + 控制台报错 + HTTP >= 400，用来做更严格的检查 */
      const pageErrors = [];

      page.on('pageerror', (error) => {
        jsErrors.push(String(error));
        pageErrors.push(String(error));
      });
      page.on('console', (message) => {
        if (message.type() === 'error') pageErrors.push(message.text());
      });
      page.on('response', (response) => {
        if (response.status() >= 400) {
          pageErrors.push(`HTTP ${response.status()} ${response.url()}`);
        }
      });

      return {
        browser,
        page,
        jsErrors,
        pageErrors,
        cleanup: async () => {
          await browser.close().catch(() => undefined);
          child.kill();
          await rm(profileDir, { recursive: true, force: true, maxRetries: 3 }).catch(
            () => undefined,
          );
        },
      };
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }

  child.kill();
  throw new Error(`等待浏览器调试端口超时：${lastError?.message ?? '未知原因'}`);
}

// ------------------------------------------------------------------ 元素操作

export function selector(testId, name) {
  return name ? `[data-testid="${testId}"][data-name="${name}"]` : `[data-testid="${testId}"]`;
}

export async function waitFor(page, testId, name, timeout = STEP_TIMEOUT) {
  const handle = await page.waitForSelector(selector(testId, name), { timeout });
  if (!handle) throw new Error(`等不到元素 ${selector(testId, name)}`);
  return handle;
}

export async function waitIn(root, testId, name, timeout = STEP_TIMEOUT) {
  const handle = await root.waitForSelector(selector(testId, name), { timeout });
  if (!handle) throw new Error(`等不到子元素 ${selector(testId, name)}`);
  return handle;
}

/** 轮询直到条件成立，超时返回 false（记成一条失败而不是整个中断） */
export async function waitUntil(fn, timeout = STEP_TIMEOUT) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await sleep(100);
  }
  return false;
}

function httpStatus(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    request.on('error', reject);
    request.setTimeout(2000, () => request.destroy(new Error('timeout')));
  });
}

/**
 * 轮询一个 URL，直到它返回 2xx/3xx（用来等 vite preview 起来）。
 * 只看状态码，不解析响应体 —— 页面返回的是 HTML，不是 JSON。
 */
export async function waitForHttp(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const status = await httpStatus(url);
      if (status > 0 && status < 400) return true;
      lastError = new Error(`HTTP ${status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(300);
  }
  throw new Error(`等待 ${url} 超时：${lastError?.message ?? '未知原因'}`);
}

/** 跑一条命令并等它结束；非 0 退出码直接抛错 */
export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'ignore',
      shell: process.platform === 'win32',
      ...options,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} 退出码 ${code}`));
    });
  });
}

async function isEnabled(handle) {
  return handle.evaluate((el) => !el.disabled);
}

/**
 * 点击前先把元素滚到视口中间。
 * 否则 Puppeteer 可能把它滚到视口底部，正好压在固定的底部导航下面，
 * 结果点到的是「历史」而不是目标按钮，页面直接跳走。
 */
export async function centerInView(handle) {
  await handle.evaluate((el) => el.scrollIntoView({ block: 'center' }));
}

/** 按钮在保存过程中会被禁用，点之前先等它可用 */
export async function clickWhenReady(handle) {
  const ok = await waitUntil(() => isEnabled(handle));
  if (!ok) throw new Error('按钮一直是禁用状态，点不了');
  await centerInView(handle);
  await handle.click();
}

/**
 * 往受控输入框里写值。
 * 直接改 DOM value + 派发 input 事件（React 认这个），比 click-count-3 再打字稳，
 * 不会出现「8075」这种把新值接在旧值后面的情况。
 */
export async function setInputValue(handle, value) {
  await centerInView(handle);
  await handle.evaluate((el, next) => {
    el.focus();
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, String(value));
  // 输入框在 Enter 时会失焦，失焦即保存
  await handle.press('Enter');
}

/**
 * 给受控输入框赋值但不按 Enter（用于 onChange 直接生效的字段，例如日期选择器）。
 * input 和 change 都派发一次，兼容不同 input type 下 React 的事件映射。
 */
export async function fillInput(handle, value) {
  await centerInView(handle);
  await handle.evaluate((el, next) => {
    el.focus();
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }, String(value));
}

export async function textOf(page, testId) {
  const handle = await waitFor(page, testId);
  return (await handle.evaluate((el) => el.textContent ?? '')).trim();
}

/** 训练总量之类的文本带千分位，比较前先清掉 */
export function normalizeNumberText(text) {
  return text.replace(/[,\s]/g, '');
}
