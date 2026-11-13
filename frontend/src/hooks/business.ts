import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse, PageResult } from '@suivi/contracts';
import { api } from '../services/api';
import { useAuthScope } from '../stores/auth';

export const fcfa = (value: string) =>
  new Intl.NumberFormat('fr-FR').format(BigInt(value)) + ' FCFA';
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
export const statusOptions = [
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'INACTIVE', label: 'Désactivé' },
];
export function useList<T>(endpoint: string, extra?: Record<string, string>, refetchInterval = 0) {
  const scope = useAuthScope();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [endpoint, scope, search, page, extra],
    refetchInterval: refetchInterval || false,
    queryFn: async () =>
      (
        await api.get<ApiResponse<PageResult<T>>>(endpoint, {
          params: { q: search, page, pageSize: 20, ...extra },
        })
      ).data.data,
  });
  return {
    ...query,
    search,
    page,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    setPage,
  };
}
export function useInvalidate() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries();
  };
}
