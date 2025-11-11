import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Package, Clock, RefreshCw, Power, PauseCircle, AlertCircle } from 'lucide-react';
import type { Store as StoreType } from '../../types';
import { useToast } from '../common/ToastContainer';
import { updateStore, deactivateStore, activateStore } from '../../services/api';
import { formatPollingInterval } from '../../utils/time';
import MonitoringSubscribeButton from '../monitoring/MonitoringSubscribeButton';

interface StoreCardProps {
  store: StoreType;
  onUpdate?: () => void;
}

function StoreCard({ store, onUpdate }: StoreCardProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(
    store.monitoring?.store?.subscribed ?? false
  );

  const isActive = store.status === 'active';
  const isError = store.status === 'error';
  const subscribeLabel = isSubscribed ? 'Subscribed' : 'Subscribe';
  const subscribeVariant = isSubscribed ? 'success' : 'primary';

  useEffect(() => {
    setIsSubscribed(store.monitoring?.store?.subscribed ?? false);
  }, [store.monitoring?.store?.subscribed]);

  const handleClick = () => {
    navigate(`/stores/${store._id}/products`);
  };

  const handleUpdate = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation when clicking update button
    
    try {
      setIsUpdating(true);
      const result = await updateStore(store._id);
      
      // Show success toast with results
      const productCount = result.pollResult.products_saved || 0;
      showToast('success', `Updated ${store.name}: ${productCount} products`);
      
      // Trigger refresh if callback provided
      if (onUpdate) {
        onUpdate();
      }
    } catch (err: any) {
      console.error('Error updating store:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update store';
      showToast('error', `Update failed: ${errorMessage}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeactivate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Deactivate ${store.name}? This will stop monitoring the store.`);
    if (!confirmed) {
      return;
    }

    try {
      setIsDeactivating(true);
      await deactivateStore(store._id);
      showToast('success', `${store.name} deactivated`);
      if (onUpdate) {
        onUpdate();
      }
    } catch (err: any) {
      console.error('Error deactivating store:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to deactivate store';
      showToast('error', `Deactivate failed: ${errorMessage}`);
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleEnable = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      setIsEnabling(true);
      await activateStore(store._id);
      const result = await updateStore(store._id);
      const productCount =
        result.pollResult?.products_saved ??
        result.pollResult?.total_products ??
        0;
      showToast('success', `${store.name} enabled and refreshed (${productCount} products)`);
      if (onUpdate) {
        onUpdate();
      }
    } catch (err: any) {
      console.error('Error enabling store:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to enable store';
      showToast('error', `Enable failed: ${errorMessage}`);
    } finally {
      setIsEnabling(false);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="card hover:shadow-lg transition-all cursor-pointer border border-gray-200"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-100 rounded-lg">
            <Store className="text-primary-600" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{store.name}</h3>
            <p className="text-sm text-gray-500 truncate max-w-[200px]">{store.url}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive ? (
            <button
              onClick={handleUpdate}
              disabled={isUpdating || isDeactivating}
              className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-md flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Update store now"
            >
              <RefreshCw size={14} className={isUpdating ? 'animate-spin' : ''} />
              {isUpdating ? 'Updating...' : 'Update'}
            </button>
          ) : (
            <button
              onClick={handleEnable}
              disabled={isEnabling || isDeactivating}
              className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-sm rounded-md flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Enable store"
            >
              <Power size={14} className={isEnabling ? 'animate-spin' : ''} />
              {isEnabling ? 'Enabling...' : 'Enable'}
            </button>
          )}
          <MonitoringSubscribeButton
            targets={[
              {
                scopeType: 'store',
                scope: { storeId: store._id },
                label: store.name,
              },
            ]}
            buttonVariant={subscribeVariant}
            buttonSize="sm"
            label={subscribeLabel}
            className="disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isActive}
            defaultChangeType="both"
            onSubscriptionSuccess={() => setIsSubscribed(true)}
          />
          {isActive && (
            <button
              onClick={handleDeactivate}
              disabled={isDeactivating || isUpdating || isEnabling}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Deactivate store"
            >
              <PauseCircle size={14} className={isDeactivating ? 'animate-spin' : ''} />
              {isDeactivating ? 'Deactivating...' : 'Deactivate'}
            </button>
          )}
          {isError && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600 flex items-center gap-1">
              <AlertCircle size={14} />
              Error
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Package size={16} />
          <span>{store.productCount || 0} products</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={16} />
          <span>Every {formatPollingInterval(store.pollingInterval)}</span>
        </div>
      </div>

      {store.lastFetch && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          Last updated: {new Date(store.lastFetch).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default StoreCard;

