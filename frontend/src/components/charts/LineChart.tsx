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

interface LineChartProps {
  data: AveragePriceData[];
  title: string;
  color?: string;
}

function LineChart({ data, title, color = '#0ea5e9' }: LineChartProps) {
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map((entry) => ({
      date: new Date(entry.timestamp).toLocaleDateString(),
      price: entry.averagePrice,
    }));
  }, [data]);

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          No data available for the selected period
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
              dataKey="date"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'price') return [formatPrice(value), 'Avg Price'];
                return [value, name];
              }}
              labelStyle={{ color: '#374151', fontWeight: 600 }}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => {
                if (value === 'price') return 'Average Price';
                return value;
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </RechartsLine>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default LineChart;

