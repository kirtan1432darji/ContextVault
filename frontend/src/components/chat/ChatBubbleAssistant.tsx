import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { ChatMessageModel, ChatMessageCitation } from '../../models';
import { CitationCard } from './CitationCard';

interface ChatBubbleAssistantProps {
  message: ChatMessageModel;
  onCitationPress?: (citation: ChatMessageCitation) => void;
}

export const ChatBubbleAssistant: React.FC<ChatBubbleAssistantProps> = ({
  message,
  onCitationPress,
}) => {
  const theme = useAppTheme();

  const formattedTime = new Date(message.createdAt || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleCopy = () => {
    Alert.alert('Copied', 'Message response text copied to clipboard.');
  };

  const citations = message.citations || [];

  return (
    <View style={styles.container}>
      {/* Bot Avatar */}
      <View
        style={[
          styles.avatarCircle,
          {
            backgroundColor: `${theme.colors.primary}20`,
            borderColor: `${theme.colors.primary}40`,
          },
        ]}
      >
        <Icon name="sparkles" size={16} color={theme.colors.primary} />
      </View>

      <View style={styles.bubbleWrapper}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Header Row: Label & Offline Badge */}
          <View style={styles.headerRow}>
            <Text style={[styles.aiLabel, { color: theme.colors.primary }]}>Context AI</Text>
            {message.syncStatus === 'offline' && (
              <View style={[styles.offlineBadge, { backgroundColor: `${theme.colors.warning}20` }]}>
                <Icon name="cloud-offline-outline" size={11} color={theme.colors.warning} style={{ marginRight: 3 }} />
                <Text style={[styles.offlineBadgeText, { color: theme.colors.warning }]}>
                  Offline Cache
                </Text>
              </View>
            )}
          </View>

          {/* Response Text */}
          <Text style={[styles.messageText, { color: theme.colors.textPrimary }]}>
            {message.content}
          </Text>

          {/* Citations Section */}
          {citations.length > 0 && (
            <View style={styles.citationsSection}>
              <View style={styles.citationsHeadingRow}>
                <Icon name="document-attach-outline" size={14} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[styles.citationsHeading, { color: theme.colors.textSecondary }]}>
                  Grounded Citations ({citations.length}):
                </Text>
              </View>

              {citations.map((citation, index) => (
                <CitationCard
                  key={`${citation.screenshotId}_${index}`}
                  citation={citation}
                  onPress={(c) => onCitationPress && onCitationPress(c)}
                />
              ))}
            </View>
          )}

          {/* Footer: Timestamp and Copy Action */}
          <View style={styles.footerRow}>
            <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
              {formattedTime}
            </Text>
            <TouchableOpacity onPress={handleCopy} style={styles.copyBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="copy-outline" size={13} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 6,
    paddingHorizontal: 16,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
    borderWidth: 1,
  },
  bubbleWrapper: {
    flex: 1,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  aiLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  offlineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  citationsSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F030',
  },
  citationsHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  citationsHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  copyBtn: {
    padding: 2,
  },
});
