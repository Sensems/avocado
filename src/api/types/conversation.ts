// 创建对话请求参数
export interface CreateConversationDto {
  title: string;
  description?: string;
}

// 对话信息
export interface Conversation {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
}

// 对话列表响应
export interface ConversationListResponse {
  items: Conversation[];
  total: number;
  page: number;
  pageSize: number;
} 