import type { ReactElement } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * 离线提示。
 * 数据本来就写在手机本地，所以离线不影响记录 —— 这行字主要是让用户安心，
 * 免得以为数据没存上。
 */
export function OfflineBanner(): ReactElement | null {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      data-testid="offline-banner"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800"
    >
      当前处于离线模式，数据已保存在本机，不影响记录。
    </div>
  );
}
