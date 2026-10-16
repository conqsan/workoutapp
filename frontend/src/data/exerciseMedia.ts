/**
 * 动作示范图（Exercises Dataset）。
 *
 * 素材放在 `public/exercises/<ref>.jpg`（180×180 静图）和 `<ref>.gif`（180×180 循环动画），
 * 编号就是 shared/defaults/exercises.json 里的 `ref`。
 *
 * 两个要注意的点：
 *   1. 路径必须带 `import.meta.env.BASE_URL` —— 部署在 GitHub Pages 子路径下时，
 *      写死 `/exercises/...` 会 404（和 sw.js 里那套拼法一个道理）。
 *   2. 版权：素材 © Gym visual，随数据集授权使用，署名必须保留（见 ATTRIBUTION）。
 */

/** 素材署名，界面上显示示范图的地方都要带上 */
export const MEDIA_ATTRIBUTION = '© Gym visual';
export const MEDIA_ATTRIBUTION_URL = 'https://gymvisual.com/';

function mediaUrl(ref: string, extension: 'jpg' | 'gif'): string {
  return `${import.meta.env.BASE_URL}exercises/${ref}.${extension}`;
}

/**
 * 列表里的 48px 小图。没有示范图（自定义动作）就返回 null，调用方不显示即可。
 */
export function exerciseImageUrl(mediaRef: string | null | undefined): string | null {
  return mediaRef ? mediaUrl(mediaRef, 'jpg') : null;
}

/** 展开动作卡片时的循环动画。比静图大一个量级，所以只在展开时才加载 */
export function exerciseGifUrl(mediaRef: string | null | undefined): string | null {
  return mediaRef ? mediaUrl(mediaRef, 'gif') : null;
}
