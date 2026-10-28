import React from 'react';
import { useAuthStore } from '../store/useAuthStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { verifyToken } = useAuthStore();
  
  React.useEffect(() => {
    const persisted = useAuthStore.getState().token;
    if (persisted) {
      verifyToken(persisted);
    } else {
      useAuthStore.getState().setLoading(false);
    }
  }, []);

  return <>{children}</>;
}

export function useAuth() {
  const { user, token, login, logout, loading } = useAuthStore();
  return { user, token, login, logout, loading };
}
