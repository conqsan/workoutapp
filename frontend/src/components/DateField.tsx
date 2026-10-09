import type { ReactElement } from 'react';
import { cn } from '@/utils/cn';
import { formatDateKeyLabel, formatDateKeyShort } from '@/utils/format';

export interface DateFieldProps {
  /** 'YYYY-MM-DD' */
  value: string;
  onChange: (next: string) => void;
  /** 挂在**真正的 input** 上，方便测试和自动化操作 */
  testId?: string;
  ariaLabel: string;
  /** lg：训练页那种大输入框；sm：补剂页顶部的小日期 */
  size?: 'lg' | 'sm';
  disabled?: boolean;
  className?: string;
}

/**
 * 日期选择框。
 *
 * **为什么不用原生 `<input type="date">` 直接当外观**：这个控件在手机上有一套自己的
 * 内在宽度（中文 locale 下「2026年10月9日」再加上日历图标），而且各家浏览器对
 * `min-width: auto` 的处理不一样 —— 结果就是输入框比卡片还宽、横向顶出屏幕，
 * 2026-10-09 的真机截图就是这么挂的（改 CSS 收缩规则并不能在所有内核上生效）。
 *
 * 现在的做法：真正露脸的是一层**我们自己画的 DIV**（普通块级元素，宽度受容器约束，
 * 不可能溢出），原生 input 完全透明地绝对定位盖在它上面，只负责「点一下弹出系统日期选择器」。
 * 这样不管哪个浏览器、哪种日期格式，布局都是稳的。
 */
export function DateField({
  value,
  onChange,
  testId,
  ariaLabel,
  size = 'lg',
  disabled = false,
  className,
}: DateFieldProps): ReactElement {
  return (
    <div
      className={cn(
        'relative min-w-0',
        size === 'lg' ? 'h-12 w-full' : 'h-9 w-[10.5rem]',
        className,
      )}
    >
      <div
        aria-hidden="true"
        data-testid={testId === undefined ? undefined : `${testId}-display`}
        className={cn(
          'flex h-full w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-inset ring-slate-200',
          size === 'lg'
            ? 'px-4 text-base font-medium text-slate-900'
            : 'px-2.5 text-sm text-slate-700',
          disabled && 'opacity-60',
        )}
      >
        <span className="truncate">
          {size === 'lg' ? formatDateKeyLabel(value) : formatDateKeyShort(value)}
        </span>
        <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
      </div>

      <input
        type="date"
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value || value)}
        className="date-field-native absolute inset-0 h-full w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-transparent opacity-0"
      />
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}
