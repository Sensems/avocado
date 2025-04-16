import { Conversation } from "@/api";

export interface Conversations {
  dateStr: string;
  data: (Conversation & { editable: boolean })[]
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

