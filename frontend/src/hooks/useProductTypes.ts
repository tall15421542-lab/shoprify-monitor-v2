import { useQuery } from '@tanstack/react-query';
import { getAllProductTypes, getStoreProductTypes } from '../services/api';

export const useProductTypes = (storeId?: string) => {
  return useQuery({
    queryKey: storeId ? ['product-types', 'store', storeId] : ['product-types'],
    queryFn: () => storeId ? getStoreProductTypes(storeId) : getAllProductTypes(),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
};
