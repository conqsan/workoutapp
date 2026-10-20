# FitLog

> 个人健身记录工具。训练时用最少的操作，把「今天练了什么、做了几组、每组多重」记下来。

FitLog 是一个**本地优先**的 PWA：数据先存在手机浏览器里，电脑不用开机，健身房没信号也能记录。
后端（Fastify + Prisma + SQLite）是可选的，只当备份库和数据分析用，不做实时同步。

取舍优先级始终是：**数据可靠 > 操作快 > 界面好看**。

---

## 目录

- [功能](#功能)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [常用命令](#常用命令)
- [项目结构](#项目结构)
- [数据存在哪](#数据存在哪)
- [训练规则](#训练规则)
- [动作示范图](#动作示范图)
- [测试](#测试)
- [部署到 GitHub Pages](#部署到-github-pages)
- [常见问题](#常见问题)
- [开发约定](#开发约定)

---

## 功能

### 训练（`/workout`）

- 开始 / 完成 / 放弃一次训练，也可以改「训练日期」补记前几天忘记记的
- 按部位选动作（10 个部位 / 52 个动作），也能临时新建自定义动作
- 每组单独记重量、次数、休息；重量支持 **kg / lb**，统计时统一换算成 kg
- **递减组**：一组里最多 3 段，每段各有自己的重量和次数
- **组间休息计时器**：填好秒数点 ▶ 就开始倒计时，可暂停、+15 秒、到点响一声
- 快捷重量（±2.5 / ±5 等）、复制上一组、复制上次训练、调整动作顺序、动作备注
- 训练总量、总组数实时统计

### 历史（`/history`）

- **按天合并**：一天练几次也只占一行，行上标着「2 次训练 · 3 个动作 · 8 组」
- 点进去是当天的详情：顶部是全天合计，下面按开始时间分成「第 1 次 / 第 2 次」，
  每次都带自己的时间段（例如 `09:15 – 10:05`）
- 每一次训练都能单独改日期 / 备注、单独删除；每一组都能就地改重量次数休息
- **能在历史里补记**：给某次训练加动作、给某个动作加一组（沿用上一组的数据）
- 删除按「次」算，行上的「删」删的是**整天**；补剂记录不受影响

### 统计（`/stats`）

- **训练天数**：本周 / 近 30 天各练了几天（一天练两次只算一天）
- **训练总量**：今天 / 本周 / 近 30 天
- 各部位训练次数、各动作训练次数（按部位分组折叠）
- **动作重量趋势**：先选部位、再选该部位下的动作，看每次训练的最大重量折线

### 补剂（`/supplements`）

- 默认三种：增肌粉、肌酸、蛋白粉；可自定义
- 单位可自由填，默认数据里增肌粉 / 蛋白粉支持 `g` 和 `勺`（按勺记不会硬换算成克）
- 记录用量、时间（早餐 / 训练前 / 训练后 / 睡前），可按日期翻看和修改

### 数据

- 存在浏览器的 IndexedDB 里，刷新、关掉重开都不会丢；**清站点数据或换浏览器会丢**
- 「我的」页可以导出 JSON 完整备份、导入合并、导出 CSV（训练组明细）
- 装成 PWA 之后断网也能用；打开过的页面和动作示范图会被 service worker 缓存

---

## 技术栈

| 层       | 选型                                                     |
| -------- | -------------------------------------------------------- |
| 前端     | React 18 · TypeScript（strict）· Vite 4 · Tailwind CSS 3 |
| 路由     | React Router 6                                           |
| 图表     | Recharts（统计页单独 chunk，按需加载）                   |
| 本地存储 | IndexedDB（薄封装，无第三方 ORM）                        |
| 后端     | Fastify · Zod · Prisma · SQLite                          |
| 测试     | 自写断言脚本 + Puppeteer（驱动真实 Edge/Chrome）         |
| 部署     | GitHub Actions → GitHub Pages                            |

要求 Node.js ≥ 16.13，npm workspaces 管理前后端。

---

## 快速开始

```bash
npm install
npm run dev
```

- 前端：<http://localhost:5173>
- 后端：<http://localhost:3001>（`/api/health` 可以看数据库状态）

**只跑前端也能用**——数据在浏览器本地，后端只是可选的备份/分析库。

### 初始化后端（第一次克隆时）

```bash
cp backend/.env.example backend/.env      # Windows: copy backend\.env.example backend\.env
npm run db:migrate                        # 建表
npm run db:seed                           # 写入默认部位 / 动作 / 补剂
```

后端默认配置（`backend/.env`）：

```ini
DATABASE_URL="file:./dev.db"     # 相对 backend/prisma/ 目录
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173
```

环境变量在启动时用 Zod 校验，缺项直接报错退出，不会带着坏配置跑起来。

### 用手机访问（局域网）

```bash
npm run dev:host
```

手机连同一个 Wi-Fi，打开电脑的 `http://<局域网 IP>:5173` 即可。

---

## 常用命令

在仓库根目录执行：

| 命令                   | 作用                                       |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | 同时启动前后端                             |
| `npm run dev:frontend` | 只启动前端                                 |
| `npm run dev:backend`  | 只启动后端                                 |
| `npm run build`        | 构建后端 + 前端                            |
| `npm run typecheck`    | 前后端 TypeScript 检查                     |
| `npm run lint`         | 前后端 ESLint                              |
| `npm run format`       | Prettier 格式化整个仓库                    |
| `npm test`             | 后端冒烟测试 + 前端统计 / 备份单元测试     |
| `npm run e2e`          | 9 条端到端流程（**需要先 `npm run dev`**） |
| `npm run db:migrate`   | 应用 Prisma migration                      |
| `npm run db:seed`      | 写入默认数据（幂等，可重复执行）           |
| `npm run db:studio`    | Prisma Studio 可视化查看数据库             |
| `npm run db:reset`     | ⚠️ 清空数据库并重建，**会丢数据**          |

只跑某一条 e2e：

```bash
npm run e2e:workout --workspace frontend
npm run e2e:history --workspace frontend
npm run e2e:stats --workspace frontend
npm run e2e:rest --workspace frontend
npm run e2e:pwa --workspace frontend      # 会自己构建 + preview，不需要 dev server
```

---

## 项目结构

```
workout/
├── frontend/                  # React SPA + PWA
│   ├── public/
│   │   ├── sw.js              # service worker（导航 network-first，静态资源 cache-first）
│   │   ├── manifest.webmanifest
│   │   └── exercises/         # 动作示范图（51 个动作 × jpg + gif，约 5.3MB）
│   ├── src/
│   │   ├── pages/             # 首页 / 训练 / 历史 / 统计 / 补剂 / 我的
│   │   ├── components/        # workout、history、stats、supplements、icons
│   │   ├── data/              # 类型、IndexedDB、仓储实现、默认数据、备份
│   │   ├── hooks/             # useWorkout / useHistory / useStats / useSupplements
│   │   ├── stores/            # 跨组件共享状态（组间休息计时器）
│   │   └── utils/             # 统计、重量换算、格式化、递减组解析
│   └── e2e/                   # Puppeteer 端到端流程
├── backend/                   # Fastify + Prisma + SQLite（可选）
│   ├── prisma/                # schema、migrations、seed、dev.db
│   └── src/                   # 路由 → 控制器 → 服务 → 仓储
├── shared/defaults/           # 部位 / 动作 / 补剂：前后端共用的唯一一份默认数据
├── docs/                      # 架构决策、原型页、内测文案
└── tools/                     # 推送到 GitHub 的一次性脚本
```

---

## 数据存在哪

### 本机（主存储）

训练数据全部在浏览器的 **IndexedDB**（库名 `fitlog`）里，7 张表：
`muscles` / `exercises` / `workouts` / `workoutExercises` / `workoutSets` /
`supplements` / `supplementRecords`，外加一张 `meta` 记录迁移与同步版本。

**每一组训练单独一行保存**——不会把 `80kg × 10 × 3 组` 塞进一个字段。
这是历史编辑、统计口径、CSV 导出都能对得上的前提。

### 默认数据只有一份

部位、动作、补剂的默认值只写在 `shared/defaults/*.json`，前端首次启动和后端 seed 读的是同一份。
改这里不需要改两处。

老设备上的数据靠两层机制跟上：

1. **增删**由 `SYNC_VERSION` 控制（防止把用户特意删掉的默认项又加回来）
2. **字段对齐**（动作的重量框数量、示范图编号）每次打开都会跑，只更新已存在的默认项，不新建也不删除

第二条是特意拆出来的：改一个动作的 `ref` 不会动版本号，如果挂在版本号上，JSON 改了、手机却永远停在旧值。

### 备份与迁移

- **导出 JSON**：完整快照，换手机/重装就靠它
- **导入 JSON**：**合并**语义，只补本机没有的，重复的跳过，不会覆盖已有记录，可以放心重复导入
- **导出 CSV**：训练组明细，带 UTF-8 BOM，Excel 直接打开不乱码

导入前会整体校验，任何一项不合法都不会写入数据。

---

## 训练规则

### 重量单位（kg / lb）

每组记住自己是用哪个单位录入的，显示时按原单位；统计、历史汇总、CSV 里统一换算成 kg。
切换单位只改显示，不改变实际重量。

### 递减组（一组多个重量段）

默认数据里「肩 / 飞鸟递减组」标了 `"weightSlots": 3`，一组会出现 3 段重量与次数：

```
20kg × 10  →  15kg × 8  →  10kg × 6
```

- 前 2 段必填，第 3 段可选（整段留空就只算两段）
- 休息是整组一份
- 训练总量按**每段自己的次数**累加（上面这组 = 380kg）

### 组间休息计时器

每组下面有一个计时器，换掉了原来的「休息 (秒)」输入框：

- 空闲时显示这一组计划的休息时长，可以直接改，也可以 −/+15 秒
- 点 ▶ 开始倒计时；计时中可暂停 / 继续、+15 秒、取消
- 到点会响一声并震动（iOS 不支持震动），界面变成「休息结束」，可以同样时长再来一轮
- 点「完成」会自动开始这一组的休息计时（前提是设过时长）
- 计时状态存在 `localStorage` 并记录**结束时间戳**，所以切组、折叠动作、切后台、刷新页面都不会走偏
- 「训练中」卡片顶部有一条常驻计时条，切到别的动作时也看得见

### 统计口径

| 指标           | 口径                                                         |
| -------------- | ------------------------------------------------------------ |
| 训练天数       | 按日期去重——同一天练几次都算 1 天                            |
| 训练总量       | Σ(重量 × 次数)，递减组按各段自己的次数；统一换算成 kg        |
| 各部位训练次数 | 按「训练」计：同一次训练里同一部位只算 1 次                  |
| 各动作训练次数 | 同上，按动作名去重；展示时按部位分组                         |
| 动作重量趋势   | 每次训练中该动作的**最大重量**；同名动作跨部位合并成一条趋势 |
| 进行中的训练   | **不计入**统计，只在页面上提示还有几次没完成                 |

「一周」从周一开始算；「近 30 天」含今天。

---

## 动作示范图

动作卡片和动作选择器里的示范图来自开源数据集
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)：

- 每个动作一张 180×180 的静止图（`<ref>.jpg`）和一份循环动画（`<ref>.gif`）
- 目前导入了 App 里 52 个动作对应的 51 个动作（「飞鸟递减组」和「哑铃飞鸟」共用一张），共 102 个文件、约 5.3MB
- 文件名就是 `shared/defaults/exercises.json` 里每个动作的 `ref`
- 选择器里用 48px 静止图（懒加载），展开动作卡片时才加载动图

> **授权**：素材版权归 [Gym visual](https://gymvisual.com/)，随数据集授权使用，署名必须保留。
> App 里显示示范图的地方都带了一行 `© Gym visual`，详见
> `frontend/public/exercises/ATTRIBUTION.md`。要用于印刷、宣传或更高分辨率场景，需自行取得授权。

**换一张图**：把 `shared/defaults/exercises.json` 里对应动作的 `ref` 改成数据集里的另一个 id，
把新的 `<ref>.jpg` / `.gif` 放进 `frontend/public/exercises/`，删掉不再被引用的旧文件即可
（字段对齐会在下次打开时把新 `ref` 同步到已安装的设备）。

---

## 测试

```bash
npm test          # 后端冒烟 + 前端单元测试（统计 71 项、备份 51 项）
npm run e2e       # 9 条端到端流程，共 357 项断言
```

端到端不是模拟：它会真的拉起 Edge/Chrome，点按钮、填输入框、刷新页面，再检查界面和 IndexedDB。

| 流程               | 覆盖                                           |
| ------------------ | ---------------------------------------------- |
| `workout-flow`     | 开始训练、选动作、逐组录入、单位切换、刷新不丢 |
| `rest-timer-flow`  | 开始/暂停/继续/+15/到点/换动作仍在/刷新仍在    |
| `drop-set-flow`    | 递减组三段各自的重量与次数                     |
| `supplements-flow` | 补剂记录、单位、按日期筛选                     |
| `history-flow`     | 按天合并、按场次展示、编辑、补记、删除         |
| `stats-flow`       | 训练天数、总量、部位/动作次数、趋势切换        |
| `backup-flow`      | 导出、导入合并、校验失败不写入                 |
| `viewport-flow`    | 320 / 375 / 390 / 414 / 768 五档宽度           |
| `pwa-flow`         | 子路径构建、manifest、service worker、断网刷新 |

> `e2e` 需要先 `npm run dev`（它会连 `localhost:5173`，并且依赖后端的 `/api/health`）。
> `e2e:pwa` 例外，它自己构建并起 `vite preview`。

---

## 部署到 GitHub Pages

部署之后：手机浏览器打开站点 → 添加到主屏幕 → 从图标启动是全屏 App，
**电脑不需要开机**，健身房没信号也能记录。

站点地址形如 `https://conqsan.github.io/workoutapp/`。

### 一次性设置

1. 在 GitHub 建一个空仓库（不要勾 README / .gitignore / license），推到 `main`
2. 仓库 → **Settings** → **Pages** → **Build and deployment** → **Source** 选 **GitHub Actions**

> 这一步必须手动做。Actions 自带的 `GITHUB_TOKEN` 没有开启 Pages 的权限，
> 工作流里加 `enablement: true` 会直接报 `Resource not accessible by integration`。

3. 等 Actions 变绿（约 1 分钟）

之后每次 `git push` 都会自动重新构建部署。

### 本地先验证一遍

```bash
npm run e2e:pwa --workspace frontend
```

它会用 `/<仓库名>/` 这个子路径真实构建、起 `vite preview`，验证 manifest、图标、
service worker 注册、**断网刷新后 App 与数据都还在**、深链接等。

### 部署相关的三个坑（代码里都处理好了）

- **子路径导致静态资源 404**：构建时注入 `VITE_BASE_PATH=/<仓库名>/`
- **子路径导致路由匹配不上**：`BrowserRouter` 用 `import.meta.env.BASE_URL` 当 `basename`
- **深链接刷新 404**（Pages 不支持 SPA 回退）：构建时额外生成一份 `404.html`

> 部署到 Pages 的只有前端。后端是电脑上的备份/分析库，没有实时同步——
> 迁移数据走「我的 → 导出 / 导入 JSON」。

---

## 常见问题

**Q：数据存在哪？换浏览器会丢吗？**

在浏览器的 IndexedDB 里。同一个浏览器刷新、重开都不会丢；**清站点数据、换浏览器、换设备会丢**。
所以「我的 → 导出 JSON」是唯一可靠的备份手段。

**Q：换手机怎么搬数据？**

旧手机导出 JSON → 传给新手机 → 新手机打开同一个站点导入。导入是合并，重复导入同一份不会产生重复记录。

**Q：导出的 CSV 在 Excel 里中文乱码？**

文件带 UTF-8 BOM，双击打开正常。如果还是乱码，多半是编辑器按 GBK 打开了，手动选 UTF-8 即可。

**Q：为什么删不掉某个动作 / 补剂，一直返回 409？**

故意的。它已经被训练记录或补剂记录引用，删掉会连带丢历史。想清理可以改名继续用，
或者先删掉相关记录。

**Q：`npm run dev` 提示 5173 端口被占用？**

Vite 会自动顺延到 5174。想清掉残留进程：

```powershell
netstat -ano | findstr :5173     # 找到 PID
taskkill /F /PID <PID>
```

**Q：Windows 上访问 `/workout` 报 `Failed to resolve entry for package "D:\workout"`？**

Vite 4 会把「没有扩展名的根相对 URL」按当前盘符根目录解析，`/workout` 正好被解析成 `D:\workout`。
`frontend/vite.config.ts` 里的 `fitlog:spa-navigation-fallback` 插件已经把浏览器导航请求改写到
`/index.html`，修掉了这个问题。

**Q：`npm run db:migrate` 报 `Schema engine error` 但没有细节？**

多半是 `TEMP` / `TMP` 指向了异常目录。Prisma 需要正常的系统临时目录来建 shadow database，
改回系统默认值再执行。

**Q：`npm run e2e` 报「Failed to launch the browser process」？**

Windows 上 `msedge.exe` 会立刻把活交给子进程然后退出，Puppeteer 的 `launch()` 会误判失败。
项目里已经改成「自己拉起浏览器 + 用 CDP 连上去」。仍然失败的话，检查
`frontend/e2e/harness.mjs` 的 `BROWSER_CANDIDATES` 里有没有你机器上的浏览器路径。

**Q：为什么「双杠臂屈伸」在趋势里只有一条？**

因为它就是同一个动作。默认数据里它在「胸」和「三头」下各有一条（id 不同），
但「看动作进步」的统计按**动作名**合并——分成两条反而看不出趋势。
「各动作训练次数」则按部位分组展示，因为那里关心的是「哪个部位练了多少」。

---

## 开发约定

- 运行时数据（部位、动作、补剂）必须来自数据层，**不允许写死在页面组件里**
- 默认数据只改 `shared/defaults/*.json`，前后端同源
- **每一组训练单独一行保存**，不合并成「重量 × 次数 × 组数」
- 业务逻辑放数据层 / utils，页面组件只负责渲染和交互
- 不绕过数据库，不把逻辑堆进单个文件
- 新增持久化字段时：改类型 → 补 IndexedDB 迁移 → 补默认数据同步 → 补测试
