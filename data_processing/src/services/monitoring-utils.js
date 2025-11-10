export function calculateAveragePrice(variants) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return null;
  }

  const prices = variants
    .map((variant) => variant.price ?? variant.current_price)
    .filter((value) => typeof value === 'number');

  if (prices.length === 0) {
    return null;
  }

  const total = prices.reduce((sum, value) => sum + value, 0);
  return Number((total / prices.length).toFixed(2));
}

export function calculateChangeMetrics(previousValue, currentValue) {
  if (previousValue === null || previousValue === undefined || currentValue === null || currentValue === undefined) {
    return {
      absolute_change: null,
      percentage_change: null
    };
  }

  const absoluteChange = Number((currentValue - previousValue).toFixed(2));
  const percentageChange = previousValue === 0
    ? null
    : Number(((absoluteChange / previousValue) * 100).toFixed(2));

  return {
    absolute_change: absoluteChange,
    percentage_change: percentageChange
  };
}

export function computeScopeHash(scopeType, scopeKey) {
  switch (scopeType) {
    case 'product':
      return `product:${scopeKey.store_id}:${scopeKey.product_id}`;
    case 'store':
      return `store:${scopeKey.store_id}`;
    case 'product_type':
      return `product_type:${scopeKey.product_type}`;
    case 'store_product_type':
      return `store_product_type:${scopeKey.store_id}:${scopeKey.product_type}`;
    default:
      throw new Error(`Unsupported scope type: ${scopeType}`);
  }
}

