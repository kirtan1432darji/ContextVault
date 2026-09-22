import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { ChatMessageCitation } from '../../models';
import { ScreenshotImageThumbnail } from '../ScreenshotImageThumbnail';
import { ConfidenceBadge } from '../ConfidenceBadge';

interface CitationCardProps {
  citation: ChatMessageCitation;
  onPress: (citation: ChatMessageCitation) => void;
}

export const CitationCard: React.FC<CitationCardProps> = ({ citation, onPress }) => {
  const theme = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(citation)}
      style={[
        styles.card,
        {
          backgroundColor: theme.isDark ? '#1E293B90' : '#FFFFFF',
          borderColor: theme.isDark ? '#334155' : '#E2E8F0',
        },
      ]}
    >
      <View style={styles.thumbnailBox}>
        <ScreenshotImageThumbnail
          thumbnailUri={citation.thumbnailPath}
          filePath={citation.thumbnailPath || ''}
          style={styles.thumb}
          borderRadius={8}
        />
      </View>

      <View style={styles.infoCol}>
        <View style={styles.titleRow}>
          <Text
            numberOfLines={1}
            style={[styles.fileName, { color: theme.colors.textPrimary }]}
          >
            {citation.fileName}
          </Text>
          {citation.confidence !== undefined && citation.confidence > 0 && (
            <ConfidenceBadge confidence={citation.confidence} showPercent={false} />
          )}
        </View>

        {citation.folderPath ? (
          <View style={styles.folderPathRow}>
            <Icon name="folder-outline" size={11} color={theme.colors.textSecondary} style={{ marginRight: 3 }} />
            <Text numberOfLines={1} style={[styles.folderPathText, { color: theme.colors.textSecondary }]}>
              {citation.folderPath}
            </Text>
          </View>
        ) : null}

        {citation.snippet ? (
          <Text numberOfLines={2} style={[styles.snippetText, { color: theme.colors.textSecondary }]}>
            "{citation.snippet}"
          </Text>
        ) : null}
      </View>

      <Icon name="chevron-forward" size={16} color={theme.colors.textSecondary} style={styles.chevron} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  thumbnailBox: {
    width: 44,
    height: 44,
    marginRight: 10,
  },
  thumb: {
    width: 44,
    height: 44,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  folderPathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    marginBottom: 2,
  },
  folderPathText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  snippetText: {
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  chevron: {
    marginLeft: 6,
  },
});
