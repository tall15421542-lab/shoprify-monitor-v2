import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStores, addStore, getStore } from '../services/api';
import type { AddStoreData } from '../types';

export const useStores = () => {
  return useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });
};

export const useStore = (storeId: string | undefined) => {
  return useQuery({
    queryKey: ['stores', storeId],
    queryFn: () => getStore(storeId!),
    enabled: !!storeId,
  });
};

export const useAddStore = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddStoreData) => addStore(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });
};

