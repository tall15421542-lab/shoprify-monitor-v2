import { useQuery } from '@tanstack/react-query';
import { getProductChangelogs, getStoreChangelogs, getTagChangelogs, getStoreTagChangelogs } from '../services/api';
import type { ChangelogParams } from '../types';

export const useProductChangelogs = (params: ChangelogParams) => {
  return useQuery({
    queryKey: ['changelogs', 'products', params],
    queryFn: () => getProductChangelogs(params),
  });
};

export const useStoreChangelogs = (storeId: string, params: ChangelogParams) => {
  return useQuery({
    queryKey: ['changelogs', 'store', storeId, params],
    queryFn: () => getStoreChangelogs(storeId, params),
  });
};

export const useTagChangelogs = (tag: string, params: ChangelogParams) => {
  return useQuery({
    queryKey: ['changelogs', 'tag', tag, params],
    queryFn: () => getTagChangelogs(tag, params),
  });
};

export const useStoreTagChangelogs = (storeId: string, tag: string, params: ChangelogParams) => {
  return useQuery({
    queryKey: ['changelogs', 'store-tag', storeId, tag, params],
    queryFn: () => getStoreTagChangelogs(storeId, tag, params),
  });
};

