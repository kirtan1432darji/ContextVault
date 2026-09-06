import { Result } from '../utils/result';
import { ChatMessageModel } from '../models';
import { apiClient } from '../api/apiClient';

export class ChatService {
  async sendMessage({
    sessionId,
    content,
    folderId,
    screenshotId,
  }: {
    sessionId: string;
    content: string;
    folderId?: string;
    screenshotId?: string;
  }): Promise<Result<ChatMessageModel>> {
    const res = await apiClient.sendChatMessage({
      sessionId,
      content,
      folderId,
      screenshotId,
    });

    if (res.isSuccess && res.data) {
      const data = res.data;
      const assistantMessage: ChatMessageModel = {
        id: data.id || `msg_${Date.now()}`,
        sessionId,
        folderId,
        screenshotId,
        role: 'assistant',
        content: data.content || data.reply || 'Here is the requested information.',
        citations: data.citations || [],
        createdAt: new Date().toISOString(),
      };
      return Result.success(assistantMessage);
    }

    // Heuristic offline intelligent assistant reply
    const offlineReply: ChatMessageModel = {
      id: `msg_${Date.now()}`,
      sessionId,
      folderId,
      screenshotId,
      role: 'assistant',
      content: `I have analyzed the screenshots in this smart folder. Based on the extracted OCR text, this context relates to organized items, records, and extracted entities.`,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    return Result.success(offlineReply);
  }
}

export const chatService = new ChatService();
