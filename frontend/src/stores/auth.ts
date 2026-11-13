import { create } from 'zustand';
import type { UserProfile, AuthResult } from '@suivi/contracts';

export const useAuthStore = create<{
  token: string | null;
  user: UserProfile | null;
  ready: boolean;
  passwordUpdated: boolean;
  accept: (result: AuthResult) => void;
  clear: () => void;
  afterPasswordChange: () => void;
  finish: () => void;
}>((set) => ({
  token: null,
  user: null,
  ready: false,
  passwordUpdated: false,
  accept: (result) =>
    set({ token: result.accessToken, user: result.user, ready: true, passwordUpdated: false }),
  clear: () => set({ token: null, user: null, ready: true, passwordUpdated: false }),
  afterPasswordChange: () => set({ token: null, user: null, ready: true, passwordUpdated: true }),
  finish: () => set({ ready: true }),
}));

export function useAuthScope() {
  return useAuthStore((state) =>
    state.user
      ? state.user.id + ':' + state.user.role + ':' + (state.user.departmentId ?? 'global')
      : 'anonymous',
  );
}
