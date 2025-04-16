import { useEffect, useState } from 'react';
import useUserStore from '@/stores/userStore';
import { useConversation } from './hooks/useConversation';
import useConversationStore from '@/stores/conversationStore';
import { ConversationItem } from './components/ConversationItem';
import { ConversationRename } from './components/ConversationRename';


export const Conversations: React.FC = () => {
  const { isAuthenticated } = useUserStore()
  const { getConversationList } = useConversationStore();
  const [activeId, setActiveId] = useState('');

  const {
    conversations,
    handleEditMode,
    modalContextHolder,
    handleDelete,
    handleRename
  } = useConversation();

  useEffect(() => {
    if (isAuthenticated) {
      getConversationList();
    }
  }, [])

  return (
    <div className="max-h-400px overflow-y-auto px-10px text-#555555">
      <div className="relative">
        {
          conversations?.map((dateGroupItem, pIndex) => (
            <div className='mb-4' key={dateGroupItem.dateStr}>
              <div
                className='text-13px font-bold sticky top-0 z-2 bg-#F8F9FC mb-2'
              >
                {dateGroupItem.dateStr}
              </div>

              {dateGroupItem.data.map((conversation, index) => (
                conversation.editable ? (
                  <ConversationRename
                    key={conversation._id}
                    item={conversation}
                    onBlur={() => handleEditMode(pIndex, index, false)}
                    onChange={(e) => handleRename(pIndex, index, e.target.value)}
                  />
                ) : (
                  <ConversationItem
                    key={conversation._id}
                    item={conversation}
                    index={index}
                    isActive={activeId === conversation._id}
                    onSelect={() => setActiveId(conversation._id)}
                    onRename={() => handleEditMode(pIndex, index, true)}
                    onDelete={() => handleDelete(conversation._id)}
                  />
                )
              ))}
            </div>
          ))
        }
      </div>

      {modalContextHolder}
    </div>
  );
};