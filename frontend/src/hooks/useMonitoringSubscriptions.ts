import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMonitoringSubscriptions,
  createMonitoringSubscription,
  updateMonitoringSubscription,
  deleteMonitoringSubscription,
} from '../services/api';
import type {
  CreateMonitoringSubscriptionInput,
  MonitoringSubscription,
} from '../types';

const SUBSCRIPTIONS_QUERY_KEY = ['monitoring', 'subscriptions'];

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
    },
  });
}

export function useDeleteMonitoringSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscriptionId: string) =>
      deleteMonitoringSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
    },
  });
}


