export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessageCitation {
  screenshotId: string;
  fileName: string;
  snippet?: string;
  thumbnailPath?: string;
}

export interface ChatMessageModel {
  id: string;
  sessionId: string;
  folderId?: string;
  screenshotId?: string;
  role: ChatRole;
  content: string;
  citations: ChatMessageCitation[];
  createdAt: string;
}

export interface ChatSessionModel {
  id: string;
  title: string;
  folderId?: string;
  screenshotId?: string;
  createdAt: string;
  updatedAt: string;
}
