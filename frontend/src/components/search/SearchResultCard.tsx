import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { ModernCard } from '../ModernCard';
import { ScreenshotImageThumbnail } from '../ScreenshotImageThumbnail';
import { ConfidenceBadge } from '../ConfidenceBadge';
import { GlobalSearchResultItem } from '../../models';

interface SearchResultCardProps {
  item: GlobalSearchResultItem;
  onPress: () => void;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({ item, onPress }) => {
  const theme = useAppTheme();

  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(item.createdAt);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  }, [item.createdAt]);

  const folderPathStr = React.useMemo(() => {
    if (item.folderPath && item.folderPath.length > 0) {
      return `/${item.folderPath.join('/')}`;
    }
    return `/${item.categoryName}${item.subcategory ? '/' + item.subcategory : ''}`;
  }, [item.folderPath, item.categoryName, item.subcategory]);

  return (
    <ModernCard style={styles.card}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.cardTouchable}>
        {/* Left Thumbnail */}
        <View style={[styles.thumbContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <ScreenshotImageThumbnail filePath={item.filePath} style={styles.thumb} />
          {item.isFavorite && (
            <View style={styles.favBadge}>
              <Icon name="heart" size={12} color="#EF4444" />
            </View>
          )}
        </View>

        {/* Right Details */}
        <View style={styles.detailsContainer}>
          {/* Top Row: Folder Path + Date */}
          <View style={styles.topRow}>
            <View style={[styles.folderBadge, { backgroundColor: `${theme.colors.primary}15` }]}>
              <Icon name="folder-outline" size={11} color={theme.colors.primary} style={{ marginRight: 3 }} />
              <Text numberOfLines={1} style={[styles.folderText, { color: theme.colors.primary }]}>
                {folderPathStr}
              </Text>
            </View>
            <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
              {formattedDate}
            </Text>
          </View>

          {/* Title */}
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.textPrimary }]}>
            {item.fileName}
          </Text>

          {/* Match Reason Tag */}
          <View style={[styles.matchReasonBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Icon name="sparkles-outline" size={10} color={theme.colors.accent} style={{ marginRight: 4 }} />
            <Text numberOfLines={1} style={[styles.matchReasonText, { color: theme.colors.textSecondary }]}>
              {item.matchReason}
            </Text>
          </View>

          {/* Highlighted Snippet */}
          <View style={styles.snippetBox}>
            <Text numberOfLines={2} style={styles.snippetText}>
              {item.highlightedSnippet && item.highlightedSnippet.length > 0 ? (
                item.highlightedSnippet.map((token, i) => (
                  <Text
                    key={i}
                    style={{
                      color: token.isMatch ? theme.colors.primary : theme.colors.textPrimary,
                      fontWeight: token.isMatch ? '800' : '400',
                      backgroundColor: token.isMatch ? `${theme.colors.primary}20` : 'transparent',
                    }}
                  >
                    {token.text}
                  </Text>
                ))
              ) : (
                <Text style={{ color: theme.colors.textSecondary }}>{item.matchedSnippet}</Text>
              )}
            </Text>
          </View>

          {/* Bottom Row: Entities + Confidence */}
          <View style={styles.bottomRow}>
            <View style={styles.entitiesList}>
              {item.detectedEntities &&
                item.detectedEntities.map((ent, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.miniEntityPill,
                      {
                        backgroundColor:
                          ent.type === 'amount'
                            ? `${theme.colors.success}18`
                            : theme.colors.surfaceVariant,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.miniEntityText,
                        {
                          color:
                            ent.type === 'amount'
                              ? theme.colors.success
                              : theme.colors.textPrimary,
                        },
                      ]}
                    >
                      {ent.value}
                    </Text>
                  </View>
                ))}
            </View>

            <ConfidenceBadge confidence={item.confidence} showPercent={false} />
          </View>
        </View>
      </TouchableOpacity>
    </ModernCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 0,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardTouchable: {
    flexDirection: 'row',
    padding: 12,
  },
  thumbContainer: {
    width: 80,
    height: 110,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  favBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 3,
    borderRadius: 8,
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  folderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: '70%',
  },
  folderText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 10,
    fontWeight: '500',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  matchReasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
    maxWidth: '100%',
  },
  matchReasonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  snippetBox: {
    marginBottom: 6,
  },
  snippetText: {
    fontSize: 12,
    lineHeight: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entitiesList: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  miniEntityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniEntityText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
