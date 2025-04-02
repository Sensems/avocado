import { useState } from 'react';
import { Button, theme } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import useUserStore from '@/stores/userStore';
import { MenuUnfoldOutlined, MenuFoldOutlined, CommentOutlined } from '@ant-design/icons';
import { ConversationItem } from './components/ConversationItem';
import { ConversationRename } from './components/ConversationRename';
import { useConversation } from './hooks/useConversation';
// import siderModules from './Sidebar.module.scss';

import logo from '../../../../assets/images/logo.png';
import textLogo from '../../../../assets/images/text-logo.png';
import UserInfo from './components/UserInfo';

export const Sidebar: React.FC = () => {
  const { isAuthenticated, setShowLoginPanel } = useUserStore()
  const { token } = theme.useToken();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const sidebarWidth = isExpanded ? 260 : 68;

  const { 
    conversations, 
    modalContextHolder,
    handleEditMode,
    handleDelete,
    handleRename 
  } = useConversation();

  // 添加对话
  const addConversation = () => {
    if (!isAuthenticated) {
      setShowLoginPanel(true)
      return
    }
  }

  return (
    <motion.div
      className='box-border flex flex-col h-full pb-10px'
      style={{
        backgroundColor: token.colorBgLayout,
      }}
      initial={{ width: 260 }}
      animate={{ width: sidebarWidth }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className='flex-1'>
        <div className={`flex justify-between items-center p-4 ${isExpanded ? '' : 'flex-col'}`}>
          <AnimatePresence>
            {isExpanded ? 
              <img className='!h-20px' src={textLogo} alt="logo" /> : 
              <img className='!h-30px mb-4' src={logo} alt="logo" />
            }
          </AnimatePresence>
          <Button 
            type="text" 
            icon={isExpanded ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />} 
            onClick={() => setIsExpanded(!isExpanded)}
          />
        </div>

        <div className="mb-4 pl-4">
          <Button 
            color="primary" 
            variant="filled" 
            icon={<CommentOutlined />} 
            size="large"
            onClick={addConversation}
          >
            {isExpanded ? '开启新对话' : ''}
          </Button>
        </div>

        {isExpanded && (
          <div className="h-400px overflow-y-auto px-10px text-#555555">
            <div className="relative">
              <div 
                className='text-13px font-bold sticky top-0 z-2' 
                style={{ background: token.colorBgLayout }}
              >
                今天
              </div>

              {conversations.map((item, index) => (
                item.editable ? (
                  <ConversationRename
                    key={index}
                    item={item}
                    onBlur={() => handleEditMode(index, false)}
                    onChange={(e) => handleRename(index, e.target.value)}
                  />
                ) : (
                  <ConversationItem
                    key={index}
                    item={item}
                    index={index}
                    isActive={activeIndex === index}
                    onSelect={() => setActiveIndex(index)}
                    onRename={() => handleEditMode(index, true)}
                    onDelete={() => handleDelete(index)}
                  />
                )
              ))}
            </div>
          </div>
        )}
      </div>

      {modalContextHolder}
      <div className='px-10px mt-auto'>
        <UserInfo sidebarExpanded={isExpanded} />
      </div>
    </motion.div>
  );
};