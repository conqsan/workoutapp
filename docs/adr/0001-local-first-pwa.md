# ADR 0001：本地优先 PWA，前端托管 GitHub Pages

- 状态：**已接受**
- 日期：2026-10-06
- 影响范围：Phase 2 ～ Phase 9

## 背景

最初的方案是「React SPA + Fastify + Prisma/SQLite」，前端和后端都跑在个人电脑上，
手机通过局域网访问（`npm run dev:host`）。

Phase 1 实测后暴露了一个硬伤：**电脑不开，手机既打不开 App，也读不到数据。**

而 FitLog 的核心场景是「在健身房现场，做完一组就掏手机记一下」。绝大多数时候人不在
电脑旁边，也没有可靠网络。所以「必须依赖家里那台电脑常开」这个前提，直接让核心场景不成立。

## 决策

改为 **本地优先（local-first）PWA**：

1. 前端构建成纯静态产物，托管在 **GitHub Pages**，永久在线、自带 HTTPS。
2. 手机端数据的主存储是 **IndexedDB**。记录训练、查看历史、算统计都不依赖网络。
3. 服务端（Fastify + Prisma + SQLite）**退出生产主链路**，保留两个角色：
   - 默认数据的定义与 seed 来源
   - 电脑端的备份 / 分析库，以及未来多设备同步的目标端
4. 近期数据备份靠 **JSON 导出 / 导入**（Phase 9）。
   实时同步是后续增量，需要后端有 HTTPS 入口（Tailscale / Cloudflare Tunnel）。

## 后果

**好处**

- 电脑完全不用开，健身房断网也能记录 —— 核心场景成立了
- App 永久在线，不需要任何常开设备，零服务器成本

**代价**

- Prisma/SQLite 不再是生产环境的唯一真相来源，架构重心转移到前端
- 多设备同步不是白来的：要做冲突处理，工作量明显增加
- 备份变成用户要主动做的事（导出 JSON），所以必须做得足够简单
- GitHub Pages 有两个坑必须专门处理（见下）

## GitHub Pages 的两个已知坑

1. **子路径 base**：项目站地址形如 `https://<user>.github.io/<repo>/`。默认
   `base: '/'` 会让所有静态资源 404，构建时必须设置 `base: '/<repo>/'`。
   （开发环境仍保持 `/`，只改生产构建。）
2. **SPA 深链接刷新 404**：GitHub Pages 不支持 SPA 回退，直接访问或刷新
   `/fitlog/workout` 会返回 404。需要用 `404.html` 兜底（构建时复制一份 index.html）
   或改用 hash 路由。

另外 GitHub Pages 自带 HTTPS，正好满足 service worker 的安全上下文要求。

## 对各 Phase 的影响

| Phase                | 影响                                                                                                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 数据库和基础数据   | ✅ 已完成，范围不变（Schema + migration + seed + 基础 API）。默认部位 / 动作 / 补剂落在 `shared/defaults/*.json`，后端 seed 直接读它，做到「只定义一次」。**前端读这份数据的方式留到 Phase 3** —— 那时前端才真正需要把它写进本地库                                     |
| 3 核心训练记录       | ✅ 已完成。前端数据层落地为 `src/data` 的 `FitLogRepository` 接口 + IndexedDB 实现，训练数据完全不依赖后端在线；默认部位 / 动作打包进前端。**HTTP 实现推迟到 Phase 8**：现在做两套不同步的存储在现实中只会让人困惑（手机记的在电脑上查不到），等同步逻辑一起做才有意义 |
| 4 补剂系统           | ✅ 已完成。`/supplements` 走同一个本地 repository（IndexedDB），默认三个补剂来自 `shared/defaults`，支持增删改与按日期翻看历史                                                                                                                                         |
| 5 历史记录           | ✅ 已完成。列表用一次「三表读出 + 内存聚合」避免 N+1；详情从本地库读，补剂按同一天关联。仍然不依赖后端                                                                                                                                                                 |
| 6 统计系统           | ✅ 已完成。全部在手机本地算（`src/utils/stats.ts` 是纯函数，另有 46 项单元测试覆盖日期边界）；统计页单独懒加载，图表库不拖慢首页与训练页                                                                                                                               |
| 7 移动端 UI 优化     | ✅ 已完成。训练页动作列表改为手风琴（一次只展开一个），去掉彩色卡片；新增 320/375/390/414/768 五宽度的自动化布局检查                                                                                                                                                   |
| 8 PWA 和离线         | Service Worker + 离线缓存 + GitHub Pages 部署（base 路径、SPA 404 兜底），并补上 repository 的 HTTP 实现与同步逻辑                                                                                                                                                     |
| 9 全面测试和最终优化 | **新增**：JSON 导出 / 导入从「附加功能」升级为主要备份手段，需要重点测试                                                                                                                                                                                               |

## Phase 8 完成情况（补记）

Phase 8 已落地：

- `manifest.webmanifest` + 192 / 512 / maskable 图标 + `apple-touch-icon`，`display: standalone`
- 手写 service worker：页面导航 network-first 并回退到缓存的 `index.html`，
  静态资源 cache-first，`/api/` 完全不缓存
- 离线时页面顶部显示提示条；训练数据本来就在 IndexedDB，断网记录零损失
- GitHub Actions 构建并发布到 GitHub Pages。子路径 base、`BrowserRouter` 的 basename、
  SPA 深链接 404 三个坑都处理了，并在**生产构建**上用 `npm run e2e:pwa` 验证过
  （含真实的断网刷新测试）

**实时同步这一项没有做**，理由：手机在健身房根本连不到家里那台电脑，做了也没法用、
也没法验证；而在本地优先方案下，断网记录本来就没有任何损失。
备份改为交给 Phase 9 的 JSON 导出 / 导入。等真的需要多设备同步时再补 repository 的
HTTP 实现 —— 接口早就留好了，UI 不需要改。

## 待定

- ~~GitHub 仓库名~~ → 已确定：账号 `conqsan`，仓库 `workoutapp`，
  站点为 <https://conqsan.github.io/workoutapp/>，构建时 `VITE_BASE_PATH=/workoutapp/`
- 是否以及何时补上实时同步
