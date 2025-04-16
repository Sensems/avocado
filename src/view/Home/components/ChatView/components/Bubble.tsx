import React, { useState, useEffect, useRef } from 'react';
import { Avatar, Button, Spin, Tooltip } from 'antd';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import markdowmRender from '@/utils/markdown-it/markdown'

import 'highlight.js/styles/github-dark.css'; // 导入代码高亮样式，可以选择其他主题
import '@/assets/css/markdown.css';


interface ChatBubbleProps {
  content: string;
  isAI: boolean;
  avatar?: string;
  username?: string;
  showAvatar?: boolean;
  showUsername?: boolean;
  showActions?: boolean;
  isRenderMarkdown?: boolean;
  isLoading?: boolean;
  isTyping?: boolean;
  streamContent?: string;
  onRefresh?: () => void;
  onCopy?: () => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({
  content,
  isAI,
  avatar,
  username,
  showAvatar = true,
  showUsername = true,
  showActions = true,
  isLoading = false,
  isTyping = false,
  isRenderMarkdown = true,
  streamContent = '',
  onRefresh,
  onCopy,
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // 打字机效果
  useEffect(() => {
    if (isStreaming || isTyping) {
      const displayContent = streamContent || content;

      if (typingIndex < displayContent.length) {
        const timer = setTimeout(() => {
          setDisplayedContent(displayContent.substring(0, typingIndex + 1));
          setTypingIndex(typingIndex + 1);
        }, 30); // 打字速度可调整

        return () => clearTimeout(timer);
      } else {
        setIsStreaming(false);
      }
    }
  }, [typingIndex, isTyping, isStreaming, content, streamContent]);

  // 处理流式内容
  useEffect(() => {
    if (streamContent) {
      // 检查新内容是否是之前内容的子集
      if (content.startsWith(streamContent) || streamContent.startsWith(content)) {
        // 继续输出
        setDisplayedContent(streamContent.substring(0, typingIndex));
      } else {
        // 重新开始输出
        setTypingIndex(0);
        setDisplayedContent('');
        setIsStreaming(true);
      }
    }
  }, [streamContent, content]);

  // 启动打字机效果
  useEffect(() => {
    if (isTyping && content && !isStreaming) {
      setTypingIndex(0);
      setDisplayedContent('');
      setIsStreaming(true);
    }
  }, [isTyping, content, isStreaming]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    onCopy && onCopy();
  };

  // 渲染Markdown内容
  const renderMarkdown = (text: string) => {
    const html = isRenderMarkdown ? markdowmRender.render(text || '') : text;
    return { __html: html };
  };

  return (
    <div className={`flex mb-4 ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
      {showAvatar && (
        <div className="flex-shrink-0 mx-2">
          <Avatar
            src={avatar}
            className={isAI ? 'bg-blue-500' : 'bg-green-500'}
            size={32}
          >
            {!avatar && (isAI ? 'AI' : username?.[0] || 'U')}
          </Avatar>
        </div>
      )}

      <div className={`flex flex-col max-w-3/4 ${isAI ? 'items-start' : 'items-end'}`}>
        {showUsername && (
          <div className={`text-sm mb-1 ${isAI ? 'text-left' : 'text-right'} text-gray-500`}>
            {username || (isAI ? 'AI助手' : '用户')}
          </div>
        )}

        <div>
          <div
            className={`rounded-lg p-3 relative ${isAI
              ? 'bg-gray-100 text-gray-800'
              : 'bg-blue-500 text-white'
              } shadow-sm`}
          >
            {isLoading ? (
              <div className="flex items-center py-2 px-4">
                <Spin size="small" />
                <span className="ml-2">思考中...</span>
              </div>
            ) : (
              <div
                ref={contentRef}
                className="markdown-content prose prose-sm max-w-none"
                dangerouslySetInnerHTML={renderMarkdown(isTyping ? displayedContent : content)}
              />
            )}
          </div>

          {showActions && !isLoading && (
            <div className="flex gap-2 opacity-50 hover:opacity-100 transition-opacity mt-2">
              <Tooltip title="复制">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={handleCopy}
                  className="text-gray-500"
                />
              </Tooltip>

              {isAI && onRefresh && (
                <Tooltip title="重新生成">
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={onRefresh}
                    className="text-gray-500"
                  />
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;