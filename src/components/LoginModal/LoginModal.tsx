import React, { useState, useEffect } from 'react';
import { LockOutlined, CloseOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Form, Input, Typography, message, FormProps } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import useUserStore from '@/stores/userStore';

interface LoginFormValues {
  username: string;
  password: string;
}

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ visible, onClose, onLoginSuccess }) => {
  const { login } = useUserStore()
  const [loading, setLoading] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const onFinish: FormProps<LoginFormValues>['onFinish'] = async (values) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      messageApi.success('欢迎回来');
      onLoginSuccess();
    } catch (error) {
      // messageApi.error('登录失败，请检查凭证');
      console.log('error',error)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      form.resetFields();
    }
  }, [visible, form]);

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* 将毛玻璃背景独立出来，直接应用动画 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-lg z-2098"
            onClick={onClose}
          />
          
          <div className="fixed inset-0 z-2099 overflow-y-auto">
            {/* 内容部分保持不变 */}
            {contextHolder}
            
            {/* 登录内容 */}
            <div className="flex items-center justify-center min-h-screen p-4">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="relative w-full max-w-sm bg-white bg-opacity-90 rounded-xl shadow-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 关闭按钮 */}
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="关闭登录"
                >
                  <CloseOutlined className="text-base" />
                </button>

                {/* 登录内容 */}
                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <Typography.Title level={4} className="mb-1">登录AI助手</Typography.Title>
                    <Typography.Text type="secondary" className="text-sm">继续操作前请先登录您的账户</Typography.Text>
                  </div>

                  <Form<LoginFormValues>
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                  >
                    <Form.Item<LoginFormValues>
                      name="username"
                      rules={[{ required: true, message: '请输入邮箱' }]}
                    >
                      <Input
                        prefix={<MailOutlined className="text-gray-400" />}
                        placeholder="邮箱"
                        size="middle"
                        className="py-2 px-3 rounded-lg"
                      />
                    </Form.Item>

                    <Form.Item<LoginFormValues>
                      name="password"
                      rules={[{ required: true, message: '请输入密码' }]}
                    >
                      <Input.Password
                        prefix={<LockOutlined className="text-gray-400" />}
                        placeholder="密码"
                        size="middle"
                        className="py-2 px-3 rounded-lg"
                      />
                    </Form.Item>

                    <Form.Item className="mt-6">
                      <Button
                        type="primary"
                        htmlType="submit"
                        size="middle"
                        loading={loading}
                        block
                        className="h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 border-none"
                      >
                        登 录
                      </Button>
                    </Form.Item>
                  </Form>

                  <div className="mt-4 text-center text-sm text-gray-500">
                    还没有账号?{' '}
                    <a className="text-blue-500 hover:text-blue-700" href="#">
                      立即注册
                    </a>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;