import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, DepartmentView, PageResult } from '@suivi/contracts';
import { api } from '../../services/api';
import { useAuthScope } from '../../stores/auth';

export function useDepartmentOptions(enabled = true) {
  const scope = useAuthScope();
  return useQuery({
    queryKey: ['/departments', scope, 'options'],
    enabled,
    queryFn: async () => {
      const rows: DepartmentView[] = [];
      let page = 1;
      let total: number;
      do {
        const response = (
          await api.get<ApiResponse<PageResult<DepartmentView>>>('/departments', {
            params: { page, pageSize: 100 },
          })
        ).data.data;
        rows.push(...response.items);
        total = response.total;
        page++;
      } while (rows.length < total);
      return rows;
    },
  });
}
