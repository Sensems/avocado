import { http } from '@/utils/http/axios';
import type { CreateMessageDto, Message, MessageListResponse } from '../types/message';

class MessageService {
  /**
   * 创建消息
   * @param conversationId 对话ID
   * @param data 消息内容
   */
  async create(conversationId: string, data: CreateMessageDto) {
    return http.post<Message>(`/conversations/${conversationId}/messages`, data, {
      showError: true,
      withToken: true,
    });
  }

  /**
   * 获取消息列表
   * @param conversationId 对话ID
   */
  async findAll(conversationId: string) {
    return http.get<MessageListResponse>(`/conversations/${conversationId}/messages`, null, {
      showError: true,
      withToken: true,
    });
  }
}

export const messageService = new MessageService(); 