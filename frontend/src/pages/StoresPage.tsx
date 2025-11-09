import { useState, useEffect, useRef } from 'react';
import { Plus, Store, RefreshCw } from 'lucide-react';
import { useStores } from '../hooks/useStores';
import StoreList from '../components/stores/StoreList';
import AddStoreModal from '../components/stores/AddStoreModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import EmptyState from '../components/common/EmptyState';
import { useToast } from '../components/common/ToastContainer';
import { updateAllStores, getStore } from '../services/api';

function StoresPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pollingStoreId, setPollingStoreId] = useState<string | null>(null);
  const { data: stores, isLoading, error, refetch } = useStores();
  const { showToast } = useToast();
  const pollIntervalRef = useRef<number | null>(null);
  const pollAttemptsRef = useRef(0);
  const MAX_POLL_ATTEMPTS = 20; // Poll for ~1 minute (3 seconds * 20)

  const handleUpdateAll = async () => {
    try {
      setIsUpdating(true);
      const result = await updateAllStores();
      
      // Show success toast with results
      const storeCount = result.pollResult.successful_stores || 0;
      const productCount = result.pollResult.total_products || 0;
      showToast('success', `Updated ${storeCount} stores, ${productCount} products`);
      
      // Refresh the store list
      await refetch();
    } catch (err: any) {
      console.error('Error updating stores:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update stores';
      showToast('error', `Update failed: ${errorMessage}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle store added - start polling for product updates
  const handleStoreAdded = (storeId: string) => {
    setPollingStoreId(storeId);
    pollAttemptsRef.current = 0;
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Poll for store updates after adding
  useEffect(() => {
    if (!pollingStoreId) return;

    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Start polling
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        pollAttemptsRef.current += 1;

        // Fetch the specific store to check product count
        const store = await getStore(pollingStoreId);

        // If products found, stop polling and notify
        if (store.productCount && store.productCount > 0) {
          showToast('success', `${store.name} loaded with ${store.productCount} products!`);
          setPollingStoreId(null);
          await refetch();
          
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          return;
        }

        // If max attempts reached, stop polling
        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          showToast('info', `Still loading products for ${store.name}. This may take a while.`);
          setPollingStoreId(null);
          await refetch();
          
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else {
          // Refresh store list to show progress
          await refetch();
        }
      } catch (err) {
        console.error('Error polling store:', err);
        // Continue polling on error
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [pollingStoreId, refetch, showToast, MAX_POLL_ATTEMPTS]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Stores</h1>
        <ErrorMessage
          message="Failed to load stores. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Stores</h1>
        <div className="flex gap-3">
          <button
            onClick={handleUpdateAll}
            disabled={isUpdating || !stores || stores.length === 0}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={20} className={isUpdating ? 'animate-spin' : ''} />
            {isUpdating ? 'Updating...' : 'Update All Stores'}
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Add Store
          </button>
        </div>
      </div>

      {stores && stores.length > 0 ? (
        <StoreList stores={stores} onStoreUpdate={refetch} />
      ) : (
        <EmptyState
          icon={Store}
          title="No stores yet"
          description="Get started by adding your first Shopify store to monitor prices and track changes."
          action={{
            label: 'Add Your First Store',
            onClick: () => setIsAddModalOpen(true),
          }}
        />
      )}

      <AddStoreModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onStoreAdded={handleStoreAdded}
      />
    </div>
  );
}

export default StoresPage;

