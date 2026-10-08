import type { ReactElement, ReactNode } from 'react';

export interface IconProps {
  className?: string;
}

interface IconBaseProps extends IconProps {
  children: ReactNode;
}

function IconBase({ className, children }: IconBaseProps): ReactElement {
  return (
    <svg
      className={className ?? 'h-6 w-6'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1H9.5v-5.5h5V21h3a1 1 0 0 0 1-1V9.5" />
    </IconBase>
  );
}

export function DumbbellIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M6.5 6.5v11" />
      <path d="M3 9v6" />
      <path d="M17.5 6.5v11" />
      <path d="M21 9v6" />
      <path d="M6.5 12h11" />
    </IconBase>
  );
}

export function HistoryIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4.5V9h4.5" />
      <path d="M12 7.5V12l3 2" />
    </IconBase>
  );
}

export function ChartIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M4 20h16" />
      <path d="M7 20V11" />
      <path d="M12 20V5" />
      <path d="M17 20v-6" />
    </IconBase>
  );
}

export function UserIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </IconBase>
  );
}
