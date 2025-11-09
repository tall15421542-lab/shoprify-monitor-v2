import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as any;

// Create mock instance
const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
};

mockedAxios.create = vi.fn(() => mockAxiosInstance);

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStores', () => {
    it('fetches stores from API', async () => {
      const mockStores = [
        { _id: '1', name: 'Store 1', url: 'store1.myshopify.com', status: 'active', pollingInterval: 24 },
        { _id: '2', name: 'Store 2', url: 'store2.myshopify.com', status: 'active', pollingInterval: 24 },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockStores });

      // Import after mocking
      const { getStores } = await import('./api');
      const result = await getStores();

      expect(result).toEqual(mockStores);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stores');
    });
  });

  describe('addStore', () => {
    it('posts new store to API', async () => {
      const newStore = {
        name: 'New Store',
        url: 'newstore.myshopify.com',
        pollingInterval: 12,
      };

      const mockResponse = {
        ...newStore,
        _id: '3',
        status: 'active' as const,
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const { addStore } = await import('./api');
      const result = await addStore(newStore);

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/stores', newStore);
    });
  });

  describe('getStoreProducts', () => {
    it('fetches products for a store', async () => {
      const mockProducts = [
        {
          _id: 'p1',
          storeId: 's1',
          title: 'Product 1',
          currentPrice: 99.99,
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockProducts });

      const { getStoreProducts } = await import('./api');
      const result = await getStoreProducts('s1');

      expect(result).toEqual(mockProducts);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stores/s1/products');
    });
  });
});

