import React, { useState, useRef } from 'react';
import { Input, Upload, Button, Progress, Space, message } from 'antd';
import {
  SendOutlined,
  DeleteOutlined,
  GlobalOutlined,
  BulbOutlined,
  FileAddOutlined,
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';

const { TextArea } = Input;

interface SenderProps {
  onSend: (
    content: string,
    options: { deepThinking: boolean; webSearch: boolean },
    files: UploadFile[]
  ) => Promise<void>;
  loading?: boolean;
}

const Sender: React.FC<SenderProps> = ({ onSend, loading = false }) => {
  const [content, setContent] = useState('');
  const [deepThinking, setDeepThinking] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!content.trim() && fileList.length === 0) return;

    try {
      await onSend(content, { deepThinking, webSearch }, fileList);
      setContent('');
      setFileList([]);
    } catch (error) {
      message.error('发送失败，请重试');
    }
  };

  const uploadProps: UploadProps = {
    fileList,
    showUploadList: false,
    onChange: ({ fileList: newFileList }) => {
      setFileList(newFileList);
    },
    beforeUpload: (file) => {
      return false;
    },
    multiple: true,
    maxCount: 5,
  };

  // 点击编辑区域
  const handleClickEditArea = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  // 回车发送
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="cursor-text">
      <div className="max-w-3xl mx-auto">
        <div className="bg-[#F3F4F6] rounded-20px shadow-sm" onClick={handleClickEditArea}>
          <TextArea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="给 DeepSeek 发送消息"
            autoSize={{ minRows: 2, maxRows: 5 }}
            className="w-full resize-none px-4 py-3 rounded-xl border-0 focus:shadow-none"
            ref={inputRef}
            style={{
              backgroundColor: '#F3F4F6',
            }}
          />

          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <Button
                type={deepThinking ? 'primary' : 'default'}
                icon={<BulbOutlined />}
                size="small"
                onClick={() => setDeepThinking(!deepThinking)}
                className={`flex items-center gap-1 rounded-full px-3`}
              >
                <span className="text-xs">深度思考(R1)</span>
              </Button>

              <Button
                type={webSearch ? 'primary' : 'default'}
                icon={<GlobalOutlined />}
                size="small"
                onClick={() => setWebSearch(!webSearch)}
                className={`flex items-center gap-1 rounded-full px-3`}
              >
                <span className="text-xs">联网搜索</span>
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <Upload {...uploadProps}>
                <Button
                  type="text"
                  size="large"
                  icon={<FileAddOutlined />}
                  className="flex items-center text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                />
              </Upload>
              <Button
                type="primary"
                shape="circle"
                size="large"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={loading}
                disabled={!content.trim() && fileList.length === 0}
              />
            </div>
          </div>
        </div>

        {fileList.length > 0 && (
          <div className="mt-3 bg-white rounded-lg p-3">
            <div className="text-sm text-gray-500 mb-2">已上传文件：</div>
            <Space direction="vertical" className="w-full">
              {fileList.map((file) => (
                <div
                  key={file.uid}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <span className="text-sm text-gray-700">{file.name}</span>
                    {file.status === 'uploading' && (
                      <Progress
                        percent={file.percent}
                        size="small"
                        className="ml-4 mb-0 w-24"
                        strokeColor="#1890ff"
                      />
                    )}
                  </div>
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      setFileList(fileList.filter((item) => item.uid !== file.uid));
                    }}
                    size="small"
                    className="text-gray-400 hover:text-red-500"
                  />
                </div>
              ))}
            </Space>
          </div>
        )}
      </div>
      <div className='flex justify-center w-full text-12px text-#a3a3a3 my-1'>内容由 AI 生成，请仔细甄别</div>
    </div>
  );
};

export default Sender;
