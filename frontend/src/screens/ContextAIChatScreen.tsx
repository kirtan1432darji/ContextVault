import React, { useState } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useChatStore } from '../store/chat.store';
import { chatService } from '../services/chatService';
import { ChatMessageModel } from '../models';

type Props = NativeStackScreenProps<RootStackParamList, 'ContextAIChat'>;

export const ContextAIChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId, categoryName, screenshotId } = route.params || {};
  const theme = useAppTheme();

  const messages = useChatStore((s) => s.messages);
  const isSending = useChatStore((s) => s.isSending);
  const [inputText, setInputText] = useState('');

  const contextTitle = categoryName
    ? `${categoryName} AI`
    : screenshotId
    ? 'Screenshot AI'
    : 'Context AI';

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    const userMessage: ChatMessageModel = {
      id: `usr_${Date.now()}`,
      sessionId: 'session_active',
      folderId: categoryId,
      screenshotId,
      role: 'user',
      content: text,
      citations: [],
      createdAt: new Date().toISOString(),
    };

    useChatStore.getState().appendMessage(userMessage);
    setInputText('');
    useChatStore.getState().setSending(true);

    const res = await chatService.sendMessage({
      sessionId: 'session_active',
      content: text,
      folderId: categoryId,
      screenshotId,
    });

    if (res.isSuccess && res.data) {
      useChatStore.getState().appendMessage(res.data);
    }
    useChatStore.getState().setSending(false);
  };

  const suggestions = [
    'Summarize this folder',
    'List all action items',
    'Find key amounts or totals',
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
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
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            {contextTitle}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.success }]}>
            Knowledge Assistant • Ready
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => useChatStore.getState().clearMessages()}
          style={[styles.backBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
        >
          <Icon name="trash-outline" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Message List */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View
              style={[
                styles.messageRow,
                isUser ? styles.userRow : styles.assistantRow,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  isUser
                    ? { backgroundColor: theme.colors.primary }
                    : {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                        borderWidth: 1,
                      },
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    { color: isUser ? '#FFFFFF' : theme.colors.textPrimary },
                  ]}
                >
                  {item.content}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconBox,
                { backgroundColor: `${theme.colors.primary}20` },
              ]}
            >
              <Icon name="chatbubbles-outline" size={40} color={theme.colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
              Ask {contextTitle}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Ask anything about your saved screenshots and smart folder knowledge.
            </Text>
            <View style={styles.suggestionsContainer}>
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleSend(s)}
                  style={[
                    styles.suggestionChip,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.suggestionText, { color: theme.colors.primary }]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
      />

      {/* Input Bar */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        <TextInput
          placeholder="Ask anything about these screenshots..."
          placeholderTextColor={theme.colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          style={[styles.input, { color: theme.colors.textPrimary }]}
        />
        <TouchableOpacity
          onPress={() => handleSend()}
          disabled={!inputText.trim() || isSending}
          style={[
            styles.sendBtn,
            {
              backgroundColor: inputText.trim()
                ? theme.colors.primary
                : theme.colors.border,
            },
          ]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Icon name="send" size={18} color="#FFFFFF" />
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  messagesList: {
    padding: 20,
    paddingBottom: 30,
    flexGrow: 1,
  },
  messageRow: {
    marginBottom: 14,
    flexDirection: 'row',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 18,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 30,
    marginBottom: 24,
  },
  suggestionsContainer: {
    alignItems: 'center',
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});
