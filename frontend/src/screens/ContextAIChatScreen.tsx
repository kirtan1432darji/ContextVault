import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useChatStore } from '../store/chat.store';
import {
  ChatBubbleUser,
  ChatBubbleAssistant,
  TypingIndicator,
  SuggestionChip,
  DateSeparator,
} from '../components/chat';
import { ChatMessageModel, ChatMessageCitation } from '../models';
import { useAuthStore } from '../store/auth.store';
import { FeatureLockCard } from '../components/FeatureLockCard';
import { SafeAreaView, StatusBar } from 'react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'ContextAIChat'>;

export const ContextAIChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId = 'root', categoryName = 'Smart Folder', screenshotId } =
    route.params || {};
  const theme = useAppTheme();

  const messages = useChatStore((s) => s.messages);
  const suggestions = useChatStore((s) => s.suggestions);
  const loading = useChatStore((s) => s.loading);
  const typing = useChatStore((s) => s.typing);
  const isOffline = useChatStore((s) => s.isOffline);
  const error = useChatStore((s) => s.error);

  const initConversation = useChatStore((s) => s.initConversation);
  const loadConversation = useChatStore((s) => s.loadConversation);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearConversation = useChatStore((s) => s.clearConversation);

  const [inputText, setInputText] = useState('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const isGuest = useAuthStore((s) => s.isGuest);

  // Initialize conversation on mount or folder change (only if not guest)
  useEffect(() => {
    if (!isGuest) {
      initConversation(categoryId, categoryName, screenshotId);
    }
  }, [categoryId, categoryName, screenshotId, isGuest]);

  // Auto-scroll to bottom when messages or typing state changes
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, typing]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || typing) return;

    setInputText('');
    await sendMessage(text);
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear chat history for this folder? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearConversation();
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

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    setShowScrollToBottom(distanceFromBottom > 160);
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollToBottom(false);
  };

  // Group messages by day for DateSeparator rendering
  const itemsWithSeparators = useMemo(() => {
    const items: Array<{ type: 'date'; date: string } | { type: 'message'; data: ChatMessageModel }> = [];
    let lastDate = '';

    messages.forEach((msg) => {
      const msgDate = new Date(msg.createdAt || Date.now()).toDateString();
      if (msgDate !== lastDate) {
        items.push({ type: 'date', date: msg.createdAt || new Date().toISOString() });
        lastDate = msgDate;
      }
      items.push({ type: 'message', data: msg });
    });

    return items;
  }, [messages]);

  if (isGuest) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.colors.card,
              borderBottomColor: theme.colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
          >
            <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
              {categoryName} AI
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              Context AI Chat
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
          <FeatureLockCard
            title="Context AI Chat Locked"
            featureName="Context AI Chat"
            description="Sign in to ContextVault to chat with screenshots inside this folder, ask natural language questions, and extract entities."
            onSignIn={() => navigation.navigate('Login')}
            onCreateAccount={() => navigation.navigate('Register')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* 1. Header Bar */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
        >
          <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            {categoryName} AI
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOffline ? theme.colors.warning : theme.colors.success },
              ]}
            />
            <Text
              style={[
                styles.headerSubtitle,
                { color: isOffline ? theme.colors.warning : theme.colors.success },
              ]}
            >
              {isOffline ? 'Offline AI Cache' : 'Grounded on Screenshots'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('FolderContext', { categoryId, categoryName })}
            style={[styles.headerActionBtn, { backgroundColor: `${theme.colors.primary}18` }]}
          >
            <Icon name="sparkles" size={16} color={theme.colors.primary} />
          </TouchableOpacity>

          {messages.length > 0 && (
            <TouchableOpacity
              onPress={handleClearChat}
              style={[styles.headerActionBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9', marginLeft: 6 }]}
            >
              <Icon name="trash-outline" size={16} color={theme.colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Offline Mode Banner */}
      {isOffline && (
        <View style={[styles.offlineBanner, { backgroundColor: `${theme.colors.warning}18`, borderColor: `${theme.colors.warning}40` }]}>
          <Icon name="cloud-offline-outline" size={15} color={theme.colors.warning} style={{ marginRight: 6 }} />
          <Text style={[styles.offlineBannerText, { color: theme.colors.warning }]}>
            Offline Mode: Answering with local Folder Context & OCR cache.
          </Text>
        </View>
      )}

      {/* 3. Suggestion Chips Bar (When conversation has messages) */}
      {messages.length > 0 && suggestions.length > 0 && (
        <View style={[styles.chipsContainer, { borderBottomColor: theme.colors.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {suggestions.map((suggestion, idx) => (
              <SuggestionChip
                key={`${suggestion}_${idx}`}
                label={suggestion}
                onPress={handleSend}
                disabled={typing}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* 4. Conversation Stream */}
      {loading && messages.length === 0 ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading Context AI history...
          </Text>
        </View>
      ) : messages.length === 0 ? (
        /* Empty State / Welcome Screen */
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <View
            style={[
              styles.welcomeIconCircle,
              {
                backgroundColor: `${theme.colors.primary}18`,
                borderColor: `${theme.colors.primary}30`,
              },
            ]}
          >
            <Icon name="chatbubbles-outline" size={42} color={theme.colors.primary} />
          </View>

          <Text style={[styles.welcomeTitle, { color: theme.colors.textPrimary }]}>
            Chat with {categoryName}
          </Text>

          <Text style={[styles.welcomeSubtitle, { color: theme.colors.textSecondary }]}>
            Ask questions, summarize key receipts, find totals, or discover pending tasks grounded on screenshots in this folder.
          </Text>

          <View style={[styles.commandTipCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Icon name="terminal-outline" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.commandTipText, { color: theme.colors.textSecondary }]}>
              Tip: Type <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>/search invoice</Text> to search local screenshots instantly.
            </Text>
          </View>

          <Text style={[styles.suggestionsHeader, { color: theme.colors.textPrimary }]}>
            Suggested Questions:
          </Text>

          <View style={styles.welcomeChipsGrid}>
            {suggestions.map((suggestion, idx) => (
              <SuggestionChip
                key={`welcome_${suggestion}_${idx}`}
                label={suggestion}
                onPress={handleSend}
                disabled={typing}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        /* Message Stream */
        <FlatList
          ref={flatListRef}
          data={itemsWithSeparators}
          keyExtractor={(item, index) =>
            item.type === 'date' ? `date_${item.date}_${index}` : item.data.id
          }
          renderItem={({ item }) => {
            if (item.type === 'date') {
              return <DateSeparator dateString={item.date} />;
            }
            return item.data.role === 'user' ? (
              <ChatBubbleUser message={item.data} />
            ) : (
              <ChatBubbleAssistant
                message={item.data}
                onCitationPress={handleCitationPress}
              />
            );
          }}
          contentContainerStyle={styles.chatStreamContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshing={loading}
          onRefresh={() => loadConversation(categoryId)}
          ListFooterComponent={typing ? <TypingIndicator /> : null}
        />
      )}

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollToBottom && (
        <TouchableOpacity
          onPress={scrollToBottom}
          style={[styles.scrollToBottomBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <Icon name="arrow-down" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      )}

      {/* 5. Message Composer */}
      <View
        style={[
          styles.composerContainer,
          {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.inputBox,
            {
              backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC',
              borderColor: theme.colors.border,
            },
          ]}
        >
          <TextInput
            placeholder={`Ask about ${categoryName}... (/search)`}
            placeholderTextColor={theme.colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            style={[styles.textInput, { color: theme.colors.textPrimary }]}
          />

          {inputText.length > 0 && (
            <TouchableOpacity onPress={() => setInputText('')} style={styles.clearBtn}>
              <Icon name="close-circle" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!inputText.trim() || typing}
          onPress={() => handleSend()}
          style={[
            styles.sendBtn,
            {
              backgroundColor: inputText.trim() && !typing
                ? theme.colors.primary
                : theme.isDark ? '#334155' : '#CBD5E1',
            },
          ]}
        >
          {typing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Icon name="arrow-up" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    elevation: 2,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  offlineBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipsContainer: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chipsScroll: {
    paddingHorizontal: 16,
  },
  chatStreamContent: {
    paddingVertical: 10,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 36,
  },
  welcomeIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    maxWidth: 300,
  },
  commandTipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
    maxWidth: 320,
  },
  commandTipText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  suggestionsHeader: {
    fontSize: 13,
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  welcomeChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    width: '100%',
  },
  scrollToBottomBtn: {
    position: 'absolute',
    right: 16,
    bottom: 80,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    minHeight: 42,
    maxHeight: 100,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
