// InfFinanceMs - 认证状态管理

import { create } from 'zustand';
import { api } from '@/lib/api';
import type { AuthUser, LoginResponse } from '@inffinancems/shared';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;

  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setAuth: (user: AuthUser) => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrated: false,

  hydrate: async () => {
    try {
      await api.get('/auth/csrf');
      await useAuthStore.getState().fetchCurrentUser();
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isHydrated: true,
      });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
      });
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        isHydrated: true,
      });
      return response;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // ignore logout network errors and clear local state anyway
    }
    set({
      user: null,
      isAuthenticated: false,
      isHydrated: true,
    });
  },

  fetchCurrentUser: async () => {
    try {
      const user = await api.get<AuthUser>('/auth/me');
      set({
        user,
        isAuthenticated: true,
        isHydrated: true,
      });
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isHydrated: true,
      });
      throw new Error('NOT_AUTHENTICATED');
    }
  },

  setUser: (user: AuthUser | null) => {
    set({
      user,
      isAuthenticated: !!user,
      isHydrated: true,
    });
  },

  setAuth: (user: AuthUser) => {
    set({
      user,
      isAuthenticated: true,
      isHydrated: true,
    });
  },
}));

export const hasRole = (user: AuthUser | null, roles: string[]): boolean => {
  if (!user) return false;
  return roles.includes(user.role);
};

export const isAdmin = (user: AuthUser | null): boolean => hasRole(user, ['ADMIN']);

export const isFinance = (user: AuthUser | null): boolean =>
  hasRole(user, ['FINANCE', 'ADMIN']);

export const isManager = (user: AuthUser | null): boolean =>
  hasRole(user, ['MANAGER', 'ADMIN']);
