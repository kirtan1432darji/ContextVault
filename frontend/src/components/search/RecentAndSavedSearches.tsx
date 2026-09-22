import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { RecentSearchItem, SavedSearchItem } from '../../models';

interface RecentAndSavedSearchesProps {
  recentSearches: RecentSearchItem[];
  savedSearches: SavedSearchItem[];
  onSelectQuery: (query: string) => void;
  onDeleteRecent: (id: string) => void;
  onClearAllRecent: () => void;
  onDeleteSaved: (id: string) => void;
  onOpenSaveModal?: (query: string, existing?: SavedSearchItem) => void;
}

export const SEARCH_PRESETS = [
  { title: 'UPI Payments', icon: 'card-outline', query: 'Show all UPI payments this month', color: '#6366F1', tag: 'Finance' },
  { title: 'Amazon & Flipkart', icon: 'cart-outline', query: 'Invoices from Amazon or Flipkart', color: '#F59E0B', tag: 'Shopping' },
  { title: 'Tax & Receipts', icon: 'receipt-outline', query: 'Tax invoices and expense receipts', color: '#10B981', tag: 'Expenses' },
  { title: 'Code Bugs & Logs', icon: 'code-slash-outline', query: 'Flutter bug logs and error screenshots', color: '#3B82F6', tag: 'Dev' },
  { title: 'Flight & Hotel', icon: 'airplane-outline', query: 'Flight tickets and hotel bookings', color: '#EC4899', tag: 'Travel' },
  { title: 'IDs & Documents', icon: 'document-text-outline', query: 'Aadhaar, PAN cards and official docs', color: '#8B5CF6', tag: 'Official' },
];

export const RecentAndSavedSearches: React.FC<RecentAndSavedSearchesProps> = ({
  recentSearches,
  savedSearches,
  onSelectQuery,
  onDeleteRecent,
  onClearAllRecent,
  onDeleteSaved,
  onOpenSaveModal,
}) => {
  const theme = useAppTheme();

  const handleClearAllPrompt = () => {
    Alert.alert(
      'Clear Search History',
      'Are you sure you want to clear your entire search history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: onClearAllRecent,
        },
      ]
    );
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 5) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const isQueryPinned = (q: string) => {
    return savedSearches.some((s) => s.query.toLowerCase() === q.trim().toLowerCase());
  };

  return (
    <View style={styles.container}>
      {/* 1. Curated Search Presets */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.rowCenter}>
            <Icon name="sparkles" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginBottom: 0 }]}>
              SMART SEARCH PRESETS
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsScroll}>
          {SEARCH_PRESETS.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => onSelectQuery(item.query)}
              style={[
                styles.presetCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.presetTopRow}>
                <View style={[styles.presetIconBox, { backgroundColor: `${item.color}20` }]}>
                  <Icon name={item.icon} size={16} color={item.color} />
                </View>
                {onOpenSaveModal && (
                  <TouchableOpacity
                    onPress={() => onOpenSaveModal(item.query)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.presetPinBtn}
                    accessibilityLabel={`Pin ${item.title}`}
                  >
                    <Icon
                      name={isQueryPinned(item.query) ? 'bookmark' : 'bookmark-outline'}
                      size={14}
                      color={isQueryPinned(item.query) ? item.color : theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.presetTitle, { color: theme.colors.textPrimary }]}>
                {item.title}
              </Text>
              <Text numberOfLines={2} style={[styles.presetQuery, { color: theme.colors.textSecondary }]}>
                {item.query}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 2. Pinned / Saved Searches */}
      {savedSearches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.rowCenter}>
              <Icon name="bookmark" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginBottom: 0 }]}>
                SAVED & PINNED SEARCHES ({savedSearches.length})
              </Text>
            </View>
          </View>

          <View style={styles.savedWrap}>
            {savedSearches.map((item) => {
              const accentColor = item.colorHex || theme.colors.primary;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => onSelectQuery(item.query)}
                  onLongPress={() => onOpenSaveModal?.(item.query, item)}
                  style={[
                    styles.savedPill,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: `${accentColor}40`,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.savedIconBox, { backgroundColor: `${accentColor}18` }]}>
                    <Icon name={item.iconName || 'bookmark'} size={13} color={accentColor} />
                  </View>

                  <Text style={[styles.savedTitle, { color: theme.colors.textPrimary }]}>
                    {item.title}
                  </Text>

                  {/* Edit Pencil (when modal handler present) */}
                  {onOpenSaveModal && (
                    <TouchableOpacity
                      onPress={() => onOpenSaveModal(item.query, item)}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      style={styles.savedActionBtn}
                      accessibilityLabel="Edit saved search"
                    >
                      <Icon name="pencil" size={12} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  )}

                  {/* Remove Button */}
                  <TouchableOpacity
                    onPress={() => onDeleteSaved(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                    style={styles.savedActionBtn}
                    accessibilityLabel="Delete saved search"
                  >
                    <Icon name="close-circle" size={14} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* 3. Recent Searches */}
      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.rowCenter}>
              <Icon name="time-outline" size={14} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginBottom: 0 }]}>
                RECENT SEARCHES ({recentSearches.length})
              </Text>
            </View>
            <TouchableOpacity onPress={handleClearAllPrompt} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.clearAllText, { color: theme.colors.primary }]}>Clear History</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.recentList}>
            {recentSearches.map((item) => {
              const pinned = isQueryPinned(item.query);
              const matchingSaved = savedSearches.find((s) => s.query.toLowerCase() === item.query.toLowerCase());

              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => onSelectQuery(item.query)}
                  style={[
                    styles.recentRow,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.recentLeft}>
                    <View style={[styles.recentIconBox, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}>
                      <Icon name="search-outline" size={14} color={theme.colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[styles.recentQueryText, { color: theme.colors.textPrimary }]}>
                        {item.query}
                      </Text>
                      <View style={styles.recentMetaRow}>
                        <Text style={[styles.recentTimeText, { color: theme.colors.textSecondary }]}>
                          {formatTimestamp(item.timestamp)}
                        </Text>
                        {item.resultCount > 0 && (
                          <>
                            <Text style={[styles.recentDot, { color: theme.colors.textSecondary }]}>•</Text>
                            <Text style={[styles.recentCountText, { color: theme.colors.textSecondary }]}>
                              {item.resultCount} result{item.resultCount !== 1 ? 's' : ''}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Actions: Pin / Bookmark and Delete */}
                  <View style={styles.recentActionsRow}>
                    {onOpenSaveModal && (
                      <TouchableOpacity
                        onPress={() => onOpenSaveModal(item.query, matchingSaved)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.recentActionBtn}
                        accessibilityLabel={pinned ? 'Edit pinned search' : 'Pin to saved searches'}
                      >
                        <Icon
                          name={pinned ? 'bookmark' : 'bookmark-outline'}
                          size={16}
                          color={pinned ? (matchingSaved?.colorHex || theme.colors.primary) : theme.colors.textSecondary}
                        />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => onDeleteRecent(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.recentActionBtn}
                      accessibilityLabel="Remove from history"
                    >
                      <Icon name="close" size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '600',
  },
  presetsScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  presetCard: {
    width: 170,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  presetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  presetIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetPinBtn: {
    padding: 4,
  },
  presetTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  presetQuery: {
    fontSize: 11,
    lineHeight: 15,
  },
  savedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  savedIconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  savedTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
  },
  savedActionBtn: {
    padding: 3,
    marginLeft: 2,
  },
  recentList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  recentIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  recentQueryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  recentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  recentTimeText: {
    fontSize: 11,
  },
  recentDot: {
    marginHorizontal: 4,
    fontSize: 11,
  },
  recentCountText: {
    fontSize: 11,
  },
  recentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentActionBtn: {
    padding: 6,
  },
});
