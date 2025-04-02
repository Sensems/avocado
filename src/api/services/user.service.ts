import { http } from '@/utils/http/axios';
import type { CreateUserDto, UserProfile } from '../types/user';

class UserService {
  /**
   * 获取用户信息
   */
  async getProfile() {
    return http.get<UserProfile>('/users/profile', null, {
      showError: true,
      withToken: true,
    });
  }

  /**
   * 创建用户
   * @param data 用户信息
   */
  async create(data: CreateUserDto) {
    return http.post<UserProfile>('/users/create', data, {
      showError: true,
    });
  }
}

export const userService = new UserService(); 