import { http } from '@/utils/http/axios';
import type { LoginUserDto, LoginResponse } from '../types/auth';

class AuthService {
  /**
   * 用户登录
   * @param data 登录参数
   */
  async login(data: LoginUserDto) {
    return http.post<LoginResponse>('/auth/login', data, {
      showError: true,
    });
  }

  /**
   * 退出登录
   */
  logout() {
    localStorage.removeItem('token');
  }
}

export const authService = new AuthService(); 