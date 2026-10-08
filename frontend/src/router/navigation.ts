import type { ComponentType } from 'react';
import {
  ChartIcon,
  DumbbellIcon,
  HistoryIcon,
  HomeIcon,
  UserIcon,
  type IconProps,
} from '@/components/icons/NavIcons';

export interface NavItem {
  /** 路由路径 */
  to: string;
  /** 底部导航文案 */
  label: string;
  /** 顶部标题 */
  title: string;
  icon: ComponentType<IconProps>;
  /** 是否精确匹配（首页需要） */
  end?: boolean;
}

/**
 * 底部导航固定为 5 项，顺序与需求一致：首页 / 训练 / 历史 / 统计 / 我的。
 * 新增页面时不要扩大这个列表。
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: '首页', title: 'FitLog', icon: HomeIcon, end: true },
  { to: '/workout', label: '训练', title: '训练', icon: DumbbellIcon },
  { to: '/history', label: '历史', title: '历史记录', icon: HistoryIcon },
  { to: '/stats', label: '统计', title: '统计', icon: ChartIcon },
  { to: '/profile', label: '我的', title: '我的', icon: UserIcon },
];

export function findNavItemByPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
}

/** 不在底部导航里的页面，标题单独给一个 */
const EXTRA_PAGE_TITLES: Record<string, string> = {
  '/supplements': '补剂',
};

export function resolvePageTitle(pathname: string): string {
  // /history/:id 这类子页面单独给标题
  if (pathname.startsWith('/history/')) return '训练详情';
  return findNavItemByPath(pathname)?.title ?? EXTRA_PAGE_TITLES[pathname] ?? 'FitLog';
}
