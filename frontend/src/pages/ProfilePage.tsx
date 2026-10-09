import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { DataBackupCard } from '@/components/DataBackupCard';

/**
 * 「我的」页。
 *
 * 只放用户真正用得上的东西：数据备份 / 恢复 + 几个快捷入口。
 * 技术栈、当前阶段、版本号这类信息属于 README 和仓库，不该出现在 App 界面上。
 */
export function ProfilePage(): ReactElement {
  return (
    <div className="space-y-4">
      <DataBackupCard />

      <section className="card space-y-2">
        <h2 className="text-base font-semibold text-slate-900">快捷入口</h2>
        <Link
          to="/workout"
          className="flex min-h-[48px] items-center justify-between rounded-xl px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
        >
          <span>训练记录</span>
          <span className="text-slate-400">→</span>
        </Link>
        <Link
          to="/supplements"
          className="flex min-h-[48px] items-center justify-between rounded-xl px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
        >
          <span>补剂记录</span>
          <span className="text-slate-400">→</span>
        </Link>
        <Link
          to="/history"
          className="flex min-h-[48px] items-center justify-between rounded-xl px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
        >
          <span>历史记录</span>
          <span className="text-slate-400">→</span>
        </Link>
      </section>
    </div>
  );
}
