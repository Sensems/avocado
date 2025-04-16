import { useState } from 'react';
import { UploadFile } from 'antd';
import Sender from './components/Sender';
import Bubble from './components/Bubble';
import logo from '../../../../assets/images/logo.png';
import useConversationStore from '@/stores/conversationStore';
// import TestBubble from './components/TestBubble';


const ChatView: React.FC = () => {
  const { createConversation } = useConversationStore();
  const [content, setContent] = useState('');
  const [conversationInfo, setConversationInfo] = useState({
    id: undefined as undefined | string,
    title: '新对话',
  });


  // 发送消息
  const handleSend = async (
    content: string,
    options: { deepThinking: boolean; webSearch: boolean },
    files: UploadFile[]
  ) => {
    if (conversationInfo.id) {

    } else {
      handleCreateConversation(content);
    }
    // console.log(content, options, files);
    // setContent(content);

  };

  // 创建对话
  const handleCreateConversation = async (title: string) => {
    const res = await createConversation(title);
    setConversationInfo({
      id: res._id,
      title: res.title,
    });
  }

  return (
    <div className="w-full h-full flex justify-center">
      <div className={`relative w-80% ${conversationInfo.id ? 'pb-150px' : 'flex items-center'}`}>
        {conversationInfo.id && <div className='h-full overflow-y-auto'>
          <Bubble content='' streamContent={content} isTyping isAI />
        </div>}
        <div className={`bottom-0 w-full ${conversationInfo.id ? 'absolute' : ''}`}>
          <div className='flex flex-col items-center gap-1 mb-6'>
            <div className='flex items-center gap-4'>
              <img className='w-30px h-30px' src={logo} alt="logo" />
              <p className='text-28px text-#2f2f2f'>我是 Avocado，很高兴见到你！</p>
            </div>
            <div className='text-14px text-#888888'>我可以帮你写代码、读文件、写作各种创意内容，请把你的任务交给我吧~</div>
          </div>
          <Sender onSend={handleSend} loading={false} />
        </div>
      </div>
    </div>
    // <TestBubble />
  );
};

export default ChatView;
