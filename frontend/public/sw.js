/**
 * FitLog 的 service worker。
 *
 * 目标只有一个：**打开过 App 之后，没网也能用**。
 * 数据本来就在 IndexedDB 里，所以这里只需要保证「页面本身能加载出来」。
 *
 * 策略：
 *   - 页面导航：network-first，失败就回退到缓存的 index.html
 *     （这样直接访问 /history/xxx 这种深链接、或者断网刷新都还能打开）
 *   - 静态资源：cache-first（构建产物带 hash，内容不会变）
 *   - /api/：完全不碰，不缓存接口响应
 *
 * 所有路径都基于 self.registration.scope 拼，因此部署在
 * https://<user>.github.io/workoutapp/ 这种子路径下也正确。
 */

const CACHE_NAME = 'fitlog-shell-v1';

const SHELL_PATHS = ['./', './index.html', './manifest.webmanifest'];

function scopeUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // 逐个添加：某个资源失败不要连带整个安装失败
      await Promise.all(
        SHELL_PATHS.map(async (path) => {
          try {
            await cache.add(scopeUrl(path));
          } catch (error) {
            console.warn('[FitLog SW] 预缓存失败：', path, error);
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

/** 导航请求：先走网络（拿到最新的 index.html），失败就用缓存兜底 */
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const shellUrl = scopeUrl('./index.html');

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(shellUrl, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(shellUrl);
    if (cached) return cached;

    return new Response('离线，而且本机还没有缓存到页面。请先联网打开一次 FitLog。', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/** 静态资源：缓存优先，miss 了才请求网络并顺手存下来 */
async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // 接口不缓存：这里的数据源是本地库，接口只用于将来的同步
  if (url.pathname.includes('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAsset(request));
});
