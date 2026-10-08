import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { DataBackupCard } from '@/components/DataBackupCard';

export function ProfilePage(): ReactElement {
  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <h2 className="text-base font-semibold text-slate-900">关于 FitLog</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          个人健身记录工具，不是商业 SaaS。核心目标是让训练过程中的记录操作尽可能少而快。
        </p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 pt-1 text-sm">
          <div>
            <dt className="text-xs text-slate-400">前端</dt>
            <dd className="font-medium text-slate-800">React + TS + Vite + Tailwind</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">后端</dt>
            <dd className="font-medium text-slate-800">Fastify + Prisma + SQLite</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">当前阶段</dt>
            <dd className="font-medium text-slate-800">Phase 1–9 已完成</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">版本</dt>
            <dd className="font-medium text-slate-800">0.1.0</dd>
          </div>
        </dl>
      </section>

      <section className="card space-y-2">
        <h2 className="text-base font-semibold text-slate-900">PWA 状态</h2>
        <p className="text-sm text-slate-600">
          已经可以「添加到主屏幕」，从桌面图标打开是全屏 App；打开过一次之后断网也能记录，
          数据本来就存在本机。
        </p>
      </section>

      <DataBackupCard />

      <section className="card space-y-2">
        <h2 className="text-base font-semibold text-slate-900">快捷入口</h2>
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
