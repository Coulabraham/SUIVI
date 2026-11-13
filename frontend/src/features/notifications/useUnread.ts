import { useQuery } from '@tanstack/react-query';
import type { ApiResponse } from '@suivi/contracts';
import { api } from '../../services/api';
import { useAuthScope, useAuthStore } from '../../stores/auth';
export function useUnread() {
  const user = useAuthStore((s) => s.user);
  const scope = useAuthScope();
  return useQuery({
    queryKey: ['/notifications', scope, 'unread'],
    enabled: !!user && !user.mustChangePassword,
    refetchInterval: 30000,
    queryFn: async () =>
      (await api.get<ApiResponse<{ unread: number }>>('/notifications/unread-count')).data.data
        .unread,
  });
}
