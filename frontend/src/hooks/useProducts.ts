import { useQuery } from '@tanstack/react-query';
import { getStoreProducts, getProduct, getProductPriceHistory } from '../services/api';

export const useStoreProducts = (storeId: string | undefined) => {
  return useQuery({
    queryKey: ['products', storeId],
    queryFn: () => getStoreProducts(storeId!),
    enabled: !!storeId,
  });
};

export const useProduct = (productId: string | undefined) => {
  return useQuery({
    queryKey: ['products', 'detail', productId],
    queryFn: () => getProduct(productId!),
    enabled: !!productId,
  });
};

export const usePriceHistory = (
  productId: string | undefined,
  startDate: Date,
  endDate: Date
) => {
  return useQuery({
    queryKey: ['priceHistory', productId, startDate.toISOString(), endDate.toISOString()],
    queryFn: () => getProductPriceHistory(productId!, { startDate, endDate }),
    enabled: !!productId,
  });
};

