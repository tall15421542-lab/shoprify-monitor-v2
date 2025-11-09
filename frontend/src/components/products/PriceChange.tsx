import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatPrice, getPriceChangeType } from '../../utils/price';

interface PriceChangeProps {
  change: number;
  changePercent: number;
}

function PriceChange({ change, changePercent }: PriceChangeProps) {
  const type = getPriceChangeType(change);

  const config = {
    increase: {
      icon: TrendingUp,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      sign: '+',
    },
    decrease: {
      icon: TrendingDown,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      sign: '',
    },
    none: {
      icon: Minus,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      sign: '',
    },
  };

  const { icon: Icon, color, bgColor, sign } = config[type];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${color}`}
    >
      <Icon size={14} />
      <span>
        {sign}
        {formatPrice(Math.abs(change))} ({sign}
        {Math.abs(changePercent).toFixed(1)}%)
      </span>
    </span>
  );
}

export default PriceChange;

