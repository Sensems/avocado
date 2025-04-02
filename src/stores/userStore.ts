import { create } from 'zustand';
import { User, UserState, UserActions } from '../types/user';
import { persist } from 'zustand/middleware';
import { authService } from '@/api';

type UserStore = UserState & UserActions;

const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      // 初始状态
      user: null,
      token: null,
      isAuthenticated: false,
      isShowLoginPanel: false,

      // Actions
      setUser: (user: User | null) => {
        set({
          user,
          isAuthenticated: !!user,
        });
      },

      setShowLoginPanel: (isShow: boolean) => {
        set({
          isShowLoginPanel: isShow,
        });
      },

      login: async (email: string, password: string) => {
        const res = await authService.login({email, password});
        console.log('res',res)
        set({
          user: res.user,
          isAuthenticated: true,
          token: res.token,
        });
      },    

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          token: null,
        });
        localStorage.clear();
      },
    }),
    {
      name: 'user-storage', // 存储在 localStorage 中的键名
      partialize: (state) => ({ 
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        token: state.token,
      }), // 只持久化这些字段
    }
  )
);

export default useUserStore; 