import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      accountStatus: null,

      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null, accountStatus: null }),
      updateUser: (partial) => set((state) => ({ user: { ...state.user, ...partial } })),
      setAccountStatus: (status) => set({ accountStatus: status }),
    }),
    {
      name: 'irequestd-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

export default useAuthStore;
