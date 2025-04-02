import { LoginResponse } from "@/api";

export type User = LoginResponse['user']

export interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  isShowLoginPanel: boolean;
}

export interface UserActions {
  setUser: (user: User | null) => void;
  setShowLoginPanel: (isShow: boolean) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
} 