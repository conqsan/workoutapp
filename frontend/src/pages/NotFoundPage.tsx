import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage(): ReactElement {
  return (
    <section className="card space-y-3 text-center">
      <p className="text-3xl font-bold text-slate-900">404</p>
      <p className="text-sm text-slate-600">这个页面不存在，或者已经被移动了。</p>
      <Link to="/" className="btn btn-primary w-full">
        返回首页
      </Link>
    </section>
  );
}
