import type { ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/router/navigation';
import { cn } from '@/utils/cn';

/**
 * 固定底部导航（Mobile First）。
 * 使用 min-h 保证触摸目标足够大，并叠加 iOS home indicator 安全区。
 */
export function BottomNav(): ReactElement {
  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch px-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition',
                    isActive ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700',
                  )
                }
              >
                <Icon className="h-6 w-6" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
