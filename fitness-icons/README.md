# FitLog Fitness Icon System

PHASE 1（设计系统）+ PHASE 2（10 个基准动作）+ STYLE ROUND 1/2（两轮风格修正）。

一套**手写 SVG**的动作图标库：不是位图、不含文字、透明背景，同一套人体骨架 + 器材组件拼出来，
所以风格天然一致、体积很小（单个 1.3–3.4KB）。**PHASE 2 只做了这 10 个动作，剩余 130 个等指令。**

## 快速开始

```bash
cd fitness-icons
node tools/build.mjs        # 生成 10 个 SVG + preview/contact-sheet.svg + preview/size-test.svg
node tools/check-style.mjs  # 21 项样式一致性检查（任何一项不过就退出码 1）
```

`exercises.json` 是**唯一数据源**：动作元数据 + 关节坐标都在里面，改坐标 → 重新 build 即可。

## 设计系统（PHASE 1）

### 画布与配色

| 项目     | 值                                    |
| -------- | ------------------------------------- |
| 画布     | 256 × 256，`viewBox="0 0 256 256"`    |
| 主色     | `#3F3F3F`（人形 / 器械）              |
| 动作箭头 | `#35C9B5`                             |
| 场景线   | `#BDBDBD`（地面线、钢索）             |
| 背景     | transparent（无底色、无阴影、无渐变） |

> 「场景线」是参考图里就有的第三色（它地面线明显比人形浅）。规格只写了两个颜色，
> 这一条是**有意保留的偏差**；要严格两色的话把所有 `CONTEXT` 换成 `INK` 再 build 即可。

### 人体（`components/human/index.mjs`）

目标是**极简运动剪影**：粗圆路径 + 小头，介于「火柴人」和「几何人偶」之间。

> 走过一次弯路：曾经把躯干做成实心几何轮廓（有肩宽收腰的大块面），结果僵硬、机械、
> 不像参考图。**已经回滚**——躯干回到窄的粗圆路径，四肢回到粗圆路径，只保留小头与
> 器械尺度这两项改动。检查脚本里有硬性规则：人体层不允许出现 polygon / path 填充块。

- 头：**小**实心圆 `r = 10`（直径 20px，比第一版小 1/3），无五官 / 无头发 / 无描边，全库同尺寸
- 躯干：**两段略收窄的粗圆路径**（胸 → 腰），窄、简单、和四肢在肩部自然重叠，不是填充多边形
- 四肢：**粗圆路径**，只在粗细上做一点点区分（近端略粗、远端略细），不做多边形、不做锥形块
- 关节：不画圆点 —— 圆头路径自然重叠，轮廓连续；手 / 脚就是路径自己的圆头
- 部件：Head / Torso（胸 + 腰）/ UpperArm / Forearm / Thigh / LowerLeg / Foot，
  每个部件在 SVG 里带 `data-part`，将来做局部动画可以直接选中
- 尺寸表（全库统一，改这里就够）：
  | 部件      | 宽度       |
  | --------- | ---------- |
  | head      | 20（直径） |
  | chest     | 17         |
  | waist     | 14.5       |
  | upper-arm | 13         |
  | forearm   | 11.5       |
  | thigh     | 14.5       |
  | lower-leg | 12         |
  | foot      | 10.5       |
- 姿势用**关节坐标**描述（`exercises.json` 的 `pose.points`）：
  `head / neck / hip / elbowL·R / wristL·R / kneeL·R / ankleL·R / toeL·R`
- 手臂从**躯干轮廓算出来的肩点**出发（不是脖子中心），所以实心躯干和手臂是连在一起的
- **侧视只画靠镜头的一侧**：`pose.hide` 里列出另一侧关节（否则两条肢体同色叠一起会糊成一坨）

### 箭头（`components/arrows/index.mjs`）

- `#35C9B5`，`stroke-width = 8`，圆头圆角 + 实心三角
- **尺寸统一**：直线箭头长度都在 50–64px（自动检查），视觉重量一致
- `heads: 'to' | 'both'`：往复动作统一用双向指示 —— 深蹲（下/上）、卧推（下/上）、
  弯举（下/上）、高位下拉（下/上）、腿举（前/后）、俯卧撑（下/上）
- `curve` 传二次贝塞尔控制点可画弧线（壶铃摆动用它）
- 规则：**只能画在人体轮廓外侧**，不压肢体

### 器械（`components/equipment/index.mjs`）

`Dumbbell` / `Barbell` / `WeightPlate`（支持 `hole` 用 evenodd 挖孔）/ `Bench`（可带腿）/
`Backrest` / `Kettlebell` / `PullUpBar` / `CableMachine`（配重柱 + 滑轮 + 钢索）/ `FloorLine`。
全部几何简化：不画螺丝、配重销、扶手这类机械细节。器械永远在人体下一层。

**器械不能抢戏**（STYLE ROUND 1 整体减重 15–25%，并加了自动上限检查）：

| 部件           | 第一版 | 现在 | 变化 |
| -------------- | ------ | ---- | ---- |
| 绳索机配重柱宽 | 26     | 20   | −23% |
| 杠铃片半径     | 17     | 13   | −24% |
| 哑铃总长       | 34     | 26   | −24% |
| 哑铃片         | 12×30  | 9×22 | −25% |
| 卧推凳厚度     | 20     | 18   | −10% |

## 10 个基准动作（PHASE 2）

| 文件                                   | 动作       | 分类      | 视角  | 箭头         |
| -------------------------------------- | ---------- | --------- | ----- | ------------ |
| `legs/barbell_back_squat.svg`          | 杠铃深蹲   | legs      | side  | ↕ 往复       |
| `chest/barbell_bench_press.svg`        | 杠铃卧推   | chest     | side  | ↑ 向上       |
| `legs/conventional_deadlift.svg`       | 传统硬拉   | legs      | side  | ↑ 向上       |
| `back/lat_pulldown.svg`                | 高位下拉   | back      | front | ↓ 向下       |
| `arms/dumbbell_biceps_curl.svg`        | 哑铃弯举   | arms      | front | ↑ 向上       |
| `shoulders/dumbbell_lateral_raise.svg` | 哑铃侧平举 | shoulders | front | ↗↖ 向外上方  |
| `chest/push_up.svg`                    | 俯卧撑     | chest     | side  | ↓ 向下       |
| `core/plank.svg`                       | 平板支撑   | core      | side  | 无（静态）   |
| `legs/leg_press.svg`                   | 腿举       | legs      | side  | ↗ 腿伸展方向 |
| `full_body/kettlebell_swing.svg`       | 壶铃摆动   | full_body | side  | 弧线向上     |

**三处有意偏离规格的视角**（写在 `exercises.json` 的 `view_note` 里）：
高位下拉 / 哑铃弯举用正面（3/4 视角在这种无脸剪影里只会让两条手臂互相遮挡）、
腿举用纯侧视（正视看不出腿蹬出去）。要严格按 3/4 重画也可以，但辨识度会下降。

## 目录

```
fitness-icons/
├── components/{human,equipment,arrows}/index.mjs   # 可复用组件
├── exercises.json                                  # 唯一数据源（元数据 + 关节坐标）
├── tools/build.mjs                                 # 生成 SVG 与预览图
├── tools/check-style.mjs                           # 21 项一致性检查
├── <category>/<id>.svg                             # 10 个独立图标（分类目录）
└── preview/{contact-sheet,size-test}.svg           # 预览图（名称在图标外）
```

## 检查项（`tools/check-style.mjs`）

头尺寸与数量、四肢粗细是否等于尺寸表、**人体层不允许出现填充块 / 关节圆点**、
躯干是否「窄 + 略收窄」、线宽档位、round cap+join、三种颜色、箭头粗细 / 长度 / 双向数量、
**器械尺寸上限**、器械层级与配色、画布与坐标边界、四周留白 ≥12px、
**按视角分组的视觉重量 ±35%**、**BODY > HEAD（头面积 < 15%）**、无文字。全部自动跑，**35 项**。

动作辨识度无法自动化：看 `preview/contact-sheet.svg`（10 个同尺寸并排）和
`preview/size-test.svg`（256/128/64/48/32 五档）。当前 10 个在 **64×64 都能认出动作**。

## 加第 11 个动作

1. 在 `exercises.json` 里加一条：元数据 + `pose.points`（关节坐标）+ `props` + `arrows`
2. `node tools/build.mjs && node tools/check-style.mjs`
3. 打开 `preview/contact-sheet.svg` 看风格是否还在一条线上
