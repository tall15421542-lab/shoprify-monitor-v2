import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import type { MonitoringChangeType, MonitoringScopeKey, MonitoringScopeType } from '../../types';
import Modal from '../common/Modal';
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
  autoSubscribe?: boolean;
  defaultChangeType?: MonitoringChangeType;
  defaultIntervalMinutes?: number;
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
  description,
  buttonVariant = 'primary',
  buttonSize = 'md',
  disabled,
  className,
  autoSubscribe = false,
  defaultChangeType,
  defaultIntervalMinutes,
  onSubscriptionSuccess,
}: MonitoringSubscribeButtonProps) {
  const { showToast } = useToast();
  const createMutation = useCreateMonitoringSubscription();
  const [isOpen, setIsOpen] = useState(false);
  const effectiveDefaultChangeType = defaultChangeType ?? 'both';
  const effectiveDefaultInterval = defaultIntervalMinutes ?? 60;
  const [changeType, setChangeType] = useState<MonitoringChangeType>(effectiveDefaultChangeType);
  const [intervalMinutesInput, setIntervalMinutesInput] = useState<string>(String(effectiveDefaultInterval));
  const [errors, setErrors] = useState<string | null>(null);
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

  useEffect(() => {
    if (!isOpen) {
      setChangeType(effectiveDefaultChangeType);
      setIntervalMinutesInput(String(effectiveDefaultInterval));
    }
  }, [effectiveDefaultChangeType, effectiveDefaultInterval, isOpen]);

  const executeSubscriptions = async (
    selectedChangeType: MonitoringChangeType,
    intervalMinutes: number,
    { closeOnSuccess }: { closeOnSuccess: boolean }
  ) => {
    setErrors(null);
    setIsSubmitting(true);
    try {
      const results = await Promise.allSettled(
        uniqueTargets.map((target) =>
          createMutation.mutateAsync({
            scopeType: target.scopeType,
            scope: target.scope,
            changeType: selectedChangeType,
            intervalMinutes,
          })
        )
      );

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter(
        (result) => result.status === 'rejected'
      ) as PromiseRejectedResult[];
      const successDetails = results.reduce<Array<{ target: SubscriptionTarget; data: unknown }>>(
        (acc, result, index) => {
          if (result.status === 'fulfilled') {
            acc.push({
              target: uniqueTargets[index],
              data: result.value,
            });
          }
          return acc;
        },
        []
      );

      if (fulfilled.length > 0) {
        const successMessage =
          fulfilled.length === 1
            ? `Subscription created for ${uniqueTargets[0].label}`
            : `${fulfilled.length} subscriptions created`;
        showToast('success', successMessage);
        if (successDetails.length > 0) {
          onSubscriptionSuccess?.(successDetails);
        }
      }

      if (rejected.length > 0) {
        const message = rejected
          .map((item) => {
            const error = item.reason as Error;
            return error?.message || 'Unknown error';
          })
          .join('; ');
        showToast(
          'error',
          `Failed to create ${rejected.length} subscription${rejected.length > 1 ? 's' : ''}: ${message}`
        );
      }

      if (closeOnSuccess && rejected.length === 0) {
        setIsOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubscribe = async () => {
    if (effectiveDefaultInterval <= 0) {
      showToast('error', 'Subscription interval must be a positive integer.');
      return;
    }

    await executeSubscriptions(effectiveDefaultChangeType, effectiveDefaultInterval, {
      closeOnSuccess: false,
    });
  };

  const handleOpen = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (effectiveDisabled) {
      return;
    }
    if (autoSubscribe) {
      await handleAutoSubscribe();
      return;
    }
    setErrors(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setIsOpen(false);
    setErrors(null);
  };

  const handleSubmit = async () => {
    const parsedInterval = Number(intervalMinutesInput);
    if (!intervalMinutesInput || Number.isNaN(parsedInterval) || parsedInterval <= 0) {
      setErrors('Interval must be a positive integer.');
      return;
    }

    if (uniqueTargets.length === 0) {
      setErrors('No targets selected for subscription.');
      return;
    }

    await executeSubscriptions(changeType, parsedInterval, { closeOnSuccess: true });
  };

  const buttonClasses = `${getButtonClasses(buttonVariant, buttonSize)} ${className || ''}`;

  return (
    <>
      <button
        type="button"
        className={buttonClasses.trim()}
        onClick={handleOpen}
        disabled={effectiveDisabled || isSubmitting}
      >
        {label}
        {uniqueTargets.length > 1 ? ` (${uniqueTargets.length})` : ''}
      </button>

      <Modal isOpen={isOpen} onClose={handleClose} title="Create Monitoring Subscription" size="md">
        <div className="space-y-6">
          {description && <p className="text-sm text-gray-600">{description}</p>}

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Targets</h4>
            <ul className="space-y-1 text-sm text-gray-700">
              {uniqueTargets.map((target) => (
                <li key={`${target.scopeType}-${JSON.stringify(target.scope)}`} className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 uppercase">
                    {target.scopeType.replace(/_/g, ' ')}
                  </span>
                  <span>{target.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Change Type</h4>
            <div className="flex gap-4 text-sm text-gray-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="change-type"
                  value="price_up"
                  checked={changeType === 'price_up'}
                  onChange={() => setChangeType('price_up')}
                  className="form-radio text-primary-600 h-4 w-4"
                />
                Price goes up
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="change-type"
                  value="price_down"
                  checked={changeType === 'price_down'}
                  onChange={() => setChangeType('price_down')}
                  className="form-radio text-primary-600 h-4 w-4"
                />
                Price goes down
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="change-type"
                  value="both"
                  checked={changeType === 'both'}
                  onChange={() => setChangeType('both')}
                  className="form-radio text-primary-600 h-4 w-4"
                />
                Any change
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="interval-minutes" className="label">
              Interval (minutes)
            </label>
            <input
              id="interval-minutes"
              type="number"
              min={1}
              value={intervalMinutesInput}
              onChange={(event) => setIntervalMinutesInput(event.target.value)}
              className="input-field w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Subscriptions compare new data against the last change at or before this interval.</p>
          </div>

          {errors && <p className="text-sm text-red-600">{errors}</p>}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : `Create ${uniqueTargets.length > 1 ? 'Subscriptions' : 'Subscription'}`}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default MonitoringSubscribeButton;


