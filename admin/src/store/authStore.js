import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => {
        // Record the sign-out on the audit trail before the token is cleared.
        // Fire-and-forget via fetch (not the api client, which would import this
        // store back) so the redirect that follows never waits on it.
        const { token } = get();
        if (token) {
          fetch('/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            keepalive: true,
          }).catch(() => {});
        }
        set({ user: null, token: null });
      },
    }),
    { name: 'auth-storage' }
  )
);

export default useAuthStore;
