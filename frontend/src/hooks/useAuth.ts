import { useAuthStore } from '@/store/authStore';
import { signOut } from '@/lib/supabase';
import toast from 'react-hot-toast';

export function useAuth() {
  const { profile, token, isLoading, isAuthenticated, logout, isPro } = useAuthStore();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // signOut best-effort — always clear local state
    } finally {
      logout();
      toast.success('Signed out.');
    }
  };

  return {
    profile,
    token,
    isLoading,
    isAuthenticated,
    isPro: isPro(),
    signOut: handleSignOut,
  };
}
