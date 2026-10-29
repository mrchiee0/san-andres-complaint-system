import { apiUrl } from '../lib/api';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  verifyToken: (token: string | null) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      loading: true,
      login: (token, user) => set({ token, user, loading: false }),
      logout: () => set({ token: null, user: null, loading: false }),
      setLoading: (loading) => set({ loading }),
      verifyToken: async (token) => {
        if (!token) {
          set({ user: null, token: null, loading: false });
          return;
        }
        try {
          set({ loading: true });
          const response = await fetch(apiUrl('/api/auth/verify'), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const { user } = await response.json();
            set({ user, token, loading: false });
          } else {
            set({ user: null, token: null, loading: false });
          }
        } catch {
          set({ user: null, token: null, loading: false });
        }
      },
    }),
    {
      name: 'san-andres-auth',
    }
  )
);
