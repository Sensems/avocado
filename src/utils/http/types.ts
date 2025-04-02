// HTTP请求响应的基础接口
export interface BaseResponse<T = any> {
  code: number;
  data: T;
  message: string;
}

// 重试配置
export interface RetryConfig {
  // 重试次数
  count: number;
  // 重试延迟（毫秒）
  delay: number;
  // 重试条件
  condition?: (error: any) => boolean;
}

// 进度回调
export interface ProgressCallback {
  onUploadProgress?: (progressEvent: any) => void;
  onDownloadProgress?: (progressEvent: any) => void;
}

// 请求配置
export interface RequestOptions extends ProgressCallback {
  // 是否显示loading
  showLoading?: boolean;
  // 是否显示错误信息
  showError?: boolean;
  // 错误信息的展示时间
  errorMessageDuration?: number;
  // 是否携带token
  withToken?: boolean;
  // 自定义headers
  headers?: Record<string, string>;
  // 请求超时时间
  timeout?: number;
  // 重试配置
  retry?: RetryConfig;
  // 请求标识符（用于取消请求）
  cancelKey?: string;
  // 响应类型
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer' | 'stream';
}

// 后端返回的用户信息结构
export interface UserInfo {
  userId: string | number;
  username: string;
  // 其他用户信息字段...
} 