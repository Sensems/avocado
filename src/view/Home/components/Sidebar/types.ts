export interface Conversation {
  label: string;
  editable: boolean;
}

export interface ConversationItemProps {
  item: Conversation;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export interface ConversationRenameProps {
  item: Conversation;
  onBlur: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface UserInfoProps {
  sidebarExpanded: boolean;
}

