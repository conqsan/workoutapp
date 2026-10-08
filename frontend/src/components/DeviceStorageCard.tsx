import type { ReactElement } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * 线上（部署到 GitHub Pages）显示的数据存储说明。
 *
 * 手机端不需要后端：训练、补剂、历史全在本机 IndexedDB 里。
 * 之前这里放的是「后端连接」卡片，部署之后必然显示「未连接」，很容易被当成故障
 * —— 但后端本来就没部署，也不打算部署（见 ADR 0001：手机在健身房连不到家里的电脑）。
 * 所以线上换成这张说明卡，开发环境仍然保留后端连接状态，方便排查。
 */
export function DeviceStorageCard(): ReactElement {
  const online = useOnlineStatus();

  return (
    <section className="card space-y-2" data-testid="storage-status">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">数据存储</p>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
          本机
        </span>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">
        训练、补剂、历史全部存在这台设备上，不依赖服务器。
      </p>
      <p className="text-xs text-slate-400">
        {online ? '已缓存到本机，断网也能打开和记录。' : '当前离线，记录照样保存在本机。'}
      </p>
    </section>
  );
}
