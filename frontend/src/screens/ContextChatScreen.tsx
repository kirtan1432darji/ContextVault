/**
 * ContextChatScreen.tsx
 * Redesigned Production Context Chat Screen for ContextVault (Sprint P3-B).
 * AI Chat over Screenshot Memories using Vision AI, Memory Timeline, Digests, and SQLite.
 * Features:
 * - Multi-session switcher & New Chat creation
 * - Thinking status progression ("Retrieving memories...", "Analyzing timeline...")
 * - Dark premium glassmorphic UI (#0B0F19 background, #161B26 cards, #6366F1 accents)
 * - Tappable rich citation cards with thumbnail preview and metadata badges
 * - Suggested questions carousel & Regenerate answer CTA
 * - Automatic deep link query execution
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import {
  contextChatService,
  ChatAnswerResult,
} from '../services/contextChat/ContextChatService';
import { ChatSessionRecord, chatSessionRepository } from '../database/repositories/ChatSessionRepository';
import { chatMessageRepository } from '../database/repositories/ChatMessageRepository';
import { ChatMessageCitation, ScreenshotModel } from '../models';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';

type Props = NativeStackScreenProps<RootStackParamList, any>;

interface ChatUiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  citedScreenshots?: ScreenshotModel[];
  citations?: ChatMessageCitation[];
  isOffline?: boolean;
  bannerMessage?: string;
  responseTimeMs?: number;
}

export const ContextChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const params = route.params || {};
  const folderId: string | undefined = params.folderId || params.categoryId;
  const initialFolderTitle = params.categoryName || params.folderName || (folderId ? 'Smart Folder' : 'All Memories');

  const theme = useAppTheme();

  // Active Session State
  const defaultSessionId = folderId ? `session_${folderId}` : 'session_global';
  const [currentSessionId, setCurrentSessionId] = useState<string>(defaultSessionId);
  const [sessionTitle, setSessionTitle] = useState<string>(initialFolderTitle);
  const [sessionsList, setSessionsList] = useState<ChatSessionRecord[]>([]);
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);

  // Chat Messages State
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [typing, setTyping] = useState(false);
  const [thinkingStep, setThinkingStep] = useState<string>('Thinking...');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [offlineBanner, setOfflineBanner] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const initialQueryHandled = useRef<boolean>(false);

  // ===========================================================================
  // Session & Message Loading
  // ===========================================================================

  const refreshSessionsList = useCallback(async () => {
    try {
      const list = await contextChatService.listSessions(30);
      setSessionsList(list);
    } catch {
      // Ignored
    }
  }, []);

  const loadConversation = useCallback(async (sessionIdToLoad: string) => {
    try {
      const { session, messages: dbMsgs } = await contextChatService.loadSession(sessionIdToLoad);

      if (session) {
        setSessionTitle(session.title || initialFolderTitle);
      }

      if (dbMsgs && dbMsgs.length > 0) {
        setMessages(
          dbMsgs.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.content,
            timestamp: m.created_at,
            citations: m.citations,
          }))
        );
      } else {
        // Welcome greeting
        setMessages([
          {
            id: 'msg_welcome',
            role: 'assistant',
            text: `Hi! I'm your offline **Context AI Assistant**.\n\nI can answer questions across your screenshot memories, payment history, travel tickets, shopping receipts, and daily digests.\n\nTry asking me anything below!`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }

      const suggs = await contextChatService.loadSuggestions(folderId, initialFolderTitle);
      setSuggestions(suggs);
    } catch {
      // Fallback
    }
  }, [folderId, initialFolderTitle]);

  useEffect(() => {
    loadConversation(currentSessionId);
    refreshSessionsList();
  }, [currentSessionId, loadConversation, refreshSessionsList]);

  // Deep Link: Automatically run initial query if provided in route params
  useEffect(() => {
    if (params.initialQuery && !initialQueryHandled.current) {
      initialQueryHandled.current = true;
      setTimeout(() => {
        handleSend(params.initialQuery);
      }, 350);
    }
  }, [params.initialQuery]);

  // Auto-scroll to end on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 120);
    }
  }, [messages.length, typing]);

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  const handleSend = async (textToSend?: string) => {
    const q = (textToSend || inputText).trim();
    if (!q || typing) return;

    setInputText('');

    const userMsg: ChatUiMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: q,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);
    setThinkingStep('Retrieving memories...');
    setOfflineBanner(null);

    try {
      const res: ChatAnswerResult = await contextChatService.askQuestion(q, {
        folderId,
        sessionId: currentSessionId,
        onStatusChange: (status) => setThinkingStep(status),
      });

      if (res.isOfflineResponse) {
        setOfflineBanner('Offline metadata response.');
      }

      const assistantMsg: ChatUiMessage = {
        id: res.assistantMessageId,
        role: 'assistant',
        text: res.answer,
        timestamp: new Date().toISOString(),
        citedScreenshots: res.citedScreenshots,
        citations: res.citations,
        isOffline: res.isOfflineResponse,
        bannerMessage: res.bannerMessage,
        responseTimeMs: res.responseTimeMs,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      refreshSessionsList();
    } catch (err: any) {
      const fallbackMsg: ChatUiMessage = {
        id: `ast_err_${Date.now()}`,
        role: 'assistant',
        text: `I searched your local vault, but encountered an error processing "${q}". Please try a different query.`,
        timestamp: new Date().toISOString(),
        isOffline: true,
        bannerMessage: 'Offline metadata response.',
      };
      setOfflineBanner('Offline metadata response.');
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setTyping(false);
    }
  };

  const handleRegenerate = async () => {
    if (typing) return;
    setTyping(true);
    setThinkingStep('Re-analyzing memories...');
    try {
      const res = await contextChatService.regenerateResponse(currentSessionId, {
        folderId,
        onStatusChange: (s) => setThinkingStep(s),
      });

      const assistantMsg: ChatUiMessage = {
        id: res.assistantMessageId,
        role: 'assistant',
        text: res.answer,
        timestamp: new Date().toISOString(),
        citedScreenshots: res.citedScreenshots,
        citations: res.citations,
        isOffline: res.isOfflineResponse,
        bannerMessage: res.bannerMessage,
        responseTimeMs: res.responseTimeMs,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      Alert.alert('Regeneration Failed', err?.message || 'Could not regenerate response.');
    } finally {
      setTyping(false);
    }
  };

  // ===========================================================================
  // Session Actions
  // ===========================================================================

  const handleNewChat = async () => {
    const newSession = await contextChatService.createSession('New Conversation');
    setCurrentSessionId(newSession.id);
    setSessionTitle(newSession.title);
    setShowSessionModal(false);
  };

  const handleSelectSession = (s: ChatSessionRecord) => {
    setCurrentSessionId(s.id);
    setSessionTitle(s.title);
    setShowSessionModal(false);
  };

  const handleDeleteSession = (s: ChatSessionRecord) => {
    Alert.alert('Delete Conversation', `Are you sure you want to delete "${s.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await contextChatService.deleteSession(s.id);
          if (currentSessionId === s.id) {
            handleNewChat();
          } else {
            refreshSessionsList();
          }
        },
      },
    ]);
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear this conversation history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await contextChatService.clearHistory(folderId, currentSessionId);
            setMessages([
              {
                id: 'msg_cleared',
                role: 'assistant',
                text: 'Conversation cleared. How can I help you find or summarize your screenshot memories?',
                timestamp: new Date().toISOString(),
              },
            ]);
            refreshSessionsList();
          },
        },
      ]
    );
  };

  const handleCitationPress = (citation: ChatMessageCitation) => {
    if (citation.screenshotId) {
      navigation.navigate('ScreenshotDetail', { id: citation.screenshotId });
    }
  };

  // ===========================================================================
  // Render Helpers
  // ===========================================================================

  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');

    return (
      <View>
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <Text key={idx} style={[styles.mdH3, { color: theme.colors.textPrimary }]}>
                {line.replace('### ', '')}
              </Text>
            );
          }
          if (line.startsWith('## ') || line.startsWith('# ')) {
            return (
              <Text key={idx} style={[styles.mdH2, { color: theme.colors.textPrimary }]}>
                {line.replace(/^#+\s*/, '')}
              </Text>
            );
          }
          if (line.startsWith('```')) {
            return (
              <View key={idx} style={[styles.codeBlock, { backgroundColor: '#0B0F19' }]}>
                <Text style={[styles.codeText, { color: '#E2E8F0' }]}>
                  {line.replace(/```/g, '')}
                </Text>
              </View>
            );
          }
          if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
            const bulletContent = line.trim().replace(/^[•\-]\s*/, '');
            return (
              <View key={idx} style={styles.bulletRow}>
                <Text style={[styles.bulletDot, { color: theme.colors.primary }]}>•</Text>
                <Text style={[styles.bulletText, { color: theme.colors.textPrimary }]}>
                  {renderBoldSpans(bulletContent, theme.colors.textPrimary)}
                </Text>
              </View>
            );
          }

          if (!line.trim()) {
            return <View key={idx} style={{ height: 6 }} />;
          }

          return (
            <Text key={idx} style={[styles.normalText, { color: theme.colors.textPrimary }]}>
              {renderBoldSpans(line, theme.colors.textPrimary)}
            </Text>
          );
        })}
      </View>
    );
  };

  const renderBoldSpans = (raw: string, defaultColor: string) => {
    const parts = raw.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={i} style={{ fontWeight: '700', color: defaultColor }}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      return part;
    });
  };

  const renderMessage = ({ item }: { item: ChatUiMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAssistant,
        ]}
      >
        {!isUser && (
          <View style={[styles.avatarBox, { backgroundColor: '#6366F120', borderColor: '#6366F140' }]}>
            <Icon name="sparkles" size={15} color="#818CF8" />
          </View>
        )}

        <View style={{ maxWidth: '84%' }}>
          <View
            style={[
              styles.bubble,
              isUser
                ? [styles.userBubble, { backgroundColor: theme.colors.primary }]
                : [styles.assistantBubble, { backgroundColor: '#161B26', borderColor: '#232A3B' }],
            ]}
          >
            {isUser ? (
              <Text style={styles.userText}>{item.text}</Text>
            ) : (
              renderFormattedMarkdown(item.text)
            )}

            {item.responseTimeMs !== undefined && item.responseTimeMs > 0 && !isUser && (
              <Text style={[styles.timeText, { color: '#94A3B8' }]}>
                {item.responseTimeMs}ms
              </Text>
            )}
          </View>

          {/* Structured Tappable Citations */}
          {item.citations && item.citations.length > 0 && (
            <View style={styles.citationsContainer}>
              <Text style={[styles.citationsHeader, { color: '#94A3B8' }]}>
                Referenced Memories ({item.citations.length})
              </Text>
              {item.citations.map((c, idx) => (
                <TouchableOpacity
                  key={c.screenshotId || idx}
                  activeOpacity={0.7}
                  onPress={() => handleCitationPress(c)}
                  style={[styles.citationCard, { backgroundColor: '#131823', borderColor: '#1F2739' }]}
                >
                  <View style={styles.citationThumbBox}>
                    <ScreenshotImageThumbnail
                      thumbnailUri={c.thumbnailPath}
                      filePath={c.thumbnailPath || ''}
                      style={styles.citationThumb}
                      borderRadius={6}
                    />
                  </View>
                  <View style={styles.citationInfo}>
                    <View style={styles.citationTitleRow}>
                      <Text numberOfLines={1} style={[styles.citationFileName, { color: '#F1F5F9' }]}>
                        {c.fileName}
                      </Text>
                      {c.amount !== undefined && c.amount > 0 && (
                        <View style={styles.amtBadge}>
                          <Text style={styles.amtText}>₹{c.amount.toLocaleString('en-IN')}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.citationMetaRow}>
                      {c.merchant && (
                        <Text numberOfLines={1} style={styles.citationMerchant}>
                          {c.merchant}
                        </Text>
                      )}
                      {c.date && <Text style={styles.citationDate}>• {c.date}</Text>}
                    </View>
                  </View>
                  <Icon name="open-outline" size={16} color="#818CF8" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#0B0F19' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

      {/* Header with Session Switcher */}
      <View style={[styles.header, { borderBottomColor: '#1F2739' }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={22} color="#F1F5F9" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowSessionModal(true)}
          style={styles.headerCenter}
        >
          <View style={styles.rowCenter}>
            <Text numberOfLines={1} style={[styles.headerTitle, { color: '#F1F5F9' }]}>
              {sessionTitle}
            </Text>
            <Icon name="chevron-down" size={14} color="#94A3B8" style={{ marginLeft: 4 }} />
          </View>
          <Text numberOfLines={1} style={[styles.headerSubtitle, { color: '#94A3B8' }]}>
            Offline AI Memory Assistant
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNewChat}
          style={styles.headerBtn}
          accessibilityLabel="New Chat"
        >
          <Icon name="add-circle-outline" size={22} color="#818CF8" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRegenerate}
          style={styles.headerBtn}
          accessibilityLabel="Regenerate"
        >
          <Icon name="refresh-outline" size={20} color="#F1F5F9" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleClearChat}
          style={styles.headerBtn}
          accessibilityLabel="Clear chat"
        >
          <Icon name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Offline Status Banner */}
      {offlineBanner && (
        <View style={styles.banner}>
          <Icon name="shield-checkmark" size={13} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={styles.bannerText}>{offlineBanner}</Text>
        </View>
      )}

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          typing ? (
            <View style={styles.typingBox}>
              <View style={[styles.avatarBox, { backgroundColor: '#6366F120', borderColor: '#6366F140' }]}>
                <Icon name="sparkles" size={15} color="#818CF8" />
              </View>
              <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: '#161B26', borderColor: '#232A3B' }]}>
                <Text style={{ color: '#818CF8', fontStyle: 'italic', fontSize: 13 }}>
                  {thinkingStep}
                </Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Suggested Questions Carousel */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsScroll}
          >
            {suggestions.map((sugg, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => handleSend(sugg)}
                style={styles.suggestionChip}
              >
                <Icon name="sparkles-outline" size={12} color="#818CF8" style={{ marginRight: 4 }} />
                <Text style={styles.suggestionText}>{sugg}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input Row */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputContainer, { backgroundColor: '#111622', borderTopColor: '#1F2739' }]}>
          <TextInput
            style={styles.input}
            placeholder="Ask anything about your screenshots..."
            placeholderTextColor="#64748B"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
            multiline={false}
          />

          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={!inputText.trim() || typing}
            style={[
              styles.sendButton,
              { backgroundColor: inputText.trim() && !typing ? '#6366F1' : '#1E293B' },
            ]}
            accessibilityLabel="Send message"
          >
            <Icon name="send" size={17} color={inputText.trim() && !typing ? '#FFFFFF' : '#64748B'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Session Switcher Modal */}
      <Modal
        visible={showSessionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSessionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#161B26', borderColor: '#232A3B' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Conversation Sessions</Text>
              <TouchableOpacity onPress={() => setShowSessionModal(false)}>
                <Icon name="close" size={22} color="#F1F5F9" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleNewChat}
              style={[styles.newChatModalBtn, { backgroundColor: '#6366F1' }]}
            >
              <Icon name="add" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.newChatBtnText}>Start New Conversation</Text>
            </TouchableOpacity>

            <FlatList
              data={sessionsList}
              keyExtractor={(s) => s.id}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => {
                const isActive = item.id === currentSessionId;
                return (
                  <View style={[styles.sessionItemRow, isActive && styles.sessionItemActive]}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleSelectSession(item)}
                      style={{ flex: 1 }}
                    >
                      <Text numberOfLines={1} style={[styles.sessionItemTitle, isActive && { color: '#818CF8' }]}>
                        {item.title}
                      </Text>
                      {item.last_message_preview ? (
                        <Text numberOfLines={1} style={styles.sessionItemPreview}>
                          {item.last_message_preview}
                        </Text>
                      ) : null}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteSession(item)}
                      style={{ padding: 6 }}
                    >
                      <Icon name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#10B98115',
    borderBottomWidth: 1,
    borderBottomColor: '#10B98140',
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-start',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatarBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    borderBottomRightRadius: 2,
  },
  assistantBubble: {
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  normalText: {
    fontSize: 14,
    lineHeight: 20,
  },
  mdH2: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  mdH3: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
  },
  bulletDot: {
    fontSize: 14,
    marginRight: 6,
    lineHeight: 20,
  },
  bulletText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  codeBlock: {
    borderRadius: 6,
    padding: 8,
    marginVertical: 4,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
  },
  timeText: {
    fontSize: 9,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  citationsContainer: {
    marginTop: 8,
  },
  citationsHeader: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  citationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 3,
  },
  citationThumbBox: {
    width: 38,
    height: 38,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 8,
  },
  citationThumb: {
    width: 38,
    height: 38,
  },
  citationInfo: {
    flex: 1,
  },
  citationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  citationFileName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
  },
  amtBadge: {
    backgroundColor: '#10B98125',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  amtText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  citationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  citationMerchant: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '500',
  },
  citationDate: {
    color: '#64748B',
    fontSize: 10,
    marginLeft: 4,
  },
  typingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  suggestionsContainer: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1F2739',
  },
  suggestionsScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#232A3B',
  },
  suggestionText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    backgroundColor: '#1A2234',
    color: '#F1F5F9',
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '75%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  newChatModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  newChatBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  sessionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 3,
    backgroundColor: '#111622',
  },
  sessionItemActive: {
    borderColor: '#6366F1',
    borderWidth: 1,
  },
  sessionItemTitle: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
  },
  sessionItemPreview: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
});
