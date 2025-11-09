import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTags } from '../useTags';
import * as api from '../../services/api';

// Mock the API module
vi.mock('../../services/api', () => ({
  getAllTags: vi.fn(),
}));

describe('useTags', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a new QueryClient for each test to ensure isolation
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should fetch tags successfully', async () => {
    const mockTags = [
      { tag: 'electronics', count: 10 },
      { tag: 'gadgets', count: 5 },
      { tag: 'sale', count: 3 },
    ];

    vi.mocked(api.getAllTags).mockResolvedValue(mockTags);

    const { result } = renderHook(() => useTags(), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    // Wait for the query to resolve
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Check the result
    expect(result.current.data).toEqual(mockTags);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(api.getAllTags).toHaveBeenCalledTimes(1);
  });

  it('should return empty array when no tags exist', async () => {
    const mockTags: any[] = [];
    vi.mocked(api.getAllTags).mockResolvedValue(mockTags);

    const { result } = renderHook(() => useTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.data?.length).toBe(0);
  });

  it('should handle API errors gracefully', async () => {
    const mockError = new Error('Failed to fetch tags');
    vi.mocked(api.getAllTags).mockRejectedValue(mockError);

    const { result } = renderHook(() => useTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
  });

  it('should cache the tags data', async () => {
    const mockTags = [
      { tag: 'cached', count: 1 },
    ];

    vi.mocked(api.getAllTags).mockResolvedValue(mockTags);

    // First render
    const { result: result1 } = renderHook(() => useTags(), { wrapper });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
    });

    expect(api.getAllTags).toHaveBeenCalledTimes(1);

    // Second render should use cache
    const { result: result2 } = renderHook(() => useTags(), { wrapper });

    await waitFor(() => {
      expect(result2.current.isSuccess).toBe(true);
    });

    // Should still be called only once (cached)
    expect(api.getAllTags).toHaveBeenCalledTimes(1);
    expect(result2.current.data).toEqual(mockTags);
  });

  it('should handle large number of tags', async () => {
    // Generate 1000 mock tags
    const mockTags = Array.from({ length: 1000 }, (_, i) => ({
      tag: `tag-${i}`,
      count: Math.floor(Math.random() * 100) + 1,
    }));

    vi.mocked(api.getAllTags).mockResolvedValue(mockTags);

    const { result } = renderHook(() => useTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockTags);
    expect(result.current.data?.length).toBe(1000);
  });

  it('should have correct query key', async () => {
    const mockTags = [{ tag: 'test', count: 1 }];
    vi.mocked(api.getAllTags).mockResolvedValue(mockTags);

    const { result } = renderHook(() => useTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Check that the query is stored with the correct key
    const cachedData = queryClient.getQueryData(['tags']);
    expect(cachedData).toEqual(mockTags);
  });

  it('should support refetching', async () => {
    const mockTags = [{ tag: 'initial', count: 1 }];
    const updatedTags = [{ tag: 'updated', count: 2 }];

    vi.mocked(api.getAllTags)
      .mockResolvedValueOnce(mockTags)
      .mockResolvedValueOnce(updatedTags);

    const { result } = renderHook(() => useTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockTags);

    // Trigger refetch
    result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toEqual(updatedTags);
    });

    expect(api.getAllTags).toHaveBeenCalledTimes(2);
  });
});

