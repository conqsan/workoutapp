/**
 * 浏览器端的文件下载。
 *
 * 只做一件事：把一段文本存成文件。
 * 导出备份 / 导出 CSV 都走这里，避免下载逻辑在页面里各写一遍（写两遍就一定会漂）。
 */
export function downloadTextFile(fileName: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // 立刻 revoke 会让部分浏览器直接取消下载，延后释放这块内存
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
