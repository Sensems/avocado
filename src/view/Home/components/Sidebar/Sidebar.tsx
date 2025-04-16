import { Button } from 'antd';
import { useState } from 'react';
import useUserStore from '@/stores/userStore';
import { motion, AnimatePresence } from 'framer-motion';
import { MenuUnfoldOutlined, MenuFoldOutlined, CommentOutlined } from '@ant-design/icons';


import logo from '../../../../assets/images/logo.png';
import textLogo from '../../../../assets/images/text-logo.png';
import UserInfo from './components/UserInfo';
import { Conversations } from '@/components/Conversations/Conversations';

export const Sidebar: React.FC = () => {
  const { isAuthenticated, setShowLoginPanel } = useUserStore()
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const sidebarWidth = isExpanded ? 260 : 68;

  // 添加对话
  const addConversation = () => {
    if (!isAuthenticated) {
      setShowLoginPanel(true)
      return
    }
  }
  return (
    <motion.div
      className='box-border flex flex-col h-full pb-10px bg-#F8F9FC'
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

        {isExpanded && <Conversations />}
      </div>

      <div className='px-10px mt-auto'>
        <UserInfo sidebarExpanded={isExpanded} />
      </div>
    </motion.div>
  );
};