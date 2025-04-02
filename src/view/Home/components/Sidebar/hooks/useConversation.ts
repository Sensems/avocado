import { useState } from 'react';
import { Modal } from 'antd';
import { Conversation } from '../types';

export const useConversation = () => {
  const [modal, modalContextHolder] = Modal.useModal();
  
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      label: 'This is panel header 1This is panel header 1',
      editable: false,
    },
    {
      label: 'This is panel header 2This is panel header 1',
      editable: false,
    },
    {
      label: 'This is panel header 3This is panel header 1',
      editable: false,
    },
    {
      label: 'This is panel header 4',
      editable: false,
    },
  ]);

  const handleEditMode = (index: number, editable: boolean) => {
    setConversations(conversations.map((item, i) => 
      i === index ? { ...item, editable } : item
    ));
  };

  const handleDelete = (index: number) => {
    modal.error({
      title: '永久删除对话',
      content: '删除后，该对话将不可恢复。确认删除吗？',
      centered: true,
      okType: 'danger',
      okText: '确认',
      onOk: () => {
        setConversations(conversations.filter((_, i) => i !== index));
      }
    });
  };

  const handleRename = (index: number, newLabel: string) => {
    setConversations(conversations.map((item, i) => 
      i === index ? { ...item, label: newLabel } : item
    ));
  };

  return {
    conversations,
    modalContextHolder,
    handleEditMode,
    handleDelete,
    handleRename,
  };
}; 