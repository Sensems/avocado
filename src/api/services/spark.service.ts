import { http } from '@/utils/http/axios';
import type { AiRequestDto } from '../types/message';

class SparkService {
  /**
   * 非流式对话
   * @param data 对话参数
   */
  async notStreamChat(data: AiRequestDto) {
    return http.post<string>('/spark/notSteamChat', data, {
      showError: true,
      withToken: true,
      timeout: 60000, // 延长超时时间
    });
  }

  /**
   * 流式对话
   * @param conversationId 对话ID
   * @param data 对话参数
   * @param onMessage 消息回调
   */
  async streamChat(
    conversationId: string,
    data: AiRequestDto,
    onMessage?: (text: string) => void
  ) {
    return http.post<ReadableStream>(
      `/spark/conversations/${conversationId}/spark/steamChat`,
      data,
      {
        showError: true,
        withToken: true,
        timeout: 60000, // 延长超时时间
        // 设置响应类型为流
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          const text = progressEvent.event.data;
          onMessage?.(text);
        },
      }
    );
  }
}

export const sparkService = new SparkService(); 