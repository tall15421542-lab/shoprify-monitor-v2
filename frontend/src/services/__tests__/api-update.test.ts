import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios from 'axios';

// Mock axios before importing the module
vi.mock('axios');

describe('Update API Functions', () => {
  let mockPost: any;
  
  beforeEach(() => {
    // Create a fresh mock for each test
    mockPost = vi.fn();
    (axios.create as any).mockReturnValue({
      post: mockPost,
      get: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clear the module cache to ensure fresh imports
    vi.resetModules();
  });

  describe('updateAllStores', () => {
    it('should poll all stores and then aggregate', async () => {
      const mockPollResponse = {
        data: {
          message: 'All stores polling completed successfully',
          results: {
            total_stores: 3,
            successful_stores: 3,
            failed_stores: 0,
            total_products: 150,
          },
        },
      };

      const mockAggregateResponse = {
        data: {
          message: 'Current hour aggregation completed successfully',
          results: {
            store_averages: 3,
            tag_averages: 5,
            store_tag_averages: 8,
          },
        },
      };

      mockPost
        .mockResolvedValueOnce(mockPollResponse)
        .mockResolvedValueOnce(mockAggregateResponse);

      // Import after setting up mocks
      const { updateAllStores } = await import('../api');
      const result = await updateAllStores();

      // Verify correct API calls were made in sequence
      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(mockPost).toHaveBeenNthCalledWith(1, '/poll/all');
      expect(mockPost).toHaveBeenNthCalledWith(2, '/aggregate/current');

      // Verify the result structure
      expect(result).toEqual({
        pollResult: {
          total_stores: 3,
          successful_stores: 3,
          failed_stores: 0,
          total_products: 150,
        },
        aggregationResult: {
          store_averages: 3,
          tag_averages: 5,
          store_tag_averages: 8,
        },
      });
    });

    it('should handle polling errors', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      const { updateAllStores } = await import('../api');

      await expect(updateAllStores()).rejects.toThrow('Network error');
    });

    it('should handle aggregation errors even if polling succeeds', async () => {
      const mockPollResponse = {
        data: {
          results: {
            total_stores: 3,
            successful_stores: 3,
            failed_stores: 0,
            total_products: 150,
          },
        },
      };

      mockPost
        .mockResolvedValueOnce(mockPollResponse)
        .mockRejectedValueOnce(new Error('Aggregation error'));

      const { updateAllStores } = await import('../api');

      await expect(updateAllStores()).rejects.toThrow('Aggregation error');
    });

    it('should handle empty results gracefully', async () => {
      const mockPollResponse = { data: {} };
      const mockAggregateResponse = { data: {} };

      mockPost
        .mockResolvedValueOnce(mockPollResponse)
        .mockResolvedValueOnce(mockAggregateResponse);

      const { updateAllStores } = await import('../api');
      const result = await updateAllStores();

      expect(result).toEqual({
        pollResult: {},
        aggregationResult: {},
      });
    });
  });

  describe('updateStore', () => {
    it('should poll specific store and then aggregate', async () => {
      const storeId = '507f1f77bcf86cd799439011';
      
      const mockPollResponse = {
        data: {
          message: 'Store polling completed successfully',
          results: {
            store_id: storeId,
            store_name: 'Test Store',
            products_saved: 50,
            errors: 0,
            price_snapshots: 50,
          },
        },
      };

      const mockAggregateResponse = {
        data: {
          message: 'Current hour aggregation completed successfully',
          results: {
            store_averages: 1,
            tag_averages: 3,
            store_tag_averages: 3,
          },
        },
      };

      mockPost
        .mockResolvedValueOnce(mockPollResponse)
        .mockResolvedValueOnce(mockAggregateResponse);

      const { updateStore } = await import('../api');
      const result = await updateStore(storeId);

      // Verify correct API calls were made in sequence
      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(mockPost).toHaveBeenNthCalledWith(1, `/poll/store/${storeId}`);
      expect(mockPost).toHaveBeenNthCalledWith(2, '/aggregate/current');

      // Verify the result structure
      expect(result).toEqual({
        pollResult: {
          store_id: storeId,
          store_name: 'Test Store',
          products_saved: 50,
          errors: 0,
          price_snapshots: 50,
        },
        aggregationResult: {
          store_averages: 1,
          tag_averages: 3,
          store_tag_averages: 3,
        },
      });
    });

    it('should handle store not found errors', async () => {
      const storeId = 'nonexistent';
      const error = {
        response: {
          status: 404,
          data: { error: 'Store not found' },
        },
      };
      
      mockPost.mockRejectedValue(error);

      const { updateStore } = await import('../api');

      await expect(updateStore(storeId)).rejects.toMatchObject({
        response: {
          status: 404,
          data: { error: 'Store not found' },
        },
      });
    });

    it('should handle invalid store ID format', async () => {
      const storeId = 'invalid-id';
      const error = {
        response: {
          status: 400,
          data: { error: 'Invalid store ID format' },
        },
      };
      
      mockPost.mockRejectedValue(error);

      const { updateStore } = await import('../api');

      await expect(updateStore(storeId)).rejects.toMatchObject({
        response: {
          status: 400,
          data: { error: 'Invalid store ID format' },
        },
      });
    });

    it('should handle network errors', async () => {
      const storeId = '507f1f77bcf86cd799439011';
      
      mockPost.mockRejectedValue(new Error('Network connection failed'));

      const { updateStore } = await import('../api');

      await expect(updateStore(storeId)).rejects.toThrow('Network connection failed');
    });
  });
});
