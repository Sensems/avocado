import { Button, Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { EllipsisOutlined, FormOutlined, DeleteOutlined } from '@ant-design/icons';
import { ConversationItemProps } from '../types';
import conversationsModule from '../conversations.module.scss';

export const ConversationItem: React.FC<ConversationItemProps> = ({
  item,
  index,
  isActive,
  onSelect,
  onRename,
  onDelete
}) => {
  const dropdownItems: MenuProps['items'] = [
    {
      key: 'rename',
      label: "重命名",
      icon: <FormOutlined />
    },
    {
      label: '删除',
      key: 'delete',
      icon: <DeleteOutlined />,
      danger: true,
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'rename') {
      onRename();
    } else if (key === 'delete') {
      onDelete();
    }
  };

  return (
    <div
      className={`h-36px rounded-12px relative flex items-center text-14px ${conversationsModule.conversationItem} ${isActive ? conversationsModule.active : ''}`}
      onClick={onSelect}
    >
      <Tooltip title={item.title.length > 20 ? item.title : null} placement="top">
        <div className="text-nowrap overflow-hidden pl-3">{item.title}</div>
      </Tooltip>
      <div className={`w-28px absolute h-full right-0 ${conversationsModule.markBlock}`} />
      <div className={`w-84px absolute h-full right-0 rounded-r-14px ${conversationsModule.hoverMarkBlock}`} />
      <div className={`absolute right-10px top-50% translate-y-[-50%] ${conversationsModule.operation}`}>
        <Dropdown
          menu={{
            items: dropdownItems,
            onClick: handleMenuClick
          }}
          placement="bottomLeft"
          trigger={['click']}
        >
          <Button variant="text" color='default' size="small" icon={<EllipsisOutlined />}></Button>
        </Dropdown>
      </div>
    </div>
  );
}; 