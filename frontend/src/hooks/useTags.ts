import { useQuery } from '@tanstack/react-query';
import { getAllTags } from '../services/api';

export const useTags = () => {
  return useQuery({
    queryKey: ['tags'],
    queryFn: getAllTags,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
};

