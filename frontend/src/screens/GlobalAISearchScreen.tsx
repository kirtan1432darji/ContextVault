import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useSearchStore } from '../store/search.store';
import {
  AIAnswerCard,
  SearchResultCard,
  SearchFilterBar,
  VoiceSearchModal,
  RecentAndSavedSearches,
} from '../components/search';
import { EmptyStateView } from '../components/EmptyStateView';
import { FeatureLockCard } from '../components/FeatureLockCard';
import { useAuthStore } from '../store/auth.store';
import { GlobalSearchResultItem } from '../models';

type RouteProps = RouteProp<RootStackParamList, 'GlobalAISearch'>;

export const GlobalAISearchScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProps>();

  const inputRef = useRef<TextInput>(null);

  const query = useSearchStore((s) => s.query);
  const activeFilters = useSearchStore((s) => s.activeFilters);
  const loading = useSearchStore((s) => s.loading);
  const isOffline = useSearchStore((s) => s.isOffline);
  const results = useSearchStore((s) => s.results);
  const groupedResults = useSearchStore((s) => s.groupedResults);
  const aiAnswer = useSearchStore((s) => s.aiAnswer);
  const recentSearches = useSearchStore((s) => s.recentSearches);
  const savedSearches = useSearchStore((s) => s.savedSearches);
  const isVoiceModalOpen = useSearchStore((s) => s.isVoiceModalOpen);
  const lastVoiceQuery = useSearchStore((s) => s.lastVoiceQuery);
  const isGuest = useAuthStore((s) => s.isGuest);

  const setQuery = useSearchStore((s) => s.setQuery);
  const setFilter = useSearchStore((s) => s.setFilter);
  const resetFilters = useSearchStore((s) => s.resetFilters);
  const executeSearch = useSearchStore((s) => s.executeSearch);
  const executeVoiceSearch = useSearchStore((s) => s.executeVoiceSearch);
  const loadRecentAndSavedSearches = useSearchStore((s) => s.loadRecentAndSavedSearches);
  const deleteRecentSearch = useSearchStore((s) => s.deleteRecentSearch);
  const clearAllRecentSearches = useSearchStore((s) => s.clearAllRecentSearches);
  const toggleSaveSearch = useSearchStore((s) => s.toggleSaveSearch);
  const setVoiceModalOpen = useSearchStore((s) => s.setVoiceModalOpen);

  const [viewMode, setViewMode] = useState<'relevance' | 'grouped'>('relevance');

  // Check if current query is saved
  const isCurrentQuerySaved = React.useMemo(() => {
    if (!query.trim()) return false;
    return savedSearches.some((s) => s.query.toLowerCase() === query.trim().toLowerCase());
  }, [query, savedSearches]);

  useEffect(() => {
    loadRecentAndSavedSearches();

    // Check if passed initialQuery
    if (route.params?.initialQuery) {
      setQuery(route.params.initialQuery);
      executeSearch(route.params.initialQuery);
    } else if (route.params?.autoFocus) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [route.params]);

  const handleSelectSuggestion = (selected: string) => {
    setQuery(selected);
    executeSearch(selected);
  };

  const handleClearQuery = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const handleTogglePin = () => {
    if (!query.trim()) return;
    toggleSaveSearch(query.trim());
  };

  const renderGroupedResults = () => {
    const categories = Object.keys(groupedResults);
    if (categories.length === 0) return null;

    return (
      <View style={styles.groupedContainer}>
        {categories.map((catName) => {
          const items = groupedResults[catName] || [];
          return (
            <View key={catName} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <View style={styles.rowCenter}>
                  <Icon name="folder" size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.groupTitle, { color: theme.colors.textPrimary }]}>
                    {catName}
                  </Text>
                </View>
                <View style={[styles.groupBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
                  <Text style={[styles.groupBadgeText, { color: theme.colors.primary }]}>
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              {items.map((item) => (
                <SearchResultCard
                  key={item.id}
                  item={item}
                  onPress={() => navigation.navigate('ScreenshotDetail', { id: item.id })}
                />
              ))}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />

      {/* 1. Top Search Header */}
      <View style={[styles.headerContainer, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerRow}>
          {navigation.canGoBack() && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.backBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              accessibilityLabel="Go back"
            >
              <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          )}

          {/* Search Input Bar */}
          <View
            style={[
              styles.inputBar,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Icon name="search" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: theme.colors.textPrimary }]}
              placeholder="Ask anything across your screenshots..."
              placeholderTextColor={theme.colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => executeSearch()}
              returnKeyType="search"
              autoCorrect={false}
            />

            {/* Clear Button */}
            {query.length > 0 && (
              <TouchableOpacity onPress={handleClearQuery} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 6 }}>
                <Icon name="close-circle" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Voice Search Button */}
            <TouchableOpacity
              onPress={() => setVoiceModalOpen(true)}
              style={[styles.micBtn, { backgroundColor: `${theme.colors.primary}18` }]}
              accessibilityLabel="Voice search"
            >
              <Icon name="mic" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Bookmark / Pin Query Action */}
          {query.trim().length > 0 && (
            <TouchableOpacity
              onPress={handleTogglePin}
              style={[
                styles.pinBtn,
                {
                  backgroundColor: isCurrentQuerySaved
                    ? `${theme.colors.primary}20`
                    : theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
              accessibilityLabel="Pin this search"
            >
              <Icon
                name={isCurrentQuerySaved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isCurrentQuerySaved ? theme.colors.primary : theme.colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Guest Search Mode Banner */}
        {isGuest && (
          <View style={[styles.offlineBanner, { backgroundColor: `${theme.colors.accent}15` }]}>
            <Icon name="lock-closed" size={14} color={theme.colors.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.offlineBannerText, { color: theme.colors.accent }]}>
              Guest Mode: Searching on-device OCR & SQLite knowledge base. Cloud AI is locked.
            </Text>
          </View>
        )}

        {/* Offline Indicator Banner */}
        {!isGuest && isOffline && (
          <View style={[styles.offlineBanner, { backgroundColor: `${theme.colors.warning}15` }]}>
            <Icon name="cloud-offline-outline" size={14} color={theme.colors.warning} style={{ marginRight: 6 }} />
            <Text style={[styles.offlineBannerText, { color: theme.colors.warning }]}>
              Offline Search Mode: Searching on-device OCR & SQLite knowledge base.
            </Text>
          </View>
        )}

        {/* Voice Search Origin Pill */}
        {lastVoiceQuery && query.trim().length > 0 && (
          <View
            style={[
              styles.voiceSearchPill,
              {
                backgroundColor: `${theme.colors.primary}15`,
                borderColor: `${theme.colors.primary}30`,
              },
            ]}
          >
            <Icon name="mic" size={13} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text numberOfLines={1} style={[styles.voiceSearchPillText, { color: theme.colors.primary }]}>
              Voice recognized: "{lastVoiceQuery}"
            </Text>
          </View>
        )}
      </View>

      {/* 2. Main Content Area */}
      {query.trim().length === 0 ? (
        /* Empty Query: Show History, Pinned, and Suggestions */
        <ScrollView style={styles.scrollFlex} showsVerticalScrollIndicator={false}>
          <RecentAndSavedSearches
            recentSearches={recentSearches}
            savedSearches={savedSearches}
            onSelectQuery={handleSelectSuggestion}
            onDeleteRecent={deleteRecentSearch}
            onClearAllRecent={clearAllRecentSearches}
            onDeleteSaved={(id) => toggleSaveSearch(savedSearches.find((s) => s.id === id)?.query || '')}
          />
        </ScrollView>
      ) : (
        /* Active Query: Filters, AI Answer Card, Results */
        <View style={styles.activeContentContainer}>
          {/* Material 3 Filter Chips */}
          <SearchFilterBar
            filters={activeFilters}
            onChangeFilter={setFilter}
            onResetFilters={resetFilters}
          />

          {/* Results List */}
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                {/* AI Answer Card / Lock */}
                {isGuest ? (
                  <FeatureLockCard
                    compact
                    title="Ask ContextVault AI Locked"
                    description="Sign in to unlock natural language AI summaries and cross-folder synthesis."
                    onSignIn={() => navigation.navigate('Login')}
                    onCreateAccount={() => navigation.navigate('Register')}
                  />
                ) : (
                  aiAnswer && (
                    <AIAnswerCard
                      data={aiAnswer}
                      loading={loading}
                      onSelectFollowUp={handleSelectSuggestion}
                    />
                  )
                )}

                {/* View Mode Switcher (Relevance vs Grouped) */}
                {results.length > 0 && (
                  <View style={styles.viewModeRow}>
                    <Text style={[styles.resultsCountText, { color: theme.colors.textSecondary }]}>
                      Found {results.length} result{results.length !== 1 ? 's' : ''}
                    </Text>

                    <View style={[styles.toggleContainer, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
                      <TouchableOpacity
                        onPress={() => setViewMode('relevance')}
                        style={[
                          styles.toggleTab,
                          viewMode === 'relevance' && {
                            backgroundColor: theme.colors.card,
                            elevation: 2,
                            shadowColor: '#000',
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.toggleTabText,
                            {
                              color:
                                viewMode === 'relevance'
                                  ? theme.colors.primary
                                  : theme.colors.textSecondary,
                            },
                          ]}
                        >
                          Ranked
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setViewMode('grouped')}
                        style={[
                          styles.toggleTab,
                          viewMode === 'grouped' && {
                            backgroundColor: theme.colors.card,
                            elevation: 2,
                            shadowColor: '#000',
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.toggleTabText,
                            {
                              color:
                                viewMode === 'grouped'
                                  ? theme.colors.primary
                                  : theme.colors.textSecondary,
                            },
                          ]}
                        >
                          Grouped
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            }
            renderItem={({ item }) => {
              if (viewMode === 'grouped') return null;
              return (
                <SearchResultCard
                  item={item}
                  onPress={() => navigation.navigate('ScreenshotDetail', { id: item.id })}
                />
              );
            }}
            ListFooterComponent={viewMode === 'grouped' ? renderGroupedResults() : null}
            ListEmptyComponent={
              loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={[styles.loadingFullText, { color: theme.colors.textSecondary }]}>
                    Searching across your knowledge base...
                  </Text>
                </View>
              ) : (
                <EmptyStateView
                  iconName="search-outline"
                  title="No Matching Screenshots"
                  description={`We couldn't find any screenshots matching "${query}". Try searching for apps, receipts, amounts, or clear filters.`}
                />
              )
            }
          />
        </View>
      )}

      {/* 3. Voice Search Modal */}
      <VoiceSearchModal
        visible={isVoiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        onSpeechResult={executeVoiceSearch}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  inputBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    height: '100%',
  },
  micBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  offlineBannerText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  scrollFlex: {
    flex: 1,
  },
  activeContentContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  viewModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  resultsCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
  },
  toggleTab: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleTabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  groupedContainer: {
    marginTop: 8,
  },
  groupSection: {
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  groupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  groupBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingFullText: {
    fontSize: 13,
    marginTop: 12,
  },
  voiceSearchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  voiceSearchPillText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});

