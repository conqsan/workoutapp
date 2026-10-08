import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:3001';

/**
 * GitHub Pages 的部署路径。
 * 项目站地址是 https://<用户名>.github.io/<仓库名>/，所有静态资源都必须带这个前缀，
 * 否则会整站 404。开发服务器保持 '/'，只有 build / preview 才用它。
 */
const BASE_PATH = process.env.VITE_BASE_PATH ?? '/';

/**
 * GitHub Pages 不支持 SPA 回退：直接访问 /workout 或在那里刷新会 404。
 * 构建时把 index.html 复制一份成 404.html，Pages 就会拿它兜住这些路径，
 * App 启动后路由再接管。
 */
function spaNotFoundFallback(): Plugin {
  let root = process.cwd();
  let outDir = 'dist';

  return {
    name: 'fitlog:spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = config.build.outDir;
    },
    closeBundle() {
      try {
        copyFileSync(
          path.resolve(root, outDir, 'index.html'),
          path.resolve(root, outDir, '404.html'),
        );
      } catch (error) {
        console.warn('[FitLog] 生成 404.html 失败（深链接刷新会 404）：', error);
      }
    },
  };
}

/** 这些前缀属于 Vite 内部路径或后端 API，绝不能改写成 index.html。 */
const NON_NAVIGATION_PREFIXES = ['/@', '/api/', '/node_modules/'];

/**
 * Windows 上的一个真实坑（本项目已踩到并修复）：
 *
 * Vite 的 transform 中间件会把「没有扩展名的根相对 URL」当作文件系统路径解析，
 * 而且是在**当前盘符的根目录**下解析。于是 `/workout` 会被解析成 `D:\workout`。
 * 恰好本项目的目录就叫 `D:\workout`，且里面有 package.json，
 * 结果 `/workout` 这个路由直接 500：
 *
 *   Failed to resolve entry for package "D:\workout"
 *
 * 这里在 Vite 内部中间件之前，把「浏览器的页面导航请求」直接改写到 /index.html。
 * 语义和 Vite 自带的 SPA fallback 一致，但绕开了上面那条会出错的解析路径。
 * 只匹配 GET/HEAD + Accept: text/html + 无扩展名的请求，因此不会影响
 * /api 代理、模块请求、HMR 和静态资源。
 */
function spaNavigationFallback(): Plugin {
  return {
    name: 'fitlog:spa-navigation-fallback',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next();
          return;
        }

        if (!(req.headers.accept ?? '').includes('text/html')) {
          next();
          return;
        }

        const pathname = (req.url ?? '/').split('?')[0] ?? '/';
        if (path.extname(pathname) !== '') {
          next();
          return;
        }

        if (NON_NAVIGATION_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
          next();
          return;
        }

        req.url = '/index.html';
        next();
      });
    },
  };
}

export default defineConfig(() => ({
  /**
   * 只有显式设置了 VITE_BASE_PATH 才用部署路径（GitHub Actions 与
   * `npm run e2e:pwa` 会设），本地 `npm run dev` 不设 → 保持 '/'。
   * Vite 4 的 ConfigEnv 里没有 isPreview，所以用环境变量而不是 command 来判断，
   * 这样 build 与 preview 拿到的是同一个值，前后一致。
   */
  base: BASE_PATH,
  plugins: [react(), spaNavigationFallback(), spaNotFoundFallback()],
  resolve: {
    alias: {
      // 仓库根目录的 shared/：前后端共用的默认数据（部位 / 动作 / 补剂）
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    // 开发时把 /api 代理到后端，前端代码里统一使用相对路径，避免 CORS 与硬编码域名
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2019',
  },
}));
