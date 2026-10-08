# FitLog

个人健身记录工具（PWA，Mobile First）。目标只有一句话：

> 在健身过程中，用尽可能少的操作，快速记录今天练了什么部位、做了什么动作、做了几组、每组多少次、用多少重量，以及当天用了哪些补剂。

这不是商业 SaaS，而是一个长期自用的工具。所有取舍都服从三个优先级：

1. **数据可靠** > UI 好看
2. **操作快** > 功能多
3. **稳定** > 花哨

---

## 一、当前进度

| Phase   | 内容                 | 状态      |
| ------- | -------------------- | --------- |
| Phase 1 | 项目初始化和基础架构 | ✅ 已完成 |
| Phase 2 | 数据库和基础数据     | ✅ 已完成 |
| Phase 3 | 核心训练记录         | ✅ 已完成 |
| Phase 4 | 补剂系统             | ✅ 已完成 |
| Phase 5 | 历史记录             | ✅ 已完成 |
| Phase 6 | 统计系统             | ✅ 已完成 |
| Phase 7 | 移动端 UI 优化       | ✅ 已完成 |
| Phase 8 | PWA 和离线           | ✅ 已完成 |
| Phase 9 | 全面测试和最终优化   | ⬜ 未开始 |

**Phase 1 交付内容**：前后端项目骨架、目录结构、TypeScript strict、ESLint、Prettier、
Tailwind、Prisma + SQLite 配置、环境变量、统一错误处理、底部导航与五个页面占位、
一条打通前后端的 `GET /api/health` 通道，以及一个可一键运行的冒烟测试。

**Phase 2 交付内容**：Prisma 的 7 张表与迁移、读 `shared/defaults` 的幂等 seed
（11 个部位 / 40 个动作 / 3 个补剂）、部位 / 动作 / 补剂的读接口和动作 / 补剂的增删改、
按「路由 → 控制器 → 服务 → 仓储」分层的代码结构、Zod 输入校验，以及扩展到 52 项断言的
冒烟测试。数据库状态也从 Phase 1 的「未初始化」变成「已就绪」。

**Phase 3 交付内容**：完整的训练记录流程。前端建了**本地优先的数据层**（IndexedDB），
训练数据先落在这台设备上，不需要后端在线；后端同时补齐了训练的整套 API。
`/workout` 页面支持开始 / 完成 / 放弃训练、按部位选动作、逐组录入重量次数与休息、
快捷重量调整、复制上一组、复制上次训练、调整动作顺序、删除动作与组，以及训练总量实时统计。
自动化测试：后端 108 项断言 + 端到端 31 项（真实浏览器驱动）。

> 追加改动：**重量支持 kg / lb 两种单位**。每组记住自己是用哪个单位录入的，
> 统计时统一换算成 kg。详见下面「重量单位」一节。

**Phase 4 交付内容**：`/supplements` 补剂记录页。选补剂（默认 增肌粉 / 肌酸 / 蛋白粉，
也可以新建自定义补剂）→ 填用量与单位 → 选时间（早餐 / 训练前 / 训练后 / 睡前）→ 添加；
记录可以逐条修改和删除，也能按日期翻看历史（默认今天）。首页的「今日补剂」会同步显示。
后端补齐了 `supplement-records` 的增删改查与按日期 / 按补剂筛选。

**Phase 5 交付内容**：`/history` 历史列表按日期倒序显示「日期 + 训练部位 + 总训练量 +
动作数 / 组数」，点进去是 `/history/:id` 完整详情（部位、每个动作逐组重量次数与休息、
该动作的训练量、当天补剂、训练备注）。

顺带加了一个实用能力：**训练页可以改「训练日期」**，用来补记前几天忘记记录的训练
（历史测试里的三天数据就是这么造出来的）。

**Phase 6 交付内容**：`/stats` 统计页。本周 / 本月训练次数、今天 / 本周 / 本月训练总量、
各部位训练次数、各动作训练次数（都带条形占比），以及单个动作的最大重量趋势折线图
（Recharts）+ 最大重量 / 最近重量 / 总训练量。首页的「今日概览」也从占位换成了真实数据。

**Phase 7 交付内容**：移动端适配。新增一套跑 320 / 375 / 390 / 414 / 768 五个宽度的
端到端检查（横向溢出、关键控件尺寸、底部导航遮挡），并把训练页的动作列表改成
**手风琴式**（一次只展开一个动作），去掉绿色卡片。

**Phase 8 交付内容**：PWA 与离线。
`manifest.webmanifest` + 192/512/maskable 图标 + `apple-touch-icon`，
`display: standalone`；手写的 service worker（导航 network-first、静态资源 cache-first、
接口完全不缓存）让 App **装到主屏幕后断网也能打开**；离线时页面顶部显示提示条。
部署链路：GitHub Actions 构建 + 发布到 GitHub Pages，子路径、SPA 深链接 404 都已处理。
详见「十一、部署到 GitHub Pages」。

> Phase 1 **没有**实现任何业务功能（训练、补剂、统计都还没有）。页面上的数据位置
> 都用「Phase N」标注了归属，方便确认没有提前偷跑。

### 架构决策：本地优先 PWA

Phase 1 收尾时确认了一个硬伤：原方案「前后端都跑在电脑上」，**电脑不开手机就没法用**，
而 FitLog 的核心场景恰恰是在健身房现场记录。

因此决定转向**本地优先（local-first）PWA**：前端静态托管到 GitHub Pages，数据主存储是
手机本地的 IndexedDB，服务端退居「默认数据来源 + 电脑端备份/分析」的角色。
完整取舍与对各 Phase 的影响见 [docs/adr/0001-local-first-pwa.md](docs/adr/0001-local-first-pwa.md)。

Phase 3 已经把这条架构落地了：

- 前端所有数据读写都走 `src/data/index.ts` 暴露的 `repository`，UI 不直接碰 IndexedDB
- 训练数据（训练 / 动作 / 每组）存在浏览器本地，**不依赖后端在线**
- 默认的部位 / 动作打包进前端（读 `shared/defaults`），第一次打开没有网络也能用
- 后端的整套训练 API 已实现并测试，留给 Phase 8 的同步与电脑端备份使用

也就是说：现在手机连上开发服务器打开一次页面之后，就算把后端关掉，训练记录照样能用。

---

## 二、技术栈

| 层       | 选型                                     | 版本                |
| -------- | ---------------------------------------- | ------------------- |
| 前端框架 | React + TypeScript                       | React 18.3 / TS 5.9 |
| 构建工具 | Vite                                     | 4.5                 |
| 样式     | Tailwind CSS（+ PostCSS + Autoprefixer） | 3.4                 |
| 路由     | React Router                             | 6.30                |
| 图表     | Recharts（Phase 6 使用，已安装）         | 2.15                |
| 后端     | Node.js + Fastify + TypeScript           | Fastify 4.29        |
| ORM      | Prisma                                   | 5.22                |
| 数据库   | SQLite                                   | —                   |
| 校验     | Zod                                      | 3.25                |
| 代码质量 | ESLint 8 + Prettier 3 + tsc strict       | —                   |
| 包管理   | npm workspaces（monorepo）               | npm 8+              |

### 运行环境

- Node.js **>= 16.13**（本机实测 Node 16.14.2 可用；如果方便，推荐升级到 Node 20 LTS）
- npm >= 8（workspaces 需要）

> 依赖版本是按 Node 16 可运行来锁定的：Vite 4 / Tailwind 3 / Prisma 5 / Fastify 4。
> 如果在 Node 20 上开发，同样可以正常工作。

---

## 三、项目结构

```
workout/                      # 仓库根目录（npm workspaces）
├── package.json              # 根脚本：dev / build / lint / typecheck / test / db:*
├── docs/adr/                 # 架构决策记录（为什么这么做）
├── shared/defaults/          # 默认部位 / 动作 / 补剂，前后端共用这一份
├── frontend/                 # 前端（Vite）
│   ├── index.html
│   ├── vite.config.ts        # 别名 @ -> src、@shared -> ../shared；/api 代理到后端
│   ├── e2e/                  # 端到端测试（Puppeteer 驱动真实浏览器）
│   ├── scripts/              # 统计逻辑的纯函数单元测试
│   ├── public/               # 静态资源（favicon、Phase 8 的图标与 manifest）
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── data/             # 本地数据层：repository 接口 + IndexedDB 实现
│       ├── components/       # 可复用 UI 组件
│       │   ├── icons/
│       │   ├── workout/      # 训练页专用组件（SetRow / ExercisePicker …）
│       │   ├── supplements/  # 补剂页专用组件（记录行 / 编辑表单）
│       │   └── stats/        # 统计页专用组件（趋势折线图）
│       ├── layouts/          # AppLayout（顶部标题 + 内容区 + 底部导航）
│       ├── pages/            # 主页面 + 404（五个主页面已全部实现）
│       ├── hooks/            # useWorkout / useSupplements / useHistory / useStats / …
│       ├── services/         # apiClient / healthService（与 UI 解耦）
│       ├── router/           # 导航配置
│       ├── stores/           # 跨页面共享状态（Phase 8 使用）
│       ├── types/            # 与后端共享的响应类型
│       └── utils/            # 日期、重量换算、统计计算（stats.ts）、className 拼接
└── backend/                  # 后端（Fastify）
    ├── prisma/
    │   ├── schema.prisma     # 7 个模型 + 关系
    │   ├── migrations/       # migration SQL（需要提交到 Git）
    │   └── seed.ts           # 读 shared/defaults 写入默认数据
    ├── scripts/smoke-test.ts # 冒烟测试（52 项断言）
    ├── tsconfig.json
    └── src/
        ├── server.ts         # 进程入口：监听端口 + 优雅退出
        ├── app.ts            # 组装 Fastify 实例
        ├── config/           # env（Zod 校验）、prisma
        ├── routes/           # 路由注册（统一挂在 /api）
        ├── controllers/      # 只负责 HTTP 层
        ├── services/         # 业务逻辑
        ├── repositories/     # 数据访问层：所有 Prisma 查询都收敛在这里
        ├── schemas/          # Zod 输入校验
        ├── middlewares/      # 统一错误处理 / 404
        ├── types/            # API 响应类型
        └── utils/            # ApiError / logger / 常量
```

分层约定：**路由 → 控制器 → 服务 → 仓储**。页面组件不直接拼 URL，也不直接写业务逻辑。

---

## 四、安装方法

在仓库根目录执行一次即可（npm workspaces 会同时安装前后端依赖）：

```bash
npm install
```

### 环境变量

| 文件                        | 说明                                                   |
| --------------------------- | ------------------------------------------------------ |
| `backend/.env`              | 后端实际使用的配置（已在本地创建，**不会**提交到 Git） |
| `backend/.env.example`      | 后端配置模板                                           |
| `frontend/.env.development` | 前端开发配置（无敏感信息，可提交）                     |
| `frontend/.env.example`     | 前端配置模板                                           |

后端默认配置：

```ini
DATABASE_URL="file:./dev.db"     # 相对 backend/prisma/ 目录
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173
```

环境变量在进程启动时用 Zod 校验，缺项会直接报错退出，不会带着坏配置跑起来。

---

## 五、数据库初始化

数据模型已经在 Phase 2 建好（7 张表 + migration + seed），数据库文件在
`backend/prisma/dev.db`。

### 从零初始化（新克隆的仓库）

```bash
npm install
cp backend/.env.example backend/.env     # Windows: copy backend\.env.example backend\.env
npm run db:migrate                      # 建表（执行 prisma/migrations 里的 migration）
npm run db:seed                         # 写入默认部位 / 动作 / 补剂
```

### 日常命令

| 命令                  | 作用                                          |
| --------------------- | --------------------------------------------- |
| `npm run db:migrate`  | 改完 schema 后生成并应用 migration            |
| `npm run db:seed`     | 写入默认数据（**幂等**，可重复执行）          |
| `npm run db:generate` | 只重新生成 Prisma Client                      |
| `npm run db:studio`   | 打开 Prisma Studio 可视化查看数据             |
| `npm run db:reset`    | ⚠️ 清空数据库并重建 + 重新 seed，**会丢数据** |

### 数据模型（7 张表）

| 表                   | 说明                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `muscles`            | 训练部位，11 项，`sort_order` 决定展示顺序                             |
| `exercises`          | 训练动作，唯一约束是 `(muscle_id, name)` —— 同名动作可以属于不同部位   |
| `workouts`           | 一次训练，`status` = `active` / `completed`                            |
| `workout_exercises`  | 某次训练里的某个动作，带 `sort_order` 和备注                           |
| `workout_sets`       | **每一组单独一行**，自己的 `weight` / `reps` / `rest_seconds`          |
| `supplements`        | 补剂，默认 增肌粉 / 肌酸 / 蛋白粉                                      |
| `supplement_records` | 补剂使用记录；`consumption_time` 是「训练后 / 早餐」这类标签，不是时刻 |

> `workout_sets.weight_unit` 记录这一组是按 `kg` 还是 `lb` 录入的（见下面「重量单位」）。

两个刻意的设计决定：

- **日期用 `'YYYY-MM-DD'` 字符串**（`workouts.date`、`supplement_records.date`）。
  日历日期不是时间点，用 `DateTime` 存会在时区转换时漂移，按天分组还得做范围查询。
  `start_time` / `end_time` 是真正的时刻，仍然用 `DateTime`。
- **不做级联删除历史**。删除补剂或动作时，如果已经被记录引用，接口直接返回 409 并说明
  原因，而不是静默删掉历史数据（详见「十一、常见问题」）。

### 默认数据只有一份定义

默认的训练部位 / 动作 / 补剂定义在 **`shared/defaults/*.json`**，后端 seed 直接读它。
前端（Phase 3 起）也会读同一份文件，避免两边各写一套最后漂移。
改完默认数据后重新执行 `npm run db:seed` 即可；seed 只新增，不会覆盖你改过的记录。

### 重量单位（kg / lb）

训练页每个重量输入框旁边有一个 **kg / lb** 小开关。设计原则是**数据真实、统计统一**：

| 场景     | 行为                                                                         |
| -------- | ---------------------------------------------------------------------------- |
| 录入     | 数字按你选的单位原样保存，同时把单位一起存下来（`workout_sets.weight_unit`） |
| 切换单位 | **换算数值**而不是换标签：80kg 切成 lb 会显示 176.37，因为实际举起的重量没变 |
| 新的一组 | 沿用上一组的单位（「+ 添加一组」就是复制上一组）                             |
| 训练总量 | 一律**换算成 kg** 再累加，显示时标 `kg`                                      |

为什么总量固定用 kg：如果一次训练里既有 80kg 又有 80lb，直接相加得到的数字没有任何意义。
统计口径（总量、重量趋势、最大重量）必须统一，所以选 kg 作为基准。

### 移动端适配（Mobile First）

训练页是整个 App 最重要的页面，所以它的动作列表是**手风琴式**的：

- 折叠时每个动作只占一行（序号 / 名称 / 部位 / 组数 / 该动作训练量）
- 同一时间只展开一个动作，展开的那个才显示组、快捷重量、备注
- 刚加的动作自动展开；刷新后默认展开第一个

这样十几个组也不会把页面拉成一条长龙。另外：**不用彩色卡片表示「已完成」**，
状态只体现在蓝色的「✓ 已完成」按钮和组号颜色上，整页更安静。

`npm run e2e:viewport` 会在 320 / 375 / 390 / 414 / 768 五个宽度下把五个主页面各开一遍，
自动检查：

1. **没有横向溢出**（并会先塞一个 2000px 宽的元素，确认检测器本身有效，避免假阴性）
2. **关键控件够大**：开始训练 / 训练日期 / 添加动作 / 添加一组 / 完成训练 / 重量与次数输入框，
   高度都必须 ≥ 44px
3. **底部导航没压住内容**：`main` 的下内边距必须 ≥ 导航高度

关于键盘：输入框统一 16px 字号（iOS 上小于 16px 会自动放大页面），
并在 `html` 上设了 `scroll-padding-bottom`，聚焦底部输入框时不会被固定导航挡住。
真机键盘行为仍建议在手机上实际点一遍。

### 统计口径

统计页的数字都从本地库现算，规则如下（`src/utils/stats.ts` 里写死了这些约定）：

| 规则                | 说明                                                   |
| ------------------- | ------------------------------------------------------ |
| 只算已完成的训练    | 进行中的训练不计入「训练次数」，页面会提示有几次没计入 |
| 一周从周一开始      | 到周日结束；跨月的那一周按实际日期算                   |
| 训练总量统一 kg     | 和重量单位规则一致                                     |
| 部位 / 动作训练次数 | 「多少次训练里练到过它」；同一次训练里重复出现只算一次 |
| 趋势图按天聚合      | 同一天练两次同一个动作会合并成一个点（取当天最大重量） |

> 注意：**首页的「今日概览」包含进行中的训练**（练的时候要能看到实时数据），
> 而统计页只算已完成的 —— 一个是「今天的记录」，一个是「已完成训练的口径」。

---

## 六、启动方法

### 同时启动前后端（日常开发）

```bash
npm run dev
```

| 服务            | 地址                             |
| --------------- | -------------------------------- |
| 前端（Vite）    | http://localhost:5173            |
| 后端（Fastify） | http://localhost:3001            |
| 健康检查        | http://localhost:3001/api/health |

前端通过 Vite 代理把 `/api` 转发到后端，所以前端代码里统一使用相对路径 `/api`，
不写死域名，也不依赖 CORS。

### 用手机访问（局域网）

```bash
npm run dev:host
```

前后端都会启动，只是前端额外绑到局域网网卡，控制台会打印形如
`http://192.168.x.x:5173` 的地址，手机连同一个 Wi-Fi 后直接打开即可。

### 只启动其中一个

```bash
npm run dev:backend    # 只启动后端
npm run dev:frontend   # 只启动前端
```

### 后端热重载

后端使用 `tsx watch`，改动 `backend/src/**` 会自动重启；前端由 Vite HMR 处理。

---

## 七、构建方法

```bash
npm run build      # 后端 tsc -> backend/dist，前端 vite build -> frontend/dist
npm run start      # 以生产模式运行后端（等价于 node backend/dist/src/server.js）
npm run preview    # 预览前端构建产物（在 frontend/ 下执行）
```

生产部署时，前端 `frontend/dist` 交给任意静态服务器并开启 SPA 回退；
后端监听 3001，反向代理把 `/api` 指到后端即可（这样无需修改前端任何代码）。

---

## 八、代码质量与测试

```bash
npm run typecheck     # 前后端 TypeScript 类型检查（strict，无 any 逃逸）
npm run lint          # 前后端 ESLint
npm run format        # Prettier 写入
npm run format:check  # Prettier 校验
npm test              # 后端冒烟测试 134 项 + 统计单元测试 46 项
npm run e2e           # 端到端测试（209 项，真实浏览器驱动全部主要流程）
```

`npm test` 会构建真实的 Fastify 应用并用 `app.inject()` 发请求，覆盖：

1. `GET /api/health` 返回统一成功结构，且 `database.initialized = true`
2. `GET /api/muscles` 返回 11 个默认部位，名称与顺序正确
3. `GET /api/exercises` 返回 40 个默认动作，带所属部位；`?muscleId=` 能按部位过滤
4. `GET /api/supplements` 返回 3 个默认补剂
5. `POST / PUT / DELETE /api/exercises` 全流程可用，`isCustom` 标记正确
6. `POST / PUT / DELETE /api/supplements` 全流程可用
7. **训练记录按 Phase 3 验收脚本走一遍**：开始训练（胸 + 肩）→ 加卧推 / 上斜哑铃卧推 /
   侧平举 → 逐组录入 8 组 → 重新拉取验证数据一致 → 复制上一组 → 删组后组号自动压回
   1/2/3 → 改组 → 调整动作顺序 → 删动作 → 完成训练 → 查上一次训练
8. 训练总量 = Σ(weight × reps)，逐段核对（3070 → 3095 → 2555 → 2190）
9. 校验与重复提交：重量为负 / 次数为 0 / 日期不存在 → 422，重复开始训练 → 409，
   不存在的 id → 404，且提示语都是中文
10. **重量单位**：用 lb 记账时数字与单位都按原样保存，训练总量把它换算成 kg 再累加；
    非法单位 → 422；不传单位默认 kg
11. **补剂记录**：肌酸 5g / 蛋白粉 30g / 增肌粉 100g 三条记录、按日期与按补剂筛选、
    修改、删除、用量为负 → 422、补剂不存在 → 400
12. 未知路由 → 统一 `ROUTE_NOT_FOUND` 404；非法 JSON → 可读的 4xx 且不泄露
    `Internal Server Error`

`npm run test:stats` 是统计逻辑的**纯函数单元测试**（46 项），专门覆盖 Phase 6 验收里点名的
边界：跨月的那一周、月份天数（平年 / 闰年 2 月）、月末当天、重量为 0、空数据、
lb 换算、同一天练两次合并成一个数据点。这些用固定日期测最可靠 —— 端到端很难造出
「跨月的那一周」这种场景。

测试会真的写数据库，但用的是唯一命名的临时记录，跑完自动删干净。

### 端到端测试（`npm run e2e`）

需要先跑着 `npm run dev`。它用 Puppeteer 驱动本机已安装的 Edge/Chrome，在 390×844 的
手机视口下把训练流程完整点一遍，重点是**刷新页面后数据必须还在**（Phase 3 的验收要求）。

`npm run e2e` 会依次跑五条流程：

| 文件                       | 覆盖                                                                         | 断言数 |
| -------------------------- | ---------------------------------------------------------------------------- | ------ |
| `e2e/workout-flow.mjs`     | 训练全流程（含 kg/lb、刷新后数据仍在、练完再看开始页）                       | 39     |
| `e2e/supplements-flow.mjs` | 补剂增改删与按日期查看                                                       | 19     |
| `e2e/history-flow.mjs`     | 造三天数据 → 历史排序 / 详情 / 补剂不串日期                                  | 28     |
| `e2e/stats-flow.mjs`       | 统计口径（本周 / 本月 / 各部位 / 趋势）+ 首页今日概览                        | 30     |
| `e2e/viewport-flow.mjs`    | 320 / 375 / 390 / 414 / 768 五个宽度的布局自检（溢出 / 控件尺寸 / 底部导航） | 93     |

只想跑其中一条：

```bash
npm run e2e:workout --workspace frontend
npm run e2e:supplements --workspace frontend
npm run e2e:history --workspace frontend
npm run e2e:stats --workspace frontend
npm run e2e:viewport --workspace frontend
```

每次都用全新的浏览器 profile，所以 IndexedDB 是干净的，既保证可重复，也不会碰你
浏览器的真实数据。加 `E2E_SCREENSHOT=<路径>` / `E2E_SCREENSHOT_SUPPLEMENTS=<路径>`
`/ E2E_SCREENSHOT_HISTORY_LIST` / `E2E_SCREENSHOT_HISTORY_DETAIL`
可以在跑测试时把界面截图下来。

### API 约定

成功：

```json
{ "success": true, "data": {} }
```

失败（`message` 永远是可以直接展示给用户的中文提示）：

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "找不到对应的数据。" } }
```

已实现的接口：

| 方法   | 路径                                  | 说明                                                    |
| ------ | ------------------------------------- | ------------------------------------------------------- |
| GET    | `/api/health`                         | 服务存活 + 存储就绪状态，始终返回 200                   |
| GET    | `/api/muscles`                        | 训练部位列表（按 `sortOrder`）                          |
| GET    | `/api/exercises`                      | 动作列表，支持 `?muscleId=`，每条带所属部位             |
| GET    | `/api/exercises/:id`                  | 单个动作                                                |
| POST   | `/api/exercises`                      | 创建自定义动作（`isCustom` 置为 true）                  |
| PUT    | `/api/exercises/:id`                  | 修改动作（名称 / 部位 / 描述）                          |
| DELETE | `/api/exercises/:id`                  | 删除动作（被训练引用时返回 409）                        |
| GET    | `/api/supplements`                    | 补剂列表（默认补剂在前）                                |
| POST   | `/api/supplements`                    | 创建自定义补剂                                          |
| PUT    | `/api/supplements/:id`                | 修改补剂（名称 / 单位）                                 |
| DELETE | `/api/supplements/:id`                | 删除补剂（已有使用记录时返回 409）                      |
| GET    | `/api/exercises/:id/last-workout`     | 这个动作上一次「已完成」训练的数据，没有历史返回 `null` |
| POST   | `/api/workouts`                       | 开始训练（已有进行中的训练时返回 409）                  |
| GET    | `/api/workouts/active`                | 当前进行中的训练，没有则返回 `null`                     |
| GET    | `/api/workouts/:id`                   | 一次训练的完整结构（动作 + 每组）                       |
| PUT    | `/api/workouts/:id`                   | 修改训练（日期 / 备注）                                 |
| DELETE | `/api/workouts/:id`                   | 删除训练（连同它的动作与组一起清掉）                    |
| POST   | `/api/workouts/:id/complete`          | 完成训练（所有组置为已完成）                            |
| POST   | `/api/workouts/:id/exercises`         | 往训练里加动作                                          |
| PUT    | `/api/workouts/:id/exercises/reorder` | 调整动作顺序（传排好序的 id 列表）                      |
| PUT    | `/api/workout-exercises/:id`          | 改训练动作的备注 / 顺序                                 |
| DELETE | `/api/workout-exercises/:id`          | 删除训练里的动作（连同它的组）                          |
| POST   | `/api/workout-exercises/:id/sets`     | 添加一组                                                |
| PUT    | `/api/sets/:id`                       | 修改某一组（重量 / 次数 / 休息 / 备注 / 完成）          |
| DELETE | `/api/sets/:id`                       | 删除某一组，并把剩下的组号压成 1..n                     |
| GET    | `/api/supplement-records`             | 补剂记录，支持 `?date=YYYY-MM-DD` 与 `?supplementId=`   |
| POST   | `/api/supplement-records`             | 添加记录（不传 date 默认今天，不传 unit 跟随补剂）      |
| PUT    | `/api/supplement-records/:id`         | 修改记录（用量 / 单位 / 时间 / 备注）                   |
| DELETE | `/api/supplement-records/:id`         | 删除记录                                                |

> 训练的写操作（加动作、加组、改组…）都会返回**更新后的整次训练**，前端直接用返回值重绘，
> 不用再请求一次。

---

## 九、PWA 使用方法

> **架构决策**：本项目采用**本地优先（local-first）PWA**，前端托管在 GitHub Pages，
> 数据主存储是手机本地的 IndexedDB。原因和取舍见
> [docs/adr/0001-local-first-pwa.md](docs/adr/0001-local-first-pwa.md)。

PWA（manifest / service worker / 图标 / 离线缓存 / standalone）在 **Phase 8** 实现。

完成后在手机上使用的方式是：

1. 手机浏览器打开 GitHub Pages 上的 FitLog 地址
2. 「添加到主屏幕」
3. 从桌面图标启动，即以全屏 standalone 模式运行

**电脑不需要开机**。训练记录先写手机本地，断网也能用；需要备份时用导出 JSON。

Phase 8 之前（也就是现在）想用手机试，还是走局域网：换成 `--host` 模式启动即可。

```bash
npm run dev:host
```

Vite 会把可用的局域网地址打印出来，例如 `http://192.168.50.235:5173`，手机连同一个
Wi-Fi 后直接访问该地址即可。因为前端走的是 Vite 代理（`/api` → 本机 3001），
浏览器只访问 5173 一个端口，所以 **不需要** 改 `CORS_ORIGIN`。

注意这只是**开发期的临时手段**，电脑必须开着 —— 这正是 Phase 8 要解决的问题。

---

## 十、数据导入导出

在 **Phase 9** 实现。因为走的是本地优先架构，**导出/导入是主要的数据备份手段**，
重要程度比原计划高，需要做得扎实：

- Export JSON（完整数据，用于备份与跨设备迁移）—— 主要备份路径
- Export CSV（训练组明细，便于用表格软件分析）
- Import JSON：校验 JSON 格式 → 校验数据结构 → 去重 → 出错时给出明确提示

---

## 十二、常见问题

## 十一、部署到 GitHub Pages（PWA 上线）

部署之后：手机浏览器打开站点 → 添加到主屏幕 → 从图标启动是全屏 App，
**电脑不需要开机**，健身房没信号也能记录（数据在手机本地）。

> 本仓库配置的是项目站，地址形如 `https://<用户名>.github.io/<仓库名>/`。
> 换成仓库名 `workoutapp` 就是 `https://<用户名>.github.io/workoutapp/`。

### 一次性设置（约 3 分钟）

**1. 在 GitHub 上建一个空仓库**，名字 `workoutapp`，**公开**，
并且**不要勾选** Add a README / .gitignore / license（勾了会和本地首次推送冲突）。

**2. 把本地代码推上去。** 在 PowerShell 里粘这一行：

```powershell
powershell -ExecutionPolicy Bypass -File D:\workout\tools\push-to-github.ps1
```

脚本会自己去找 `git.exe`（如果你的 PowerShell 里 `git` 不在 PATH 上，它照样能工作）、
统一一次代码风格、问你要 GitHub 用户名和提交邮箱，然后提交 + 关联远程仓库 + 推送，
最后把接下来要点的两个网址打印出来。提交身份用 `git -c` 临时传入，**不会改你机器的全局 git 配置**。

> 如果机器上根本没装 Git，脚本会提示两条路：装 Git for Windows，或者改用图形界面的
> GitHub Desktop（Add local repository → Commit → Publish repository，同样能完成）。

想手动来也可以，等价于这几条：

```bash
git add -A
git -c user.name="你的名字" -c user.email="你的邮箱" commit -m "FitLog: Phase 1-8"
git remote add origin https://github.com/<你的用户名>/workoutapp.git
git push -u origin main
```

**3. 打开 Pages（必须手动做一次，3 次点击）。**

仓库 → **Settings** → 左侧 **Pages** → **Build and deployment** →
**Source** 下拉框选 **GitHub Actions**。

> 这一步**不能省**。通过 API 自动开启 Pages 需要仓库管理员权限，而 Actions 自带的
> `GITHUB_TOKEN` 没有这个权限 —— 工作流里如果加 `enablement: true`，会直接报
> `Create Pages site failed. Error: Resource not accessible by integration` 并中断，
> 所以本仓库刻意没有加它。
>
> 如果之前已经跑失败过一次：设好 Source 之后，去 Actions 点进那次失败运行，右上角
> **Re-run all jobs** 重跑一次即可（不用重新提交代码）。

**4. 等 Actions 变绿（大约 1 分钟）。** 成功之后站点就在
`https://<你的用户名>.github.io/workoutapp/`。

### 之后每次更新

```bash
git add -A
git commit -m "改了什么"
git push
```

推上去就会自动重新构建部署，不需要手动做什么。

### 手机上装成 App

- **Android / Chrome**：打开站点 → 菜单 → 「安装应用」或「添加到主屏幕」
- **iOS / Safari**：打开站点 → 分享 → 「添加到主屏幕」

装好之后从图标启动是全屏 standalone，没有浏览器地址栏。
第一次打开过一次之后，**断网也能用**。

### 部署相关的三个坑（都已经在代码里处理好了）

- **子路径导致静态资源全部 404**：构建时注入 `VITE_BASE_PATH=/<仓库名>/`，由 Actions 自动拼上仓库名
- **子路径导致路由全部匹配不上**：`BrowserRouter` 用 `import.meta.env.BASE_URL` 作为 `basename`
- **深链接刷新返回 404**（Pages 不支持 SPA 回退）：构建时额外生成 `404.html`，内容与 `index.html` 一致

### 本地先验证一遍

不想推上去才发现问题的话，本地就能完整模拟生产环境：

```bash
npm run e2e:pwa --workspace frontend
```

它会用 `/workoutapp/` 这个子路径真实构建、起 `vite preview`，然后验证
manifest、图标、service worker 注册、**断网刷新后 App 与数据都还在**、深链接等 26 项。

### 关于后端

部署到 Pages 的只有前端。后端（Fastify + Prisma + SQLite）仍然是电脑上的备份/分析库，
Phase 8 没有做实时同步 —— 手机上的数据本来就存在本地，离线可用，
所以不依赖后端；备份走 Phase 9 的 JSON 导出 / 导入。

**Q：`npm run dev` 提示 5173 端口被占用？**

Vite 会自动顺延到 5174/5175。也可以先清掉残留进程：

```bash
netstat -ano | findstr :5173     # 找到 PID
taskkill /F /PID <PID>
```

**Q：Windows 上访问 `/workout` 报 `Failed to resolve entry for package "D:\workout"`？**

这是 Vite 4 在 Windows 上的一个坑：它会把「没有扩展名的根相对 URL」按
**当前盘符根目录**去解析，于是 `/workout` 被解析成 `D:\workout`。恰巧本项目目录就叫
`D:\workout`，所以会直接 500。项目已经在 `frontend/vite.config.ts` 里用一个
`fitlog:spa-navigation-fallback` 插件修好了：在 Vite 内部中间件之前，把浏览器导航请求
改写到 `/index.html`，语义与 Vite 自带的 SPA 回退一致，同时不影响 `/api` 代理、
模块请求、HMR 和静态资源。

**Q：`/api/health` 里 `database.initialized` 是 `false`，是不是出问题了？**

说明 Prisma Client 还没生成、或者数据库连不上。

```bash
npm run db:migrate    # 建表
npm run db:seed       # 写默认数据
```

正常状态下它应该是 `true`，`status` 是 `ok`。

**Q：为什么删不掉某个动作或补剂，一直返回 409？**

这是**故意的**。如果这个动作已经被训练记录引用、或这个补剂已经有过使用记录，删除会连带
丢掉历史数据。FitLog 的原则是数据可靠性优先，所以接口会拒绝并告诉你被引用了多少次。

想清理的话有两个办法：把动作**改名**继续用，或者先删掉相关的训练记录再删。

**Q：`npm run db:migrate` 报 `Schema engine error:` 而且没有任何细节？**

已知的诱因是 **`TEMP` / `TMP` 环境变量指向了一个异常目录**。Prisma 的 schema engine 需要
一个正常可用的系统临时目录来建 shadow database。把 `TEMP`、`TMP` 改回系统默认值再执行
即可（不要手动把它们指到项目目录里）。

**Q：`npm run e2e` 报「Failed to launch the browser process」？**

Windows 上 `msedge.exe` 启动后会立刻把活交给子进程然后自己退出（exit code 0），
Puppeteer 的 `launch()` 会因此判定失败。项目里已经改成「自己拉起浏览器 + 用 CDP 连上去」，
正常情况下不会再遇到。如果仍然失败，检查 `frontend/e2e/workout-flow.mjs` 里的
`BROWSER_CANDIDATES` 是否包含你机器上的浏览器路径。

**Q：首页为什么没有「开始训练」按钮？**

因为底部导航已经有「训练」了，再放一个大按钮是重复动作。首页那张卡只回答一个问题
——「今天练了没有、练了什么」，想开始记录点底部「训练」即可。

**Q：练完再进「训练」页，为什么不是显示「今天还没有训练记录」？**

练过就会如实显示。这一屏会查今天已完成的训练：练过就显示「今天已经练过了」+ 部位 /
动作数 / 组数 / 总量，按钮也变成「再练一次」（想一天两练、或补记别的日期都可以）。

**Q：训练记录存在哪里？换浏览器会丢吗？**

存在浏览器的 IndexedDB 里，所以**换浏览器或清空站点数据会丢**。这是本地优先架构的代价，
备份手段是 Phase 9 的「导出 JSON」。同一个浏览器里刷新、关掉重开都不会丢。

**Q：为什么 `+ 添加一组` 会自动填上上一组的重量和次数？**

因为大部分人下一组就是照抄上一组，一键添加再改数字比每格都填快得多。
需求里的「复制上一组」和它是同一个操作（在末尾追加时），所以合并成了一个按钮，
避免两个按钮做同一件事。

**Q：后端启动报「环境变量校验失败」？**

检查 `backend/.env` 是否存在、`DATABASE_URL` 是否配置。可以直接复制模板：

```bash
copy backend\.env.example backend\.env
```

**Q：Windows 上 `npm install` 报 `EPERM: operation not permitted, lstat 'C:\Users\...'`？**

这是受限环境（沙箱 / 权限策略）不允许访问用户临时目录导致的，Prisma 的 postinstall
需要读取临时目录。换一个普通终端执行，或先把 `TEMP`/`TMP` 指向一个可写目录再安装。
（注意：这个临时目录只用于安装；执行 `db:migrate` 时要用回系统默认的 `TEMP`。）

---

## 十三、开发约束

这些约束在整个项目中长期有效：

- 不一次性重写项目，不擅自删除已完成功能，不随意更换技术栈或数据库
- 运行时数据（训练部位、动作、补剂）必须来自数据层，不允许写死在页面组件里。
  默认数据在 `shared/defaults/*.json` 定义一次，用户自己的数据存在本地库
- 每一组训练单独一行保存，**不允许**把 `80kg × 10 × 3组` 塞进一个字段
- 不绕过数据库、不把业务逻辑堆在页面组件里、不把代码写进单个文件
- 不用 `any` 糊弄类型，不忽略 TypeScript / ESLint 报错，不忽略移动端适配与错误处理
- 每个 Phase 结束必须实际运行测试，没有跑过就不说「通过」

走本地优先架构后新增的约束：

- **默认数据只有一份定义**（`shared/defaults/*.json`），后端 seed 和前端都读它，
  不允许两边各写一套
- 所有 Prisma 查询都写在 `repositories/`，service 不直接持有 `PrismaClient` 细节
- 删除动作 / 补剂前必须检查引用，**不允许**用级联删除静默抹掉历史数据
- 前端 UI 只能通过 `src/data` 的 `repository` 读写数据，**不允许**在组件里直接使用
  IndexedDB 或 fetch；Phase 8 加 HTTP 实现 / 同步时页面代码不跟着改
- 训练的写操作一律返回「更新后的整次训练」，前端直接用返回值重绘，避免自己拼状态
- **重量单位不能混着算**：每组记下自己的单位，任何汇总（总量、趋势、PR）都必须先换算成
  kg 再计算，不允许把 kg 和 lb 直接相加
