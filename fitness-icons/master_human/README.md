# FITLOG · MASTER HUMAN SILHOUETTE SYSTEM

这是**人体构造的唯一基准**。做任何动作图标之前，先确认所有姿势都来自这套系统。

唯一权威参考：**最初上传的那张健身图标参考图**。下面所有比例都是从那张图里量出来的，
不是自己设计的 —— 目标是把参考图的视觉语言用干净 SVG 复刻出来。

```bash
cd fitness-icons/master_human
node tools/build.mjs      # 生成 7 个部件 + 6 个 master 姿势 + 一致性检查图
node tools/validate.mjs   # 16 项校验（读生成的 SVG，不信任内存数据）
```

## 比例（以头径 d = 23px 为单位）

| 部位      | 长度   | 粗细                                |
| --------- | ------ | ----------------------------------- |
| head      | —      | 1.00 d（23）                        |
| torso     | 2.20 d | 1.13 d → 0.96 d（胸 → 腰，26 → 22） |
| upper arm | 1.60 d | 0.61 d（14）                        |
| forearm   | 1.50 d | 0.52 d（12）                        |
| thigh     | 2.00 d | 0.67 d（15.4）                      |
| lower leg | 1.90 d | 0.57 d（13.1）                      |
| foot      | 0.90 d | 0.50 d（11.5）                      |

- 整体约 **7.3 头身**（参考图量出来就是这个量级：瘦、小头、但不细成火柴）
- 躯干是全身最粗的一段，比头略宽 —— 这样头才不会显得大
- 四肢近端略粗、远端略细，但有且只有这一档差异（不做锥形块）

## 构造语言

- 头：实心小圆，无五官 / 无头发 / 无描边
- 躯干：**两段略收窄的粗圆路径**（胸 + 腰）—— 不是填充多边形，不是衬衫 / 护甲
- 四肢：**粗圆路径**，`round` cap + `round` join
- 关节：不画圆点、不做几何连接节点 —— 靠圆头路径自然重叠（校验里硬性禁止人体层出现
  polygon / rect / path 填充块，也禁止除头以外的圆）
- 手 / 脚：路径自己的圆头
- 颜色：只有 `#3F3F3F`；背景透明；没有渐变 / 阴影 / 第二种颜色

## 六个 master 姿势

所有关节都由**共享长度 + 角度**推出来（`tools/poses.mjs`），所以「同一个人」是构造上保证的：

| 文件                                      | 姿势                       | 说明                                     |
| ----------------------------------------- | -------------------------- | ---------------------------------------- |
| `master_poses/front_standing.svg`         | MASTER_01 · FRONT STANDING | 主基准：正面站姿、手臂微外展、双脚略外八 |
| `master_poses/side_standing.svg`          | MASTER_02 · SIDE STANDING  | 同一人侧视；只画靠镜头的一臂一腿         |
| `master_poses/three_quarter_standing.svg` | MASTER_03 · THREE QUARTER  | 轻微 3/4；两条手臂尽量不重叠             |
| `master_poses/squat.svg`                  | MASTER_04 · SQUAT          | 屈髋屈膝、躯干前倾、脚掌踏实             |
| `master_poses/pushup.svg`                 | MASTER_05 · PUSH-UP        | 身体一条直线、手臂撑地                   |
| `master_poses/supine.svg`                 | MASTER_06 · SUPINE         | 仰卧、屈膝                               |

`master_poses/sheet.svg` 是六个并排的一致性检查图（同样不含任何文字）。

## 部件文件

`components/human/{head,torso,upper_arm,forearm,thigh,lower_leg,foot}.svg`
—— 每个部件单独一张 256×256 的图，竖放居中，带 `data-w` / `data-length` 便于核对尺寸。

## 校验覆盖

1. 每段骨头长度 = 共享尺寸表（±1.5px）、躯干长度一致
2. 头半径一致且每个姿势只有一个圆头；人体层只有头一个圆
3. 人体层无 polygon / rect / path 填充块；所有粗细都来自尺寸表；全部 round cap+join
4. 只有一种颜色、背景透明、无文字、无第二种颜色
5. 四周留白 ≥ 12px；三个站姿高度一致（±3px）
