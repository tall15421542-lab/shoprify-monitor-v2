import { useQuery } from '@tanstack/react-query';
import { getAllTags, getStoreTags } from '../services/api';

export const useTags = (storeId?: string) => {
  return useQuery({
    queryKey: storeId ? ['tags', 'store', storeId] : ['tags'],
    queryFn: () => storeId ? getStoreTags(storeId) : getAllTags(),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
};

