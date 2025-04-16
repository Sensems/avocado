import { create } from 'zustand';
import { ConversationState, ConversationActions } from '../types/store.type';
import { persist } from 'zustand/middleware';
import { Conversation, conversationService, Message } from '@/api';

type ConversationStore = ConversationState & ConversationActions;

const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      conversationList: [] as Conversation[],
      messages: [] as Message[],

      // Actions

      // 创建对话
      createConversation: async (title: string) => {
        const conversationRes = await conversationService.create({ title })
        get().getConversationList()
        return conversationRes
      },

      // 获取对话列表
      getConversationList: async () => {
        const conversationListRes = await conversationService.findAll()
        set({ conversationList: conversationListRes  })
      },

      // 删除对话
      delConversation: async (id: string) => {
        await conversationService.delete(id)
        get().getConversationList()
      },

      // 编辑对话
      editConversation: async (id: string, title: string) => {
        await conversationService.update(id, { title })
      }
    }),
    {
      name: 'conversation-storage', // 存储在 localStorage 中的键名
      partialize: (state) => ({ 
        conversationList: state.conversationList,
      }),
    }
  )
);

export default useConversationStore; 