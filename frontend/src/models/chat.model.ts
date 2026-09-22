export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessageCitation {
  screenshotId: string;
  fileName: string;
  snippet?: string;
  thumbnailPath?: string;
  folderPath?: string;
  confidence?: number;
  merchant?: string;
  amount?: number;
  date?: string;
}

export interface ChatMessageModel {
  id: string;
  sessionId?: string;
  folderId?: string;
  screenshotId?: string;
  role: ChatRole;
  content: string;
  citations: ChatMessageCitation[];
  createdAt: string;
  createdOn?: string;
  suggestedFollowUps?: string[];
  syncStatus?: 'synced' | 'pending' | 'offline';
  promptTokens?: number;
  completionTokens?: number;
}

export interface ChatSessionModel {
  id: string;
  sessionId?: string;
  title?: string;
  folderId?: string;
  screenshotId?: string;
  lastMessage?: string;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSuggestionsModel {
  folderId: string;
  folderName: string;
  suggestions: string[];
}

export interface ChatHistoryEntity {
  id: string;
  session_id?: string | null;
  folder_id?: string | null;
  screenshot_id?: string | null;
  role: string;
  message: string;
  content?: string | null;
  citations_json?: string | null;
  created_on: string;
  created_at?: string | null;
  sync_status: string;
}
