// 消息类型
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

// 创建消息请求参数
export interface CreateMessageDto {
  content: string;
  role: MessageRole;
}

// 消息信息
export interface Message {
  id: string;
  content: string;
  role: MessageRole;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
}

// 消息列表响应
export interface MessageListResponse {
  items: Message[];
  total: number;
  page: number;
  pageSize: number;
}

// AI请求参数
export interface AiRequestDto {
  messages: {
    role: MessageRole;
    content: string;
  }[];
  temperature?: number;
  maxTokens?: number;
} 