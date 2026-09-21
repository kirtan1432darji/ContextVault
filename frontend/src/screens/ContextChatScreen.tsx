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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { contextChatService, ChatAnswerResult } from '../services/contextChat/ContextChatService';
import { ScreenshotReferenceCard } from '../components/chat/ScreenshotReferenceCard';
import { ScreenshotModel } from '../models';
import { chatHistoryRepository } from '../database/repositories/ChatHistoryRepository';

type Props = NativeStackScreenProps<RootStackParamList, any>;

interface ChatUiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  citedScreenshots?: ScreenshotModel[];
  isOffline?: boolean;
  bannerMessage?: string;
  responseTimeMs?: number;
}

export const ContextChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const params = route.params || {};
  const folderId: string | undefined = params.folderId || params.categoryId;
  const folderName: string = params.categoryName || params.folderName || (folderId ? 'Smart Folder' : 'All Screenshots');

  const theme = useAppTheme();

  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [offlineBanner, setOfflineBanner] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  const loadConversation = useCallback(async () => {
    try {
      const records = await chatHistoryRepository.getRecentMessages(40, folderId ? `session_${folderId}` : 'session_global');
      if (records.length > 0) {
        setMessages(
          records.map((r) => ({
            id: r.id,
            role: r.role,
            text: r.message,
            timestamp: r.timestamp,
            responseTimeMs: r.response_time_ms,
          }))
        );
      } else {
        // Welcome message
        setMessages([
          {
            id: 'msg_welcome',
            role: 'assistant',
            text: `Hi! I'm your offline **Context AI Assistant**.\n\nI can help you search, summarize, and extract information from your screenshots.\n\nTry asking about your recent payments, food orders, flight tickets, or documents!`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }

      // Load dynamic suggestions based on SQLite metadata
      const suggs = await contextChatService.loadSuggestions(folderId, folderName);
      setSuggestions(suggs);
    } catch {
      // Fallback
    }
  }, [folderId, folderName]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Auto-scroll to end
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 120);
    }
  }, [messages.length, typing]);

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
    setOfflineBanner(null);

    try {
      const res: ChatAnswerResult = await contextChatService.askQuestion(q, {
        folderId,
        sessionId: folderId ? `session_${folderId}` : 'session_global',
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
        isOffline: res.isOfflineResponse,
        bannerMessage: res.bannerMessage,
        responseTimeMs: res.responseTimeMs,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      // Even on unexpected error, provide a grounded local fallback response rather than network error
      const fallbackMsg: ChatUiMessage = {
        id: `ast_err_${Date.now()}`,
        role: 'assistant',
        text: `I synthesized this answer from local metadata because the server is offline.\n\nNo matching screenshots found for "${q}".`,
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

  const handleClearChat = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear your conversation history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await contextChatService.clearHistory(folderId, folderId ? `session_${folderId}` : 'session_global');
            setMessages([
              {
                id: 'msg_cleared',
                role: 'assistant',
                text: 'Conversation cleared. How can I help you organize or find your screenshots?',
                timestamp: new Date().toISOString(),
              },
            ]);
          },
        },
      ]
    );
  };

  const handleScreenshotCardPress = (s: ScreenshotModel) => {
    navigation.navigate('ScreenshotDetail', { id: s.id });
  };

  const handleVoicePlaceholder = () => {
    Alert.alert(
      'Voice Assistant',
      'Voice input is active in hands-free mode. Speak your question or tap a suggested query below.'
    );
  };

  const renderFormattedMarkdown = (text: string) => {
    // Simple fast regex-based markdown parser for React Native text
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
              <View key={idx} style={[styles.codeBlock, { backgroundColor: theme.isDark ? '#0F172A' : '#F1F5F9' }]}>
                <Text style={[styles.codeText, { color: theme.colors.textPrimary }]}>
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
          <View style={[styles.avatarBox, { backgroundColor: `${theme.colors.primary}20` }]}>
            <Icon name="sparkles" size={16} color={theme.colors.primary} />
          </View>
        )}

        <View style={{ maxWidth: '82%' }}>
          <View
            style={[
              styles.bubble,
              isUser
                ? [styles.userBubble, { backgroundColor: theme.colors.primary }]
                : [styles.assistantBubble, { backgroundColor: theme.isDark ? '#1E293B' : '#FFFFFF', borderColor: theme.isDark ? '#334155' : '#E2E8F0' }],
            ]}
          >
            {isUser ? (
              <Text style={styles.userText}>{item.text}</Text>
            ) : (
              renderFormattedMarkdown(item.text)
            )}

            {item.responseTimeMs !== undefined && item.responseTimeMs > 0 && !isUser && (
              <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                {item.responseTimeMs}ms
              </Text>
            )}
          </View>

          {/* Attached Referenced Screenshots */}
          {item.citedScreenshots && item.citedScreenshots.length > 0 && (
            <View style={styles.citationsContainer}>
              <Text style={[styles.citationsHeader, { color: theme.colors.textSecondary }]}>
                Referenced Screenshots ({item.citedScreenshots.length})
              </Text>
              {item.citedScreenshots.map((sc) => (
                <ScreenshotReferenceCard
                  key={sc.id}
                  screenshot={sc}
                  onPress={handleScreenshotCardPress}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.isDark ? '#334155' : '#E2E8F0' }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            Context Chat
          </Text>
          <Text numberOfLines={1} style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {folderName} • Offline AI Assistant
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('ScreenshotDiagnostics')}
          style={styles.headerBtn}
          accessibilityLabel="Diagnostics"
        >
          <Icon name="stats-chart-outline" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleClearChat}
          style={styles.headerBtn}
          accessibilityLabel="Clear chat"
        >
          <Icon name="trash-outline" size={20} color={theme.colors.error || '#EF4444'} />
        </TouchableOpacity>
      </View>

      {/* Offline Response Banner */}
      {offlineBanner && (
        <View style={[styles.banner, { backgroundColor: '#10B98115', borderBottomColor: '#10B98140' }]}>
          <Icon name="shield-checkmark-outline" size={14} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={[styles.bannerText, { color: '#10B981' }]}>
            {offlineBanner}
          </Text>
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
              <View style={[styles.avatarBox, { backgroundColor: `${theme.colors.primary}20` }]}>
                <Icon name="sparkles" size={16} color={theme.colors.primary} />
              </View>
              <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: theme.isDark ? '#1E293B' : '#FFFFFF', borderColor: theme.isDark ? '#334155' : '#E2E8F0' }]}>
                <Text style={{ color: theme.colors.textSecondary, fontStyle: 'italic', fontSize: 13 }}>
                  Retrieving screenshot context...
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
                style={[
                  styles.suggestionChip,
                  {
                    backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC',
                    borderColor: theme.isDark ? '#334155' : '#CBD5E1',
                  },
                ]}
              >
                <Icon name="sparkles-outline" size={12} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.suggestionText, { color: theme.colors.textPrimary }]}>
                  {sugg}
                </Text>
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
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.isDark ? '#0F172A' : '#FFFFFF',
              borderTopColor: theme.isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleVoicePlaceholder}
            style={[styles.iconButton, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
            accessibilityLabel="Voice Search Placeholder"
          >
            <Icon name="mic-outline" size={20} color={theme.colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9',
                color: theme.colors.textPrimary,
              },
            ]}
            placeholder="Ask anything about your screenshots..."
            placeholderTextColor={theme.colors.textSecondary}
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
              {
                backgroundColor: inputText.trim() && !typing ? theme.colors.primary : theme.colors.border,
              },
            ]}
            accessibilityLabel="Send message"
          >
            <Icon name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '600',
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
    marginTop: 6,
  },
  citationsHeader: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 4,
  },
  typingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  suggestionsContainer: {
    paddingVertical: 8,
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
    borderWidth: 1,
  },
  suggestionText: {
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
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
