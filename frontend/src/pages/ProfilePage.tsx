import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { PhasePlaceholder } from '@/components/PhasePlaceholder';

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
            <dd className="font-medium text-slate-800">Phase 1 已完成</dd>
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
          manifest 与 service worker 将在 Phase 8 接入，届时可「添加到主屏幕」并以全屏 standalone
          模式使用。
        </p>
      </section>

      <PhasePlaceholder
        phase="Phase 9"
        description="「我的」页面后续会承载基础数据管理与数据迁移能力。"
        items={[
          '数据导出 JSON / CSV，导入 JSON（含校验）— Phase 9',
          '动作管理（自定义动作的增删改）— Phase 5+',
        ]}
      />

      <section className="card space-y-2">
        <h2 className="text-base font-semibold text-slate-900">快捷入口</h2>
        <Link
          to="/supplements"
          className="flex min-h-[48px] items-center justify-between rounded-xl px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
        >
          <span>补剂记录</span>
          <span className="text-slate-400">→</span>
        </Link>
      </section>
    </div>
  );
}
