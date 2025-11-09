export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
};

export const calculatePriceChange = (
  currentPrice: number,
  previousPrice?: number
): { change: number; changePercent: number } | null => {
  if (!previousPrice || previousPrice === 0) return null;

  const change = currentPrice - previousPrice;
  const changePercent = (change / previousPrice) * 100;

  return { change, changePercent };
};

export const getPriceChangeType = (change: number): 'increase' | 'decrease' | 'none' => {
  if (change > 0) return 'increase';
  if (change < 0) return 'decrease';
  return 'none';
};

