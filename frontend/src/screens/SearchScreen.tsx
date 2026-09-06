import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useScreenshotStore } from '../store/screenshot.store';
import { useSettingsStore } from '../store/settings.store';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { EmptyStateView } from '../components/EmptyStateView';
import { ScreenshotModel } from '../models';

export const SearchScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const allScreenshots = useScreenshotStore((s) => s.screenshots);
  const recentSearches = useSettingsStore((s) => s.recentSearches);
  const [query, setQuery] = useState('');

  const trimmed = query.trim().toLowerCase();

  const results = trimmed
    ? allScreenshots.filter((s) => {
        const ocrMatch = s.ocrText?.toLowerCase().includes(trimmed);
        const nameMatch = s.fileName.toLowerCase().includes(trimmed);
        const catMatch = s.categoryName.toLowerCase().includes(trimmed);
        const tagMatch = s.tags.some((t) => t.name.toLowerCase().includes(trimmed));
        return ocrMatch || nameMatch || catMatch || tagMatch;
      })
    : [];

  const handleSearchSubmit = () => {
    if (trimmed) {
      useSettingsStore.getState().addRecentSearch(trimmed);
    }
  };

  const renderResultItem = ({ item }: { item: ScreenshotModel }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('ScreenshotDetail', { id: item.id })}
      style={[
        styles.resultItem,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <ScreenshotImageThumbnail filePath={item.filePath} style={styles.resultThumb} />
      <View style={styles.resultContent}>
        <Text numberOfLines={1} style={[styles.resultTitle, { color: theme.colors.textPrimary }]}>
          {item.fileName}
        </Text>
        <Text numberOfLines={2} style={[styles.resultSnippet, { color: theme.colors.textSecondary }]}>
          {item.ocrText || 'No text extracted'}
        </Text>
        <View style={styles.resultMeta}>
          <Text style={[styles.resultCategory, { color: theme.colors.primary }]}>
            {item.categoryName}
          </Text>
          <ConfidenceBadge confidence={item.confidence} showPercent={false} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search Input Bar */}
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: theme.colors.textPrimary }]}>
          Search
        </Text>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Icon name="search-outline" size={20} color={theme.colors.textMuted} />
          <TextInput
            placeholder="Search text, receipts, tags, apps..."
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Icon name="close-circle" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Recent Searches */}
      {!trimmed && recentSearches.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={[styles.recentTitle, { color: theme.colors.textSecondary }]}>
              Recent Searches
            </Text>
            <TouchableOpacity onPress={() => useSettingsStore.getState().clearRecentSearches()}>
              <Text style={[styles.clearText, { color: theme.colors.primary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chipsWrap}>
            {recentSearches.map((s, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setQuery(s)}
                style={[
                  styles.recentChip,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Icon name="time-outline" size={14} color={theme.colors.textMuted} />
                <Text style={[styles.chipLabel, { color: theme.colors.textPrimary }]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Results List */}
      {trimmed ? (
        results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderResultItem}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <EmptyStateView
            iconName="search-outline"
            title="No Results Found"
            description={`No screenshots matched "${query}". Try searching for words or apps.`}
          />
        )
      ) : (
        <EmptyStateView
          iconName="scan-outline"
          title="Instant Optical Search"
          description="Type keywords, numbers, merchant names, or apps to search across OCR text."
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  recentSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
  },
  resultItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  resultThumb: {
    width: 68,
    height: 90,
    borderRadius: 10,
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultSnippet: {
    fontSize: 12,
    lineHeight: 16,
  },
  resultMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  resultCategory: {
    fontSize: 11,
    fontWeight: '600',
  },
});
