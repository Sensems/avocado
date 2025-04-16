import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, CancelTokenSource } from 'axios';
import type { BaseResponse, RequestOptions, RetryConfig } from './types';
import { message } from 'antd';

// 请求队列
interface PendingRequest {
  cancelToken: CancelTokenSource;
  requestKey: string;
}
const pendingRequests: PendingRequest[] = [];

// 创建axios实例
const instance: AxiosInstance = axios.create({
  // 根据你的实际后端API地址配置
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json;charset=utf-8',
  },
});

// 生成请求的唯一键
const generateRequestKey = (config: AxiosRequestConfig): string => {
  const { method, url, params, data } = config;
  return [method, url, JSON.stringify(params), JSON.stringify(data)].join('&');
};

// 添加请求到队列
const addPendingRequest = (config: AxiosRequestConfig, cancelKey?: string) => {
  const requestKey = cancelKey || generateRequestKey(config);
  const cancelToken = axios.CancelToken.source();
  pendingRequests.push({ cancelToken, requestKey });
  return cancelToken;
};

// 从队列中移除请求
const removePendingRequest = (requestKey: string) => {
  const index = pendingRequests.findIndex((item) => item.requestKey === requestKey);
  if (index > -1) {
    pendingRequests.splice(index, 1);
  }
};

// 取消重复的请求
const cancelDuplicateRequests = (requestKey: string) => {
  const duplicateRequest = pendingRequests.find((item) => item.requestKey === requestKey);
  if (duplicateRequest) {
    duplicateRequest.cancelToken.cancel('重复请求被取消');
    removePendingRequest(requestKey);
  }
};

// 重试请求
const retryRequest = async (config: AxiosRequestConfig, retryConfig: RetryConfig) => {
  const { count, delay, condition } = retryConfig;
  let retries = 0;

  const execute = async (): Promise<any> => {
    try {
      return await instance.request(config);
    } catch (error) {
      if (retries < count && (!condition || condition(error))) {
        retries++;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return execute();
      }
      throw error;
    }
  };

  return execute();
};

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // 在这里你可以统一处理token等
    const userStore = localStorage.getItem('user-storage');
    if (userStore) {
      const parseUserStore = JSON.parse(userStore);
      config.headers.Authorization = `Bearer ${parseUserStore.state.token}`;
    }

    // 处理重复请求
    const requestKey = (config as any).cancelKey || generateRequestKey(config);
    cancelDuplicateRequests(requestKey);
    const cancelToken = addPendingRequest(config, requestKey);
    config.cancelToken = cancelToken.token;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  (response: AxiosResponse) => {
    // 移除已完成的请求
    const requestKey = (response.config as any).cancelKey || generateRequestKey(response.config);
    removePendingRequest(requestKey);

    const res = response.data as BaseResponse;
    // 这里可以根据后端的错误码进行统一处理
    if (res.code !== 200) {
      // 使用 antd 的 message.error 显示错误信息
      message.error(res.message || '请求失败');
      return Promise.reject(new Error(res.message || '请求失败'));
    }
    return response;
  },
  (error) => {
    // 移除失败的请求
    if (error.config) {
      const requestKey = (error.config as any).cancelKey || generateRequestKey(error.config);
      removePendingRequest(requestKey);
    }

    // 处理错误信息
    let errorMsg = '';
    if (axios.isCancel(error)) {
      console.log('请求被取消:', error.message);
      return Promise.reject(error);
    }
    if (error.response) {
      switch (error.response.status) {
        case 401:
          errorMsg = '未授权，请重新登录';
          // 可以在这里处理登出逻辑
          break;
        case 403:
          errorMsg = '拒绝访问';
          break;
        case 404:
          errorMsg = error.response.data.message || '请求错误，未找到该资源';
          break;
        case 500:
          errorMsg = '服务器错误';
          break;
        default:
          errorMsg = `连接错误${error.response.status}`;
      }
    } else {
      errorMsg = error.message || '网络连接异常';
    }
    
    // 使用 antd 的 message.error 显示错误信息
    message.error(errorMsg);
    
    return Promise.reject(error);
  }
);

const request = <T = any>(
  config: AxiosRequestConfig,
  options: RequestOptions = {}
): Promise<T> => {
  const conf: AxiosRequestConfig = {
    ...config,
    headers: {
      ...config.headers,
      ...options.headers,
    },
  };

  // 添加进度回调
  if (options.onUploadProgress) {
    conf.onUploadProgress = options.onUploadProgress;
  }
  if (options.onDownloadProgress) {
    conf.onDownloadProgress = options.onDownloadProgress;
  }

  // 添加取消标识
  if (options.cancelKey) {
    (conf as any).cancelKey = options.cancelKey;
  }

  const execute = () => {
    return new Promise<T>((resolve, reject) => {
      instance
        .request<any, AxiosResponse<BaseResponse<T>>>(conf)
        .then((res) => {
          resolve(res.data.data);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  // 处理重试逻辑
  if (options.retry) {
    return retryRequest(conf, options.retry) as Promise<T>;
  }

  return execute();
};

// 导出请求方法
export const http = {
  get: <T = any>(url: string, params?: any, options?: RequestOptions) =>
    request<T>({ method: 'GET', url, params }, options),

  post: <T = any>(url: string, data?: any, options?: RequestOptions) =>
    request<T>({ method: 'POST', url, data }, options),

  put: <T = any>(url: string, data?: any, options?: RequestOptions) =>
    request<T>({ method: 'PUT', url, data }, options),

  delete: <T = any>(url: string, data?: any, options?: RequestOptions) =>
    request<T>({ method: 'DELETE', url, data }, options),

  // 取消指定的请求
  cancel: (cancelKey: string) => {
    const request = pendingRequests.find((item) => item.requestKey === cancelKey);
    if (request) {
      request.cancelToken.cancel();
      removePendingRequest(cancelKey);
    }
  },

  // 取消所有请求
  cancelAll: () => {
    pendingRequests.forEach((request) => {
      request.cancelToken.cancel();
    });
    pendingRequests.length = 0;
  },
};

export default http; 