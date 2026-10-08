import type { ReactElement } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '@/utils/stats';

export interface ExerciseTrendChartProps {
  points: readonly TrendPoint[];
}

/** 单个动作的最大重量趋势。数据点太少时用点图更直观，所以折线也保留圆点。 */
export function ExerciseTrendChart({ points }: ExerciseTrendChartProps): ReactElement {
  const data = points.map((point) => ({
    label: point.label,
    weight: Math.round(point.maxWeightKg * 10) / 10,
  }));

  return (
    <div className="h-56 w-full" data-testid="trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 14, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={52}
            unit="kg"
          />
          <Tooltip
            formatter={(value) => [`${String(value)} kg`, '最大重量']}
            labelFormatter={(label) => `日期 ${String(label)}`}
            contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#1c62f5"
            strokeWidth={2}
            dot={{ r: 3, fill: '#1c62f5' }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
