import { http } from '@/utils/http/axios';
import type { Conversation, ConversationListResponse, CreateConversationDto } from '../types/conversation';

class ConversationService {
  /**
   * 创建对话
   * @param data 对话信息
   */
  async create(data: CreateConversationDto) {
    return http.post<Conversation>('/conversations/create', data, {
      showError: true,
      withToken: true,
    });
  }

  /**
   * 获取对话列表
   */
  async findAll() {
    return http.post<Conversation[]>('/conversations/findAll', undefined, {
      showError: true,
      withToken: true,
    });
  }

  /**
   * 获取对话详情
   * @param id 对话ID
   */
  async findById(id: string) {
    return http.get<Conversation>(`/conversations/find/${id}`, null, {
      showError: true,
      withToken: true,
    });
  }

  /**
   * 更新对话
   * @param id 对话ID
   * @param data 对话信息
   */
  async update(id: string, data: Partial<CreateConversationDto>) {
    return http.post<Conversation>(`/conversations/update/${id}`, data, {
      showError: true,
      withToken: true,
    });
  }

  /**
   * 删除对话
   * @param id 对话ID
   */
  async delete(id: string) {
    return http.post<void>(`/conversations/delete/${id}`, undefined, {
      showError: true,
      withToken: true,
    });
  }
}

export const conversationService = new ConversationService(); 