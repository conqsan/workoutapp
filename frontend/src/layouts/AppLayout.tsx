import type { ReactElement } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { OfflineBanner } from '@/components/OfflineBanner';
import { NAV_ITEMS, findNavItemByPath, resolvePageTitle } from '@/router/navigation';

export function AppLayout(): ReactElement {
  const location = useLocation();
  const currentItem = findNavItemByPath(location.pathname);
  // 子页面 = 不在导航里，或者比导航项更深一层（例如 /history/:id）
  const isSubPage = currentItem === undefined || location.pathname !== currentItem.to;
  const backTarget = currentItem?.to ?? NAV_ITEMS[0]?.to ?? '/';

  return (
    <div className="flex min-h-full flex-col">
      <header
        className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {isSubPage ? (
              <Link
                to={backTarget}
                aria-label="返回"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 ring-1 ring-slate-200"
              >
                ←
              </Link>
            ) : null}
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-slate-400">FitLog</p>
              <h1 className="truncate text-lg font-bold leading-tight text-slate-900">
                {resolvePageTitle(location.pathname)}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <OfflineBanner />

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
