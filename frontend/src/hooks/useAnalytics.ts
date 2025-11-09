import { useQuery } from '@tanstack/react-query';
import {
  getAveragePriceByStore,
  getAveragePriceByTag,
  getAveragePriceByStoreAndTag,
} from '../services/api';
import type { AnalyticsParams } from '../types';

export const useAveragePriceByStore = (
  storeId: string | undefined,
  params: AnalyticsParams
) => {
  return useQuery({
    queryKey: ['analytics', 'store', storeId, params],
    queryFn: () => getAveragePriceByStore(storeId!, params),
    enabled: !!storeId,
  });
};

export const useAveragePriceByTag = (
  tag: string | undefined,
  params: AnalyticsParams
) => {
  return useQuery({
    queryKey: ['analytics', 'tag', tag, params],
    queryFn: () => getAveragePriceByTag(tag!, params),
    enabled: !!tag,
  });
};

export const useAveragePriceByStoreAndTag = (
  storeId: string | undefined,
  tag: string | undefined,
  params: AnalyticsParams
) => {
  return useQuery({
    queryKey: ['analytics', 'store-tag', storeId, tag, params],
    queryFn: () => getAveragePriceByStoreAndTag(storeId!, tag!, params),
    enabled: !!storeId && !!tag,
  });
};

