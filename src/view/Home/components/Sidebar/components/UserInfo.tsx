import { Avatar, Dropdown, MenuProps } from "antd";
import userStore from "@/stores/userStore";
import siderModules from '../Sidebar.module.scss';
import { LogoutOutlined } from "@ant-design/icons";

interface UserInfoProps {
  sidebarExpanded: boolean;
}

const UserInfo: React.FC<UserInfoProps> = ({ sidebarExpanded }) => {
  const { user, isAuthenticated, logout, setShowLoginPanel } = userStore();
  const dropdownItems: MenuProps['items'] & { key: string }[] = [ // 下拉菜单
    {
      key: 'username',
      label: user?.username,
      icon: false,
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
    },
  ];

  // 下拉菜单点击事件
  const handleDropdownClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      logout();
    }
  }

  const handleUserInfoClick = () => {
    if (!isAuthenticated) {
      setShowLoginPanel(true);
    }
  }

  return (
    <Dropdown
      menu={{ items: dropdownItems, onClick: handleDropdownClick }}
      placement="topLeft"
      trigger={['click']}
      overlayStyle={{ maxWidth: '240px' }}
      disabled={!isAuthenticated}

    >
      <div className={siderModules.userInfo} onClick={handleUserInfoClick}>
        <Avatar className="min-w-28px" size={28} style={{ backgroundColor: '#F56A00' }}>
          {user?.username.slice(0, 1).toUpperCase()}
        </Avatar>
        {sidebarExpanded && <div className="text-14px text-#555555 whitespace-nowrap overflow-hidden">{isAuthenticated ? '个人信息' : '请登录后使用'}</div>}
      </div>
    </Dropdown>
  );
}

export default UserInfo;