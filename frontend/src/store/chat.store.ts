import { create } from 'zustand';
import { ChatMessageModel } from '../models';
import { contextChatService } from '../services/ContextChatService';

interface ChatState {
  currentFolderId: string | null;
  currentFolderName: string;
  currentScreenshotId: string | null;
  activeSessionId: string | null;
  messages: ChatMessageModel[];
  suggestions: string[];
  loading: boolean;
  typing: boolean;
  isOffline: boolean;
  error: string | null;

  // Actions
  initConversation: (folderId: string, folderName?: string, screenshotId?: string) => Promise<void>;
  loadConversation: (folderId?: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  clearConversation: () => Promise<void>;
  refreshSuggestions: () => Promise<void>;
  setMessages: (messages: ChatMessageModel[]) => void;
  appendMessage: (message: ChatMessageModel) => void;
  setTyping: (typing: boolean) => void;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentFolderId: null,
  currentFolderName: 'Smart Folder',
  currentScreenshotId: null,
  activeSessionId: null,
  messages: [],
  suggestions: [],
  loading: false,
  typing: false,
  isOffline: false,
  error: null,

  initConversation: async (folderId: string, folderName = 'Smart Folder', screenshotId?: string) => {
    const prevFolder = get().currentFolderId;
    if (prevFolder === folderId && get().messages.length > 0) {
      // Already active in this folder; refresh suggestions in background
      get().refreshSuggestions();
      return;
    }

    set({
      currentFolderId: folderId,
      currentFolderName: folderName,
      currentScreenshotId: screenshotId || null,
      activeSessionId: `session_${folderId}`,
      messages: [],
      suggestions: [],
      loading: true,
      typing: false,
      error: null,
    });

    try {
      const [history, suggestions] = await Promise.all([
        contextChatService.loadHistory(folderId, `session_${folderId}`),
        contextChatService.loadSuggestions(folderId, folderName),
      ]);

      const hasOfflineMsg = history.some((m) => m.syncStatus === 'offline');

      set({
        messages: history,
        suggestions,
        loading: false,
        isOffline: hasOfflineMsg,
      });
    } catch (err: any) {
      set({
        loading: false,
        error: err?.message || 'Failed to initialize conversation',
      });
    }
  },

  loadConversation: async (folderId?: string) => {
    const targetFolderId = folderId || get().currentFolderId;
    if (!targetFolderId) return;

    set({ loading: true, error: null });
    try {
      const history = await contextChatService.loadHistory(targetFolderId, get().activeSessionId || undefined);
      set({ messages: history, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err?.message || 'Failed to load conversation' });
    }
  },

  sendMessage: async (content: string) => {
    const trimmed = content.trim();
    const folderId = get().currentFolderId;
    if (!trimmed || !folderId || get().typing) return;

    // Set typing state immediately
    set({ typing: true, error: null });

    try {
      const { userMessage, assistantMessage } = await contextChatService.sendMessage({
        folderId,
        folderName: get().currentFolderName,
        content: trimmed,
        sessionId: get().activeSessionId || undefined,
        screenshotId: get().currentScreenshotId || undefined,
      });

      // Update messages list reactively
      set((state) => {
        // If user message is already in list (e.g. optimistic), replace or append
        const exists = state.messages.some((m) => m.id === userMessage.id);
        const next = exists ? state.messages : [...state.messages, userMessage];
        return {
          messages: [...next, assistantMessage],
          typing: false,
          isOffline: assistantMessage.syncStatus === 'offline',
          suggestions: assistantMessage.suggestedFollowUps && assistantMessage.suggestedFollowUps.length > 0
            ? assistantMessage.suggestedFollowUps
            : state.suggestions,
        };
      });
    } catch (err: any) {
      set({
        typing: false,
        error: err?.message || 'Failed to send message',
      });
    }
  },

  clearConversation: async () => {
    const folderId = get().currentFolderId;
    if (!folderId) return;

    set({ loading: true });
    try {
      await contextChatService.deleteHistory(folderId, get().activeSessionId || undefined);
      set({ messages: [], loading: false });
      // Reload fresh suggestions
      get().refreshSuggestions();
    } catch (err: any) {
      set({ loading: false, error: err?.message || 'Failed to clear conversation' });
    }
  },

  refreshSuggestions: async () => {
    const folderId = get().currentFolderId;
    if (!folderId) return;

    const suggestions = await contextChatService.loadSuggestions(
      folderId,
      get().currentFolderName
    );
    set({ suggestions });
  },

  setMessages: (messages: ChatMessageModel[]) => set({ messages }),

  appendMessage: (message: ChatMessageModel) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setTyping: (typing: boolean) => set({ typing }),

  setError: (error: string | null) => set({ error }),
}));
