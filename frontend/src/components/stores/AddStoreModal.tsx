import { useState, FormEvent } from 'react';
import Modal from '../common/Modal';
import { useAddStore } from '../../hooks/useStores';
import { useToast } from '../common/ToastContainer';
import type { AddStoreData } from '../../types';

interface AddStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoreAdded?: (storeId: string) => void;
}

// Form state type allows empty string for pollingInterval during editing
interface FormState {
  name: string;
  url: string;
  pollingInterval: number | '';
}

function AddStoreModal({ isOpen, onClose, onStoreAdded }: AddStoreModalProps) {
  const [formData, setFormData] = useState<FormState>({
    name: '',
    url: '',
    pollingInterval: 24,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof AddStoreData, string>>>({});
  const { showToast } = useToast();

  const addStoreMutation = useAddStore();

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AddStoreData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Store name is required';
    }

    if (!formData.url.trim()) {
      newErrors.url = 'Store URL is required';
    }

    const interval = typeof formData.pollingInterval === 'number' ? formData.pollingInterval : 0;
    if (interval < 1 || interval > 168) {
      newErrors.pollingInterval = 'Polling interval must be between 1 and 168 hours';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      // Convert form data to API format
      const submitData: AddStoreData = {
        name: formData.name,
        url: formData.url,
        pollingInterval: typeof formData.pollingInterval === 'number' ? formData.pollingInterval : 24,
      };
      
      const result = await addStoreMutation.mutateAsync(submitData);
      
      // Show notification about background polling
      showToast('success', `Store "${formData.name}" added! Fetching products in background...`);
      
      // Trigger callback with store ID for auto-refresh
      if (onStoreAdded && result._id) {
        onStoreAdded(result._id);
      }
      
      // Reset form and close modal on success
      setFormData({ name: '', url: '', pollingInterval: 24 });
      setErrors({});
      onClose();
    } catch (error) {
      setErrors({ url: 'Failed to add store. Please try again.' });
    }
  };

  const handleClose = () => {
    setFormData({ name: '', url: '', pollingInterval: 24 });
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Store">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="label">
            Store Name
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={`input-field ${errors.name ? 'border-red-500' : ''}`}
            placeholder="My Shopify Store"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="url" className="label">
            Store URL
          </label>
          <input
            type="text"
            id="url"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            className={`input-field ${errors.url ? 'border-red-500' : ''}`}
            placeholder="https://example.com"
          />
          {errors.url && <p className="mt-1 text-sm text-red-600">{errors.url}</p>}
        </div>

        <div>
          <label htmlFor="pollingInterval" className="label">
            Polling Interval (hours)
          </label>
          <input
            type="number"
            id="pollingInterval"
            value={formData.pollingInterval}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string during editing, otherwise parse the number
              if (value === '') {
                setFormData({ ...formData, pollingInterval: '' });
              } else {
                const parsed = parseInt(value, 10);
                if (!isNaN(parsed)) {
                  setFormData({ ...formData, pollingInterval: parsed });
                }
              }
            }}
            className={`input-field ${errors.pollingInterval ? 'border-red-500' : ''}`}
            min="1"
            max="168"
          />
          {errors.pollingInterval && (
            <p className="mt-1 text-sm text-red-600">{errors.pollingInterval}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">How often to check for price changes</p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="btn-secondary flex-1"
            disabled={addStoreMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={addStoreMutation.isPending}
          >
            {addStoreMutation.isPending ? 'Adding...' : 'Add Store'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default AddStoreModal;

