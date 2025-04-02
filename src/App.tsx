import { Button, ConfigProvider, Space } from 'antd';
import React, { useState } from 'react';
import LoginModal from './components/LoginModal/LoginModal'
import Home from './view/Home/Home';

const App: React.FC = () => {
  const [loginVisible, setLoginVisible] = useState<boolean>(false);

  const handleLogin = () => {
    setLoginVisible(true);
  };

  return (
    <ConfigProvider
    theme={{
      token: {},
      cssVar: {
        key: 'css-var-ant'
      },
      hashed: false,
    }}
  >
    <Home />
    <LoginModal 
        visible={loginVisible}
        onClose={() => setLoginVisible(false)}
        onLoginSuccess={() => {
          setLoginVisible(false);
          // 登录成功后的操作
        }}
      />
  </ConfigProvider>
  )
};

export default App;
