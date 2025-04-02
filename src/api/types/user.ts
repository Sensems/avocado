// 用户信息
export interface UserProfile {
  id: number;
  username: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

// 创建用户请求参数
export interface CreateUserDto {
  username: string;
  password: string;
  email?: string;
} 