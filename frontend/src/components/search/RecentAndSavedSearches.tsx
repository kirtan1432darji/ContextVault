import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
}

export const RecentAndSavedSearches: React.FC<RecentAndSavedSearchesProps> = ({
  recentSearches,
  savedSearches,
  onSelectQuery,
  onDeleteRecent,
  onClearAllRecent,
  onDeleteSaved,
}) => {
  const theme = useAppTheme();

  const DYNAMIC_SUGGESTIONS = [
    { title: 'Payments this month', icon: 'cash-outline', query: 'Show all UPI payments this month' },
    { title: 'Meetings this week', icon: 'calendar-outline', query: 'Meetings from this week' },
    { title: 'Shopping under ₹500', icon: 'cart-outline', query: 'Shopping items under ₹500' },
    { title: 'Invoices from Amazon', icon: 'receipt-outline', query: 'Invoices from Amazon' },
    { title: 'Flutter code bugs', icon: 'code-slash-outline', query: 'Find Flutter screenshots' },
    { title: 'NHDC records', icon: 'document-text-outline', query: 'Screenshots mentioning NHDC' },
  ];

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

  return (
    <View style={styles.container}>
      {/* 1. Dynamic Intelligent Suggestions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
          INTELLIGENT SUGGESTIONS
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
          {DYNAMIC_SUGGESTIONS.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => onSelectQuery(item.query)}
              style={[
                styles.suggestionCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <View style={[styles.suggestionIconBox, { backgroundColor: `${theme.colors.primary}18` }]}>
                <Icon name={item.icon} size={16} color={theme.colors.primary} />
              </View>
              <Text style={[styles.suggestionTitle, { color: theme.colors.textPrimary }]}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={[styles.suggestionQuery, { color: theme.colors.textSecondary }]}>
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
                SAVED & PINNED SEARCHES
              </Text>
            </View>
          </View>

          <View style={styles.savedWrap}>
            {savedSearches.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => onSelectQuery(item.query)}
                style={[
                  styles.savedPill,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: `${theme.colors.primary}30`,
                  },
                ]}
              >
                <Icon name={item.iconName || 'bookmark'} size={13} color={item.colorHex || theme.colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.savedTitle, { color: theme.colors.textPrimary }]}>
                  {item.title}
                </Text>
                <TouchableOpacity
                  onPress={() => onDeleteSaved(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.savedRemoveBtn}
                >
                  <Icon name="close-circle" size={14} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
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
                RECENT SEARCHES
              </Text>
            </View>
            <TouchableOpacity onPress={onClearAllRecent} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.clearAllText, { color: theme.colors.primary }]}>Clear History</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.recentList}>
            {recentSearches.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => onSelectQuery(item.query)}
                style={[
                  styles.recentRow,
                  {
                    backgroundColor: theme.colors.card,
                    borderBottomColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.recentLeft}>
                  <Icon name="search-outline" size={16} color={theme.colors.textSecondary} style={{ marginRight: 10 }} />
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

                <TouchableOpacity
                  onPress={() => onDeleteRecent(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.recentDeleteBtn}
                >
                  <Icon name="close" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '600',
  },
  suggestionsScroll: {
    paddingLeft: 16,
  },
  suggestionCard: {
    width: 160,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 10,
  },
  suggestionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  suggestionQuery: {
    fontSize: 11,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  savedTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  savedRemoveBtn: {
    padding: 2,
  },
  recentList: {
    paddingHorizontal: 16,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
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
  recentDeleteBtn: {
    padding: 4,
  },
});
