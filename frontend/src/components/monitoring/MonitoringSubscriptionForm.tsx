import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { MonitoringChangeType, MonitoringScopeType } from '../../types';

export interface SubscriptionFormValues {
  scopeType: MonitoringScopeType;
  storeId: string;
  productId: string;
  productType: string;
  changeType: MonitoringChangeType;
}

export interface MonitoringSubscriptionFormProps {
  mode: 'create' | 'edit';
  initialValues?: SubscriptionFormValues;
  onSubmit: (values: SubscriptionFormValues) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  errorMessage?: string | null;
  storeOptions?: Array<{ id: string; name: string }>;
  productTypeOptions?: string[];
  allowedScopeTypes?: MonitoringScopeType[];
}

const DEFAULT_VALUES: SubscriptionFormValues = {
  scopeType: 'store',
  storeId: '',
  productId: '',
  productType: '',
  changeType: 'both',
};

function areSubscriptionFormValuesEqual(
  a: SubscriptionFormValues,
  b: SubscriptionFormValues
) {
  return (
    a.scopeType === b.scopeType &&
    a.storeId === b.storeId &&
    a.productId === b.productId &&
    a.productType === b.productType &&
    a.changeType === b.changeType
  );
}

function MonitoringSubscriptionForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  submitting = false,
  errorMessage,
  storeOptions = [],
  productTypeOptions = [],
  allowedScopeTypes,
}: MonitoringSubscriptionFormProps) {
  const [values, setValues] = useState<SubscriptionFormValues>(
    initialValues ?? { ...DEFAULT_VALUES }
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const previousInitialValuesRef = useRef<SubscriptionFormValues | null>(
    initialValues ? { ...initialValues } : null
  );

  const storeDatalistId = useId();
  const productTypeDatalistId = useId();

  const availableScopeTypes = useMemo<MonitoringScopeType[]>(() => {
    if (allowedScopeTypes && allowedScopeTypes.length > 0) {
      return allowedScopeTypes;
    }
    return ['store', 'product', 'product_type', 'store_product_type'];
  }, [allowedScopeTypes]);

  const handleChange =
    (field: keyof SubscriptionFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const rawValue = event.target.value;

      const value = rawValue as SubscriptionFormValues[typeof field];
      setValues((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const applyScopeType = useCallback((scopeType: MonitoringScopeType) => {
    setValues((prev) => {
      switch (scopeType) {
        case 'store':
          return { ...prev, scopeType, productId: '', productType: '' };
        case 'product':
          return { ...prev, scopeType, productType: '' };
        case 'product_type':
          return { ...prev, scopeType, storeId: '', productId: '' };
        case 'store_product_type':
          return { ...prev, scopeType, productId: '' };
        default:
          return { ...prev, scopeType };
      }
    });
  }, []);

  const handleScopeTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const scopeType = event.target.value as MonitoringScopeType;
    applyScopeType(scopeType);
  };

  useEffect(() => {
    if (!initialValues) {
      previousInitialValuesRef.current = null;
      return;
    }

    const previousInitialValues = previousInitialValuesRef.current;
    if (
      previousInitialValues &&
      areSubscriptionFormValuesEqual(previousInitialValues, initialValues)
    ) {
      return;
    }

    previousInitialValuesRef.current = { ...initialValues };
    setValues({ ...initialValues });
  }, [initialValues]);

  useEffect(() => {
    if (!availableScopeTypes.includes(values.scopeType)) {
      const nextScope = availableScopeTypes[0] ?? 'store';
      applyScopeType(nextScope);
    }
  }, [availableScopeTypes, values.scopeType, applyScopeType]);

  const validate = (): string | null => {
    switch (values.scopeType) {
      case 'store':
        if (!values.storeId.trim()) {
          return 'Store ID is required for store scope.';
        }
        break;
      case 'product':
        if (!values.storeId.trim() || !values.productId.trim()) {
          return 'Store ID and Product ID are required for product scope.';
        }
        break;
      case 'product_type':
        if (!values.productType.trim()) {
          return 'Product type is required for product type scope.';
        }
        break;
      case 'store_product_type':
        if (!values.storeId.trim() || !values.productType.trim()) {
          return 'Store ID and Product type are required for store + product type scope.';
        }
        break;
      default:
        return 'Unsupported scope type.';
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    const validationError = validate();
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    try {
      await onSubmit(values);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ??
        error?.message ??
        'Unexpected error occurred.';
      setLocalError(message);
    }
  };

  const changeTypeOptions = useMemo(
    () => [
      { value: 'price_up' as MonitoringChangeType, label: 'Price increase' },
      { value: 'price_down' as MonitoringChangeType, label: 'Price decrease' },
      { value: 'both' as MonitoringChangeType, label: 'Any change' },
    ],
    []
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mode === 'create' && (
          <div>
            <label className="label" htmlFor="scope-type">
              Scope Type
            </label>
            <select
              id="scope-type"
              className="input-field w-full"
              value={values.scopeType}
              onChange={handleScopeTypeChange}
              disabled={submitting || availableScopeTypes.length === 1}
            >
              {availableScopeTypes.map((scopeType) => (
                <option key={scopeType} value={scopeType}>
                  {scopeType === 'store'
                    ? 'Store'
                    : scopeType === 'product'
                    ? 'Product'
                    : scopeType === 'product_type'
                    ? 'Product Type'
                    : 'Store + Product Type'}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="change-type">
            Change Type
          </label>
          <select
            id="change-type"
            className="input-field w-full"
            value={values.changeType}
            onChange={handleChange('changeType')}
            disabled={submitting}
          >
            {changeTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

      </div>
      {mode === 'create' &&
        (values.scopeType === 'store' ||
          values.scopeType === 'product' ||
          values.scopeType === 'store_product_type') && (
          <div>
            <label className="label" htmlFor="store-id-input">
              Store ID
            </label>
            <input
              id="store-id-input"
              list={storeDatalistId}
              className="input-field w-full"
              placeholder="e.g. 507f1f77..."
              value={values.storeId}
              onChange={handleChange('storeId')}
              disabled={submitting}
            />
            <datalist id={storeDatalistId}>
              {storeOptions.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </datalist>
            <p className="text-xs text-gray-500 mt-1">
              {storeOptions.length > 0
                ? 'Select a store from the list or paste an ID.'
                : 'Paste the store ID targeted by this subscription.'}
            </p>
          </div>
        )}

      {mode === 'create' && values.scopeType === 'product' && (
        <div>
          <label className="label" htmlFor="product-id-input">
            Product ID
          </label>
          <input
            id="product-id-input"
            className="input-field w-full"
            placeholder="Enter product ID"
            value={values.productId}
            onChange={handleChange('productId')}
            disabled={submitting}
          />
        </div>
      )}

      {mode === 'create' &&
        (values.scopeType === 'product_type' ||
          values.scopeType === 'store_product_type') && (
          <div>
            <label className="label" htmlFor="product-type-input">
              Product Type
            </label>
            <input
              id="product-type-input"
              list={productTypeDatalistId}
              className="input-field w-full"
              placeholder="e.g. Sneakers"
              value={values.productType}
              onChange={handleChange('productType')}
              disabled={submitting}
            />
            <datalist id={productTypeDatalistId}>
              {productTypeOptions.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </div>
        )}

      {(localError || errorMessage) && (
        <div className="text-sm text-red-600">
          {localError ?? errorMessage}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting
            ? mode === 'create'
              ? 'Creating...'
              : 'Saving...'
            : mode === 'create'
            ? 'Create Subscription'
            : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

export default MonitoringSubscriptionForm;


