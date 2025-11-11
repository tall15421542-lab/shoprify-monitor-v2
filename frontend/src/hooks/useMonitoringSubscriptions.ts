import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  getMonitoringSubscriptions,
  createMonitoringSubscription,
  updateMonitoringSubscription,
  deleteMonitoringSubscription,
} from '../services/api';
import type {
  CreateMonitoringSubscriptionInput,
  MonitoringScopeKey,
  MonitoringSubscription,
} from '../types';

const SUBSCRIPTIONS_QUERY_KEY = ['monitoring', 'subscriptions'];

function invalidateMonitoringQueries(
  queryClient: QueryClient,
  scope?: MonitoringScopeKey
) {
  queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: ['stores'] });
  queryClient.invalidateQueries({ queryKey: ['product-types'] });

  const storeId = scope?.storeId;
  if (storeId) {
    queryClient.invalidateQueries({ queryKey: ['stores', storeId] });
    queryClient.invalidateQueries({ queryKey: ['product-types', 'store', storeId] });
  }
}

export function useMonitoringSubscriptions() {
  return useQuery<MonitoringSubscription[]>({
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    queryFn: getMonitoringSubscriptions,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });
}

export function useCreateMonitoringSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMonitoringSubscriptionInput) =>
      createMonitoringSubscription(input),
    onSuccess: (_created, variables) => {
      invalidateMonitoringQueries(queryClient, variables.scope);
    },
  });
}

export function useUpdateMonitoringSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: CreateMonitoringSubscriptionInput;
    }) => updateMonitoringSubscription(id, input),
    onSuccess: (updatedSubscription) => {
      queryClient.setQueryData<MonitoringSubscription[] | undefined>(
        SUBSCRIPTIONS_QUERY_KEY,
        (existing) => {
          if (!existing) {
            return existing;
          }
          return existing.map((subscription) =>
            subscription.id === updatedSubscription.id ? updatedSubscription : subscription
          );
        }
      );
      invalidateMonitoringQueries(queryClient, updatedSubscription.scope);
    },
  });
}

export function useDeleteMonitoringSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscriptionId: string) =>
      deleteMonitoringSubscription(subscriptionId),
    onSuccess: () => {
      invalidateMonitoringQueries(queryClient);
    },
  });
}


