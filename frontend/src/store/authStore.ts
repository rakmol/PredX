import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthProfile } from '@/lib/supabase';

interface AuthState {
  profile: AuthProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (profile: AuthProfile, token: string) => void;
  logout: () => void;
  updateProfile: (patch: Partial<AuthProfile>) => void;
  setLoading: (loading: boolean) => void;

  // Derived helpers
  isPro: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      profile: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,

      login: (profile, token) => {
        localStorage.setItem('predx_token', token);
        set({ profile, token, isAuthenticated: true, isLoading: false });
      },

      logout: () => {
        localStorage.removeItem('predx_token');
        set({ profile: null, token: null, isAuthenticated: false, isLoading: false });
      },

      updateProfile: (patch) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...patch } : null,
        })),

      setLoading: (isLoading) => set({ isLoading }),

      // All authenticated users have full access for now.
      // To restore tier-based gating: `get().profile?.subscription_tier === 'pro'`
      isPro: () => get().isAuthenticated,
    }),
    {
      name: 'predx-auth',
      partialize: (state) => ({ profile: state.profile, token: state.token, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
