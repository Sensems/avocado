import dayjs from 'dayjs';
import { Modal } from 'antd';
import { debounce } from 'lodash-es'
import { Conversations } from '../types';
import { useEffect, useState } from 'react';
import { Conversation } from '@/api/types/conversation';
import useConversationStore from '@/stores/conversationStore';

type EditableConversation = {
  editable: boolean;
} & Conversation;

export const useConversation = () => {
  const { conversationList, delConversation, editConversation } = useConversationStore();
  const [modal, modalContextHolder] = Modal.useModal();
  const [conversations, setConversations] = useState<Conversations[]>();

  useEffect(() => {
    setConversations(formarConversations(conversationList.map(item => ({ ...item, editable: false }))))
  }, [conversationList])

  // 以日期分组对话
  const formarConversations = (data: EditableConversation[]):Conversations[]  => {
    if (!data?.length) return [];
    dayjs.locale('zh-cn');
    const today = dayjs().startOf('day');
    
    // 定义时间分组
    const groups = [
      { key: 'today', label: '今天', filter: (date: dayjs.Dayjs) => date.isSame(today, 'day') },
      { key: 'yesterday', label: '昨天', filter: (date: dayjs.Dayjs) => date.isSame(today.subtract(1, 'day'), 'day') },
      { key: 'week', label: '七日内', filter: (date: dayjs.Dayjs) => 
        date.isAfter(today.subtract(7, 'day')) && !date.isSame(today, 'day') && !date.isSame(today.subtract(1, 'day'), 'day') },
      { key: 'month', label: '30天内', filter: (date: dayjs.Dayjs) => 
        date.isAfter(today.subtract(30, 'day')) && date.isBefore(today.subtract(7, 'day')) }
    ];
    
    // 分组结果
    const result: { dateStr: string; data: EditableConversation[] }[] = [];
    
    // 处理分组
    groups.forEach(group => {
      const items = data.filter(item => {
        const itemDate = dayjs(item.createdAt);
        return group.filter(itemDate);
      });
      
      if (items.length) {
        result.push({ dateStr: group.label, data: items });
      }
    });
    
    // 处理超过30天的数据，按年月分组
    const olderItems = data.filter(item => {
      const itemDate = dayjs(item.createdAt);
      return itemDate.isBefore(today.subtract(30, 'day'));
    });
    
    if (olderItems.length) {
      // 按年月分组
      const monthGroups: Record<string, EditableConversation[]> = {};
      
      olderItems.forEach(item => {
        const monthStr = dayjs(item.createdAt).format('YYYY年MM月');
        if (!monthGroups[monthStr]) {
          monthGroups[monthStr] = [];
        }
        monthGroups[monthStr].push(item);
      });
      
      // 添加到结果
      Object.entries(monthGroups).forEach(([monthStr, items]) => {
        result.push({ dateStr: monthStr, data: items });
      });
    }
    
    return result;
  }

  // 编辑对话标题
  const handleEditMode = (pIndex: number, cIndex: number, editable: boolean) => {
    setConversations(conversations?.map((item, index) => {
      if (index === pIndex) {
        item.data[cIndex].editable = editable;
      }
      return item;
    }))
  }

  const handleDelete = (id: string) => {
    modal.error({
      title: '永久删除对话',
      content: '删除后，该对话将不可恢复。确认删除吗？',
      centered: true,
      okType: 'danger',
      okText: '确认',
      onOk: () => {
        delConversation(id);
      }
    });
  };

  // 编辑对话标题
  const handleRename = (pIndex: number, cIndex: number, newTitle: string) => {
    setConversations(conversations?.map((item, index) => {
      if (index === pIndex) {
        item.data[cIndex].title = newTitle;
      }
      return item;
    }))
    handleSaveTitle(conversations?.[pIndex].data[cIndex]._id as string, newTitle);
  };

  // 保存编辑
  const handleSaveTitle = debounce((id: string, title: string) => {
    editConversation(id, title);
  }, 500);

  return {
    conversations,
    modalContextHolder,
    handleEditMode,
    handleDelete,
    handleRename,
  };
}; 