import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Package, Clock, AlertCircle, CheckCircle, Pause, RefreshCw } from 'lucide-react';
import type { Store as StoreType } from '../../types';
import { useToast } from '../common/ToastContainer';
import { updateStore } from '../../services/api';

interface StoreCardProps {
  store: StoreType;
  onUpdate?: () => void;
}

function StoreCard({ store, onUpdate }: StoreCardProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const statusConfig = {
    active: {
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      label: 'Active',
    },
    paused: {
      icon: Pause,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      label: 'Paused',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      label: 'Error',
    },
  };

  const status = statusConfig[store.status];
  const StatusIcon = status.icon;

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
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-md flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Update store now"
          >
            <RefreshCw size={14} className={isUpdating ? 'animate-spin' : ''} />
            {isUpdating ? 'Updating...' : 'Update'}
          </button>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color} flex items-center gap-1`}>
            <StatusIcon size={14} />
            {status.label}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Package size={16} />
          <span>{store.productCount || 0} products</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={16} />
          <span>Every {store.pollingInterval}h</span>
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

