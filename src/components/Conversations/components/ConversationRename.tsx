import React, { useRef, useEffect } from 'react';
import type { InputRef } from 'antd';
import { Input } from 'antd';
import { ConversationRenameProps } from '../types';
import conversationsModule from '../conversations.module.scss';

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
    <div className={`${conversationsModule.conversationRenameView}`}>
      <Input
        ref={inputRef}
        classNames={{
          input: '!text-15px'
        }}
        variant="borderless"
        value={item.title}
        onBlur={onBlur}
        onChange={onChange}
      />
    </div>
  );
}; 