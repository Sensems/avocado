// 登录请求参数
export interface LoginUserDto {
  email: string;
  password: string;
}

// 登录响应
export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email?: string;
  };
} 