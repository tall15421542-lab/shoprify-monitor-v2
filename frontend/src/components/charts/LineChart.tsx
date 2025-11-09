import { useMemo } from 'react';
import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatPrice } from '../../utils/price';
import type { AveragePriceData } from '../../types';

export interface LineChartSeries {
  id: string;
  label: string;
  data: AveragePriceData[];
  color?: string;
}

interface LineChartProps {
  title: string;
  series: LineChartSeries[];
  emptyMessage?: string;
}

function LineChart({ title, series, emptyMessage }: LineChartProps) {
  const colorPalette = ['#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#6366f1', '#22d3ee', '#f97316'];

  const resolvedSeries = useMemo(
    () =>
      series.map((item, index) => ({
        ...item,
        color: item.color || colorPalette[index % colorPalette.length],
      })),
    [series]
  );

  const hasData = resolvedSeries.some((item) => item.data && item.data.length > 0);

  const chartData = useMemo(() => {
    if (!hasData) return [];

    const pointMap = new Map<
      number,
      {
        timestamp: number;
        rawDate: Date;
        dateLabel?: string;
        [key: string]: unknown;
      }
    >();

    resolvedSeries.forEach((serie) => {
      serie.data.forEach((point) => {
        const timestamp =
          point.timestamp instanceof Date ? point.timestamp.getTime() : new Date(point.timestamp).getTime();
        const rawDate = point.timestamp instanceof Date ? point.timestamp : new Date(point.timestamp);
        const existing = pointMap.get(timestamp);

        if (existing) {
          existing[serie.id] = point.averagePrice;
        } else {
          pointMap.set(timestamp, {
            timestamp,
            rawDate,
            [serie.id]: point.averagePrice,
          });
        }
      });
    });

    return Array.from(pointMap.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((entry) => ({
        ...entry,
        dateLabel: entry.rawDate.toLocaleDateString(),
      }));
  }, [resolvedSeries, hasData]);

  if (!hasData) {
    return (
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          {emptyMessage || 'No data available for the selected period'}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLine data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => formatPrice(value)} />
            <Tooltip
              formatter={(value: number, name: string) => [formatPrice(value), name]}
              itemSorter={(item) => (typeof item.value === 'number' ? -item.value : 0)}
              labelFormatter={(_, payload) => {
                if (!payload || payload.length === 0) return '';
                const rawDate = payload[0]?.payload?.rawDate;
                if (rawDate instanceof Date) {
                  return `${rawDate.toLocaleDateString()} ${rawDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`;
                }
                return '';
              }}
              labelStyle={{ color: '#374151', fontWeight: 600 }}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            {resolvedSeries.map((serie) => (
              <Line
                key={serie.id}
                type="monotone"
                dataKey={serie.id}
                name={serie.label}
                stroke={serie.color}
                strokeWidth={2}
                dot={{ fill: serie.color, r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </RechartsLine>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default LineChart;

