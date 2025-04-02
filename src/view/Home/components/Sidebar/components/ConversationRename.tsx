import React, { useRef, useEffect } from 'react';
import type { InputRef } from 'antd';
import { Input } from 'antd';
import { ConversationRenameProps } from '../types';
import siderModules from '../Sidebar.module.scss';

export const ConversationRename: React.FC<ConversationRenameProps> = ({
  item,
  onBlur,
  onChange
}) => {
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className={`${siderModules.conversationRenameView}`}>
      <Input 
        ref={inputRef}
        classNames={{ 
          input: '!text-15px'
        }} 
        variant="borderless" 
        value={item.label} 
        onBlur={onBlur}
        onChange={onChange}
      />
    </div>
  );
}; 