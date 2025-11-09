import StoreCard from './StoreCard';
import type { Store } from '../../types';

interface StoreListProps {
  stores: Store[];
  onStoreUpdate?: () => void;
}

function StoreList({ stores, onStoreUpdate }: StoreListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stores.map((store) => (
        <StoreCard key={store._id} store={store} onUpdate={onStoreUpdate} />
      ))}
    </div>
  );
}

export default StoreList;

