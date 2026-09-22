jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android ?? obj.default,
  },
  StyleSheet: {
    create: (styles: any) => styles,
    hairlineWidth: 1,
    absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 400, height: 800 })),
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  SectionList: 'SectionList',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  Alert: { alert: jest.fn() },
}));

/**
 * chatRepository.test.ts
 * Unit tests for ChatSessionRepository and ChatMessageRepository (Sprint P3-B).
 */

import { chatSessionRepository } from '../database/repositories/ChatSessionRepository';
import { chatMessageRepository } from '../database/repositories/ChatMessageRepository';

describe('Sprint P3-B — Chat Repositories Test Suite', () => {
  beforeEach(async () => {
    await chatSessionRepository.clearAllSessions();
    await chatMessageRepository.clearAllMessages();
  });

  describe('ChatSessionRepository', () => {
    it('creates and retrieves a new chat session', async () => {
      const session = await chatSessionRepository.createSession('Test Session', 'sess_test_1');
      expect(session).toBeDefined();
      expect(session.id).toBe('sess_test_1');
      expect(session.title).toBe('Test Session');
      expect(session.created_at).toBeDefined();
      expect(session.updated_at).toBeDefined();

      const fetched = await chatSessionRepository.getSession('sess_test_1');
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe('sess_test_1');
      expect(fetched?.title).toBe('Test Session');
    });

    it('lists sessions ordered by updated_at descending', async () => {
      await chatSessionRepository.createSession('Old Chat', 'sess_old');
      await new Promise((r) => setTimeout(r, 10));
      await chatSessionRepository.createSession('New Chat', 'sess_new');

      const list = await chatSessionRepository.listSessions(10);
      expect(list.length).toBe(2);
      expect(list[0].id).toBe('sess_new');
      expect(list[1].id).toBe('sess_old');
    });

    it('updates session fields including preview and summary', async () => {
      await chatSessionRepository.createSession('Initial Title', 'sess_upd');
      await chatSessionRepository.updateSession('sess_upd', {
        title: 'Renamed Title',
        last_message_preview: 'Here is what I found...',
        summary: 'Discussion about payments and flights.',
      });

      const updated = await chatSessionRepository.getSession('sess_upd');
      expect(updated?.title).toBe('Renamed Title');
      expect(updated?.last_message_preview).toBe('Here is what I found...');
      expect(updated?.summary).toBe('Discussion about payments and flights.');
    });

    it('deletes session and clears data', async () => {
      await chatSessionRepository.createSession('To Delete', 'sess_del');
      await chatSessionRepository.deleteSession('sess_del');

      const fetched = await chatSessionRepository.getSession('sess_del');
      expect(fetched).toBeNull();
    });
  });

  describe('ChatMessageRepository', () => {
    it('saves user and assistant messages with citations', async () => {
      const sessionId = 'sess_msg_test';

      await chatMessageRepository.saveMessage({
        id: 'msg_u1',
        session_id: sessionId,
        role: 'user',
        content: 'Show Amazon receipts',
        created_at: new Date().toISOString(),
      });

      await chatMessageRepository.saveMessage({
        id: 'msg_a1',
        session_id: sessionId,
        role: 'assistant',
        content: 'Found 1 Amazon receipt for ₹1,499.',
        created_at: new Date(Date.now() + 100).toISOString(),
        citations: [
          {
            screenshotId: 'sc_amazon_1',
            fileName: 'amazon_order.png',
            snippet: 'Amazon order total: ₹1,499',
            merchant: 'Amazon',
            amount: 1499,
          },
        ],
        screenshot_ids: ['sc_amazon_1'],
      });

      const count = await chatMessageRepository.getMessageCount(sessionId);
      expect(count).toBe(2);

      const msgs = await chatMessageRepository.getMessagesBySession(sessionId);
      expect(msgs.length).toBe(2);
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('Show Amazon receipts');
      expect(msgs[1].role).toBe('assistant');
      expect(msgs[1].citations?.length).toBe(1);
      expect(msgs[1].citations?.[0].merchant).toBe('Amazon');
      expect(msgs[1].screenshot_ids).toContain('sc_amazon_1');
    });

    it('deletes messages by session ID', async () => {
      const sessionId = 'sess_msg_del';
      await chatMessageRepository.saveMessage({
        id: 'msg_del1',
        session_id: sessionId,
        role: 'user',
        content: 'Hello',
        created_at: new Date().toISOString(),
      });

      await chatMessageRepository.deleteMessagesBySession(sessionId);
      const count = await chatMessageRepository.getMessageCount(sessionId);
      expect(count).toBe(0);
    });
  });
});
