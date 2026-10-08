/**
 * 注册 service worker。
 *
 * 只在生产构建里注册：开发模式下 Vite 的模块是按需编译、路径不带 hash，
 * cache-first 会把改动的代码缓存住，HMR 就废了。
 * 想看离线效果请跑 `npm run build && npm run preview`（或 npm run e2e:pwa）。
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  const base = import.meta.env.BASE_URL;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((error: unknown) => {
      // 注册失败不影响正常使用，只是没有离线能力
      console.warn('[FitLog] service worker 注册失败：', error);
    });
  });
}
