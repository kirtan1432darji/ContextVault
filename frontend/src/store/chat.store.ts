import { create } from 'zustand';
import { ChatMessageModel } from '../models';

interface ChatState {
  activeSessionId: string | null;
  messages: ChatMessageModel[];
  isSending: boolean;
  error: string | null;

  // Actions
  setActiveSessionId: (sessionId: string | null) => void;
  setMessages: (messages: ChatMessageModel[]) => void;
  appendMessage: (message: ChatMessageModel) => void;
  setSending: (isSending: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeSessionId: null,
  messages: [],
  isSending: false,
  error: null,

  setActiveSessionId: (sessionId: string | null) => set({ activeSessionId: sessionId }),

  setMessages: (messages: ChatMessageModel[]) => set({ messages }),

  appendMessage: (message: ChatMessageModel) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setSending: (isSending: boolean) => set({ isSending }),

  setError: (error: string | null) => set({ error }),

  clearMessages: () => set({ messages: [], activeSessionId: null, error: null }),
}));
