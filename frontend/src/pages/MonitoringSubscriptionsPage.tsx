import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, PencilLine, Trash2, AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MonitoringSubscriptionList, {
  formatChangeType,
  formatScope,
  formatScopeTypeLabel,
} from '../components/monitoring/MonitoringSubscriptionList';
import MonitoringSubscriptionForm, {
  SubscriptionFormValues,
} from '../components/monitoring/MonitoringSubscriptionForm';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { useToast } from '../components/common/ToastContainer';
import {
  useMonitoringSubscriptions,
  useCreateMonitoringSubscription,
  useUpdateMonitoringSubscription,
  useDeleteMonitoringSubscription,
} from '../hooks/useMonitoringSubscriptions';
import {
  useMarkMonitoringChangeLogsRead,
  useMonitoringChangeLogs,
} from '../hooks/useMonitoringChangeLogs';
import MonitoringChangeLogTable from '../components/monitoring/MonitoringChangeLogTable';
import LineChart, { type LineChartSeries } from '../components/charts/LineChart';
import { useStores } from '../hooks/useStores';
import type {
  MonitoringChangeLogParams,
  MonitoringChangeLogEntry,
  MonitoringChangeLogResponse,
  MonitoringSubscription,
} from '../types';

function subscriptionToFormValues(
  subscription: MonitoringSubscription
): SubscriptionFormValues {
  const { scopeType, scope } = subscription;
  switch (scopeType) {
    case 'store':
      return {
        scopeType,
        storeId: scope.storeId ?? '',
        productId: '',
        productType: '',
        changeType: subscription.changeType,
      };
    case 'product':
      return {
        scopeType,
        storeId: scope.storeId ?? '',
        productId: scope.productId ?? '',
        productType: '',
        changeType: subscription.changeType,
      };
    case 'product_type':
      return {
        scopeType,
        storeId: '',
        productId: '',
        productType: scope.productType ?? '',
        changeType: subscription.changeType,
      };
    case 'store_product_type':
      return {
        scopeType,
        storeId: scope.storeId ?? '',
        productId: '',
        productType: scope.productType ?? '',
        changeType: subscription.changeType,
      };
    default:
      return {
        scopeType: 'store',
        storeId: '',
        productId: '',
        productType: '',
        changeType: subscription.changeType,
      };
  }
}

function buildScopeFromForm(values: SubscriptionFormValues) {
  switch (values.scopeType) {
    case 'store':
      return { storeId: values.storeId.trim() };
    case 'product':
      return {
        storeId: values.storeId.trim(),
        productId: values.productId.trim(),
      };
    case 'product_type':
      return {
        productType: values.productType.trim(),
      };
    case 'store_product_type':
      return {
        storeId: values.storeId.trim(),
        productType: values.productType.trim(),
      };
    default:
      return {};
  }
}

function MonitoringSubscriptionsPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const subscriptionIdParam = searchParams.get('subscriptionId');
  const changeLogIdParam = searchParams.get('changeLogId');
  const {
    data: subscriptions,
    isLoading: subscriptionsLoading,
    error: subscriptionsError,
  } = useMonitoringSubscriptions();
  const {
    data: stores,
    isLoading: storesLoading,
    error: storesError,
  } = useStores();

  const createMutation = useCreateMonitoringSubscription();
  const updateMutation = useUpdateMonitoringSubscription();
  const deleteMutation = useDeleteMonitoringSubscription();

  const [selectedId, setSelectedIdState] = useState<string | null>(subscriptionIdParam);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] =
    useState<MonitoringSubscription | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [highlightedEntryIds, setHighlightedEntryIds] = useState<Set<string>>(
    changeLogIdParam ? new Set([changeLogIdParam]) : new Set()
  );
  const manualHighlightEntryIdRef = useRef<string | null>(changeLogIdParam);
  const acknowledgedEntryIdsRef = useRef<Set<string>>(new Set());
  const disabledChangeLogParams = useMemo<MonitoringChangeLogParams>(
    () => ({ limit: 0, offset: 0 }),
    []
  );

  const updateSelectedId = useCallback(
    (id: string | null, options?: { replace?: boolean }) => {
      setSelectedIdState((prev: string | null) => {
        if (prev === id) {
          return prev;
        }
        return id;
      });

      manualHighlightEntryIdRef.current = null;

      const nextParams = new URLSearchParams(searchParams);
      if (id) {
        nextParams.set('subscriptionId', id);
      } else {
        nextParams.delete('subscriptionId');
      }
      nextParams.delete('changeLogId');

      const nextString = nextParams.toString();
      const currentString = searchParams.toString();
      const replace = options?.replace ?? true;

      if (nextString !== currentString || replace === false) {
        setSearchParams(nextParams, { replace });
      }
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    if (subscriptionIdParam && subscriptionIdParam !== selectedId) {
      setSelectedIdState(subscriptionIdParam);
    }
    if (!subscriptionIdParam && selectedId !== null) {
      setSelectedIdState(null);
    }
  }, [selectedId, subscriptionIdParam]);

  const sortedSubscriptions = useMemo(() => {
    if (!subscriptions) {
      return [];
    }
    return [...subscriptions].sort((a, b) => {
      const aTime =
        a.unreadUpdatedAt?.getTime() ??
        a.updatedAt.getTime() ??
        a.createdAt.getTime();
      const bTime =
        b.unreadUpdatedAt?.getTime() ??
        b.updatedAt.getTime() ??
        b.createdAt.getTime();
      return bTime - aTime;
    });
  }, [subscriptions]);

  useEffect(() => {
    if (!sortedSubscriptions.length) {
      if (!subscriptionsLoading && selectedId !== null) {
        updateSelectedId(null, { replace: true });
      }
      return;
    }
    const hasSelected =
      selectedId && sortedSubscriptions.some((item) => item.id === selectedId);
    if (!hasSelected) {
      updateSelectedId(sortedSubscriptions[0].id, { replace: true });
    }
  }, [sortedSubscriptions, selectedId, subscriptionsLoading, updateSelectedId]);

  const storeLookup = useMemo(() => {
    if (!stores) {
      return new Map<string, string>();
    }
    return new Map(stores.map((store) => [store._id, store.name]));
  }, [stores]);

  const storeOptions = useMemo(
    () =>
      stores?.map((store) => ({
        id: store._id,
        name: store.name,
      })) ?? [],
    [stores]
  );

  const selectedSubscription = useMemo(
    () =>
      sortedSubscriptions.find((subscription) => subscription.id === selectedId) ??
      null,
    [sortedSubscriptions, selectedId]
  );

  const selectedScopeLabel = useMemo(() => {
    if (!selectedSubscription) {
      return null;
    }
    return formatScope(selectedSubscription, (storeId) => storeLookup.get(storeId));
  }, [selectedSubscription, storeLookup]);

  const changeLogParams = useMemo<MonitoringChangeLogParams | null>(() => {
    if (!selectedSubscription) {
      return null;
    }
    return {
      subscriptionId: selectedSubscription.id,
      limit: 100,
      offset: 0,
    };
  }, [selectedSubscription]);

  const {
    data: changeLogResponse,
    isLoading: changeLogsLoading,
    error: changeLogsError,
  } = useMonitoringChangeLogs(changeLogParams ?? disabledChangeLogParams, Boolean(changeLogParams));

  const { mutateAsync: acknowledgeChangeLogs } = useMarkMonitoringChangeLogsRead();

  const changeLogEntries = useMemo<MonitoringChangeLogEntry[]>(() => {
    const responseEntries =
      (changeLogResponse as MonitoringChangeLogResponse | undefined)?.entries ?? [];
    const unreadSnapshots = selectedSubscription?.unreadChangeLogs ?? [];

    if (unreadSnapshots.length === 0) {
      return [...responseEntries];
    }

    const merged = new Map<string, MonitoringChangeLogEntry>();

    unreadSnapshots.forEach((entry: MonitoringChangeLogEntry) => {
      merged.set(entry.id, entry);
    });

    responseEntries.forEach((entry: MonitoringChangeLogEntry) => {
      const cached = merged.get(entry.id);
      if (!cached) {
        merged.set(entry.id, entry);
        return;
      }
      if (cached.readAt !== entry.readAt) {
        merged.set(entry.id, entry);
      }
    });

    return Array.from(merged.values());
  }, [changeLogResponse, selectedSubscription]);

  const sortedChangeLogEntries = useMemo(
    () =>
      changeLogEntries.slice().sort(
        (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()
      ),
    [changeLogEntries]
  );

  const changeLogTrendSeries = useMemo<LineChartSeries | null>(() => {
    const points = sortedChangeLogEntries
      .filter(
        (entry) =>
          entry.currentValue !== null &&
          typeof entry.currentValue === 'number' &&
          Number.isFinite(entry.currentValue)
      )
      .map((entry) => ({
        timestamp: entry.detectedAt,
        averagePrice: entry.currentValue as number,
        productCount: 1,
      }));

    if (points.length < 2) {
      return null;
    }

    return {
      id: 'currentValue',
      label: 'Current Value',
      data: points,
    };
  }, [sortedChangeLogEntries]);

  useEffect(() => {
    acknowledgedEntryIdsRef.current.clear();
    setHighlightedEntryIds(() => {
      if (manualHighlightEntryIdRef.current) {
        const highlightId = manualHighlightEntryIdRef.current;
        manualHighlightEntryIdRef.current = null;
        return new Set([highlightId]);
      }
      return new Set();
    });
  }, [selectedSubscription?.id]);

  useEffect(() => {
    if (!changeLogIdParam) {
      return;
    }
    manualHighlightEntryIdRef.current = changeLogIdParam;
    setHighlightedEntryIds((prev: Set<string>) => {
      if (prev.has(changeLogIdParam)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(changeLogIdParam);
      return next;
    });
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('changeLogId');
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [changeLogIdParam, searchParams, setSearchParams]);

  useEffect(() => {
    if (
      !selectedSubscription ||
      changeLogsLoading ||
      changeLogEntries.length === 0
    ) {
      return;
    }

    const unreadEntries = changeLogEntries.filter(
      (entry: MonitoringChangeLogEntry) => !entry.readAt && !entry.isBaseline
    );
    if (unreadEntries.length === 0) {
      return;
    }

    const idsToAcknowledge = unreadEntries
      .map((entry: MonitoringChangeLogEntry) => entry.id)
      .filter((id: string) => !acknowledgedEntryIdsRef.current.has(id));

    if (idsToAcknowledge.length === 0) {
      return;
    }

    setHighlightedEntryIds((prev: Set<string>) => {
      const next = new Set(prev);
      idsToAcknowledge.forEach((id) => next.add(id));
      return next;
    });

      idsToAcknowledge.forEach((id: string) => acknowledgedEntryIdsRef.current.add(id));

    void acknowledgeChangeLogs(idsToAcknowledge).catch(() => {
      idsToAcknowledge.forEach((id: string) => acknowledgedEntryIdsRef.current.delete(id));
    });
  }, [acknowledgeChangeLogs, changeLogEntries, changeLogsLoading, selectedSubscription]);

  const handleCreate = async (values: SubscriptionFormValues) => {
    setFormError(null);
    const scope = buildScopeFromForm(values);
    await createMutation.mutateAsync({
      scopeType: values.scopeType,
      scope,
      changeType: values.changeType,
    });
    showToast('success', 'Subscription created successfully.');
    setIsCreateOpen(false);
  };

  const handleUpdate = async (
    subscription: MonitoringSubscription,
    values: SubscriptionFormValues
  ) => {
    setFormError(null);
    const scope = buildScopeFromForm(values);
    await updateMutation.mutateAsync({
      id: subscription.id,
      input: {
        scopeType: values.scopeType,
        scope,
        changeType: values.changeType,
      },
    });
    showToast('success', 'Subscription updated successfully.');
    setEditingSubscription(null);
  };

  const handleDelete = async (subscription: MonitoringSubscription) => {
    const confirmed = window.confirm(
      `Delete subscription for ${subscription.scopeType.replace(/_/g, ' ')}?`
    );
    if (!confirmed) {
      return;
    }
    try {
      setDeletingId(subscription.id);
      await deleteMutation.mutateAsync(subscription.id);
      showToast('success', 'Subscription deleted.');
      if (selectedId === subscription.id) {
        updateSelectedId(null, { replace: true });
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.error ??
        error?.message ??
        'Failed to delete subscription.';
      showToast('error', message);
    } finally {
      setDeletingId(null);
    }
  };

  const renderBody = () => {
    if (subscriptionsLoading || storesLoading) {
      return (
        <div className="flex justify-center items-center min-h-[240px]">
          <LoadingSpinner size={48} />
        </div>
      );
    }

    if (subscriptionsError) {
      return (
        <ErrorMessage message="Failed to load subscriptions. Please refresh and try again." />
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">
            No monitoring subscriptions yet. Create your first subscription to start tracking price changes.
          </p>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => {
              setFormError(null);
              setIsCreateOpen(true);
            }}
          >
            <Plus size={16} />
            Add Subscription
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Subscriptions</h2>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              onClick={() => {
                setFormError(null);
                setIsCreateOpen(true);
              }}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
          <MonitoringSubscriptionList
            subscriptions={sortedSubscriptions}
            selectedId={selectedId ?? undefined}
            onSelect={(subscription) => updateSelectedId(subscription.id, { replace: false })}
            onDelete={handleDelete}
            deletingId={deletingId}
            storeNameLookup={(storeId) => storeLookup.get(storeId)}
          />
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selectedSubscription ? (
            <>
              <div className="card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {formatScopeTypeLabel(selectedSubscription.scopeType)}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Alerts on: {formatChangeType(selectedSubscription.changeType)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary inline-flex items-center gap-2"
                      onClick={() => {
                        setFormError(null);
                        setEditingSubscription(selectedSubscription);
                      }}
                    >
                      <PencilLine size={16} />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-secondary inline-flex items-center gap-2"
                      onClick={() => handleDelete(selectedSubscription)}
                      disabled={deletingId === selectedSubscription.id}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Scope</p>
                    <p className="font-medium">
                      {selectedScopeLabel ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Unread Changes</p>
                    <p className="font-medium">{selectedSubscription.unreadCount}</p>
                    {selectedSubscription.unreadCount > 0 && (
                      <p className="text-xs text-amber-600 mt-1 inline-flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Mark changes as read to reset the counter.
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Created</p>
                    <p className="font-medium">
                      {selectedSubscription.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Last Updated</p>
                    <p className="font-medium">
                      {selectedSubscription.updatedAt.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">
                      Change History
                    </h4>
                    <p className="text-sm text-gray-600">
                      Review the most recent detected changes for this subscription.
                    </p>
                  </div>
                </div>

                {changeLogParams ? (
                  changeLogsLoading ? (
                    <div className="card flex justify-center items-center min-h-[200px]">
                      <LoadingSpinner size={40} />
                    </div>
                  ) : changeLogsError ? (
                    <ErrorMessage message="Failed to load change history. Please try again." />
                  ) : (
                    <div className="space-y-4">
                      {changeLogTrendSeries ? (
                        <LineChart
                          title="Value Trend"
                          series={[changeLogTrendSeries]}
                          emptyMessage="Not enough data to render trend."
                        />
                      ) : null}
                      <MonitoringChangeLogTable
                        entries={sortedChangeLogEntries}
                        storeNameLookup={(storeId) => storeLookup.get(storeId)}
                        highlightedEntryIds={highlightedEntryIds}
                      />
                    </div>
                  )
                ) : null}
              </div>
            </>
          ) : (
            <div className="card py-12 text-center text-gray-600">
              Select a subscription from the list to view details.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Monitoring Subscriptions</h1>
        <p className="text-gray-600">
          Create, edit, and delete monitoring subscriptions to track significant changes across stores, products, and product types.
        </p>
        {storesError && (
          <p className="text-sm text-amber-600 mt-2">
            Unable to load store metadata. You can still manage subscriptions using raw identifiers.
          </p>
        )}
      </div>

      {renderBody()}

      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => {
            if (!createMutation.isPending) {
              setIsCreateOpen(false);
            }
          }}
          title="Add Subscription"
          size="xl"
        >
          <MonitoringSubscriptionForm
            mode="create"
            submitting={createMutation.isPending}
            onSubmit={handleCreate}
            onCancel={() => {
              if (!createMutation.isPending) {
                setIsCreateOpen(false);
              }
            }}
            errorMessage={formError}
            storeOptions={storeOptions}
          />
        </Modal>
      )}

      {editingSubscription && (
        <Modal
          isOpen={!!editingSubscription}
          onClose={() => {
            if (!updateMutation.isPending) {
              setEditingSubscription(null);
            }
          }}
          title="Edit Subscription"
          size="xl"
        >
          <MonitoringSubscriptionForm
            mode="edit"
            initialValues={subscriptionToFormValues(editingSubscription)}
            submitting={updateMutation.isPending}
            onSubmit={(values) => handleUpdate(editingSubscription, values)}
            onCancel={() => {
              if (!updateMutation.isPending) {
                setEditingSubscription(null);
              }
            }}
            errorMessage={formError}
            storeOptions={storeOptions}
          />
        </Modal>
      )}
    </div>
  );
}

export default MonitoringSubscriptionsPage;


