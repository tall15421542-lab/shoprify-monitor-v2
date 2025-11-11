import { useMemo, useState, type MouseEvent } from 'react';
import type { MonitoringChangeType, MonitoringScopeKey, MonitoringScopeType } from '../../types';
import { useToast } from '../common/ToastContainer';
import { useCreateMonitoringSubscription } from '../../hooks/useMonitoringSubscriptions';

export interface SubscriptionTarget {
  scopeType: MonitoringScopeType;
  scope: MonitoringScopeKey;
  label: string;
}

interface MonitoringSubscribeButtonProps {
  targets: SubscriptionTarget[];
  label?: string;
  description?: string;
  buttonVariant?: 'primary' | 'secondary' | 'ghost' | 'success';
  buttonSize?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  defaultChangeType?: MonitoringChangeType;
  onSubscriptionSuccess?: (
    successes: Array<{
      target: SubscriptionTarget;
      data: unknown;
    }>
  ) => void;
}

function getButtonClasses(variant: 'primary' | 'secondary' | 'ghost' | 'success', size: 'sm' | 'md'): string {
  const base =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizeClass = size === 'sm' ? 'px-3 py-1 text-sm' : 'px-4 py-2 text-sm';

  switch (variant) {
    case 'success':
      return `${base} ${sizeClass} bg-emerald-600 hover:bg-emerald-700 text-white focus-visible:ring-emerald-500`;
    case 'secondary':
      return `${base} ${sizeClass} bg-gray-100 hover:bg-gray-200 text-gray-700 focus-visible:ring-gray-400`;
    case 'ghost':
      return `${base} ${sizeClass} bg-transparent hover:bg-gray-100 text-gray-700 focus-visible:ring-gray-400`;
    case 'primary':
    default:
      return `${base} ${sizeClass} bg-primary-600 hover:bg-primary-700 text-white focus-visible:ring-primary-500`;
  }
}

function MonitoringSubscribeButton({
  targets,
  label = 'Subscribe',
  description: _description,
  buttonVariant = 'primary',
  buttonSize = 'md',
  disabled,
  className,
  defaultChangeType = 'both',
  onSubscriptionSuccess,
}: MonitoringSubscribeButtonProps) {
  const { showToast } = useToast();
  const createMutation = useCreateMonitoringSubscription();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uniqueTargets = useMemo(() => {
    const seen = new Set<string>();
    return targets.filter((target) => {
      const key = `${target.scopeType}:${JSON.stringify(target.scope)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [targets]);

  const effectiveDisabled = disabled || uniqueTargets.length === 0;

  const executeSubscriptions = async () => {
    setIsSubmitting(true);
    try {
      const results = await Promise.allSettled(
        uniqueTargets.map((target) =>
          createMutation.mutateAsync({
            scopeType: target.scopeType,
            scope: target.scope,
            changeType: defaultChangeType,
          })
        )
      );

      const successDetails: Array<{ target: SubscriptionTarget; data: unknown }> = [];
      let fulfilledCount = 0;
      const errors: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          fulfilledCount += 1;
          successDetails.push({
            target: uniqueTargets[index],
            data: result.value,
          });
        } else {
          const message = (result.reason as Error)?.message ?? 'Unknown error';
          errors.push(message);
        }
      });

      if (fulfilledCount > 0) {
        const successMessage =
          fulfilledCount === 1
            ? `Subscription created for ${uniqueTargets[0].label}`
            : `${fulfilledCount} subscriptions created`;
        showToast('success', successMessage);
        if (successDetails.length > 0) {
          onSubscriptionSuccess?.(successDetails);
        }
      }

      if (errors.length > 0) {
        const errorMessage =
          errors.length === 1
            ? `Failed to create subscription: ${errors[0]}`
            : `Failed to create ${errors.length} subscriptions: ${errors.join('; ')}`;
        showToast('error', errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (effectiveDisabled) {
      return;
    }
    if (isSubmitting) {
      return;
    }
    await executeSubscriptions();
  };

  const buttonClasses = `${getButtonClasses(buttonVariant, buttonSize)} ${className || ''}`;

  const buttonLabel = isSubmitting
    ? 'Subscribing...'
    : `${label}${uniqueTargets.length > 1 ? ` (${uniqueTargets.length})` : ''}`;

  return (
    <button
      type="button"
      className={buttonClasses.trim()}
      onClick={handleClick}
      disabled={effectiveDisabled || isSubmitting}
    >
      {buttonLabel}
    </button>
  );
}

export default MonitoringSubscribeButton;


