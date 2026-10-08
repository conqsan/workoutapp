import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { registerServiceWorker } from '@/services/serviceWorker';
import '@/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('找不到 #root 挂载节点，请检查 index.html。');
}

/**
 * 部署在 GitHub Pages 的项目站时，地址是 https://<用户名>.github.io/<仓库名>/，
 * 路由必须知道这段前缀，否则所有路径都匹配不上、直接掉进 404 页。
 * Vite 会把 BASE_URL 设成 '/' 或 '/workoutapp/'，这里去掉结尾的斜杠给 Router 用。
 */
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter basename={basename === '' ? '/' : basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// 生产构建里注册 service worker，让 App 装到主屏幕后能离线打开
registerServiceWorker();
