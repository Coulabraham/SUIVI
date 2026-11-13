import { beforeEach, afterEach, expect, it } from 'vitest';
import type { UserProfile } from '@suivi/contracts';
import { api, restoreSession } from './api';
import { queryClient } from './query-client';
import { useAuthStore } from '../stores/auth';

const originalAdapter = api.defaults.adapter;
const profile: UserProfile = {
  id: 'a',
  login: 'test',
  firstName: 'Test',
  lastName: 'Test',
  role: 'SUPER_ADMIN',
  departmentId: null,
  mustChangePassword: false,
  status: 'ACTIVE',
  version: 1,
};
beforeEach(() => {
  queryClient.clear();
  useAuthStore.getState().clear();
});
afterEach(() => {
  if (originalAdapter === undefined) delete api.defaults.adapter;
  else api.defaults.adapter = originalAdapter;
  queryClient.clear();
  useAuthStore.getState().clear();
});

it('efface les données privées quand le cookie renouvelé appartient à une autre identité', async () => {
  useAuthStore.getState().accept({ accessToken: 'old', user: profile });
  queryClient.setQueryData(['private'], { names: ['autre département'] });
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      data: {
        accessToken: 'new',
        user: { ...profile, id: 'b', role: 'MANAGER', departmentId: 'department-b' },
      },
    },
  });
  await expect(restoreSession()).rejects.toThrow('L’identité de la session a changé.');
  expect(queryClient.getQueryData(['private'])).toBeUndefined();
  expect(useAuthStore.getState().user).toBeNull();
});
it('conserve le cache de la même identité lors d’un renouvellement ordinaire', async () => {
  useAuthStore.getState().accept({ accessToken: 'old', user: profile });
  queryClient.setQueryData(['private'], { total: '10000' });
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: { data: { accessToken: 'new', user: profile } },
  });
  await restoreSession();
  expect(queryClient.getQueryData(['private'])).toEqual({ total: '10000' });
  expect(useAuthStore.getState().token).toBe('new');
});
