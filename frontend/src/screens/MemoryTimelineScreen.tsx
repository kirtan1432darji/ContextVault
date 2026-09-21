import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SectionList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { ModernCard } from '../components/ModernCard';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';
import {
  memoryTimelineService,
  dailyDigestService,
  digestSummaryService,
  financeInsightService,
  MemoryTimelineEvent,
  DailyDigest,
  PeriodDigest,
  FinanceInsights,
} from '../services/memory';

type TimelineFilter = 'all' | 'today' | 'this_week' | 'this_month' | 'spending' | 'travel';

interface TimelineSection {
  title: string;
  data: MemoryTimelineEvent[];
}

export const MemoryTimelineScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<TimelineFilter>('all');

  const [allEvents, setAllEvents] = useState<MemoryTimelineEvent[]>([]);
  const [todayDigest, setTodayDigest] = useState<DailyDigest | null>(null);
  const [weeklyDigest, setWeeklyDigest] = useState<PeriodDigest | null>(null);
  const [monthlyDigest, setMonthlyDigest] = useState<PeriodDigest | null>(null);
  const [financeInsights, setFinanceInsights] = useState<FinanceInsights | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [events, today, week, month, finance] = await Promise.all([
        memoryTimelineService.getAllEvents(forceRefresh),
        dailyDigestService.getTodayDigest(forceRefresh),
        digestSummaryService.getWeeklyDigest(0),
        digestSummaryService.getMonthlyDigest(0),
        financeInsightService.getSpendingInsights(),
      ]);

      setAllEvents(events);
      setTodayDigest(today);
      setWeeklyDigest(week);
      setMonthlyDigest(month);
      setFinanceInsights(finance);
    } catch (err) {
      console.warn('[MemoryTimelineScreen] Error loading memory data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter events according to selected chip
  const filteredEvents = useMemo(() => {
    if (selectedFilter === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      return allEvents.filter((e) => e.date === todayStr);
    }
    if (selectedFilter === 'this_week') {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return allEvents.filter((e) => e.timestamp >= weekAgo);
    }
    if (selectedFilter === 'this_month') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return allEvents.filter((e) => e.timestamp >= monthStart);
    }
    if (selectedFilter === 'spending') {
      return allEvents.filter((e) => e.amount && e.amount > 0);
    }
    if (selectedFilter === 'travel') {
      return allEvents.filter(
        (e) =>
          e.category.includes('travel') ||
          e.tags.includes('ticket') ||
          e.tags.includes('flight') ||
          ['IRCTC', 'MakeMyTrip', 'Uber', 'Ola'].includes(e.merchant || '')
      );
    }
    return allEvents;
  }, [allEvents, selectedFilter]);

  // Group filtered events into sticky sections by date or period label
  const sections: TimelineSection[] = useMemo(() => {
    const map = new Map<string, MemoryTimelineEvent[]>();

    for (const evt of filteredEvents) {
      const key = evt.periodGroup || evt.date;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(evt);
    }

    const result: TimelineSection[] = [];
    for (const [title, data] of map.entries()) {
      result.push({ title, data });
    }
    return result;
  }, [filteredEvents]);

  const handleRebuild = async () => {
    setLoading(true);
    await memoryTimelineService.rebuildTimeline();
    await loadData(true);
  };

  const renderDigestBanner = () => {
    if (selectedFilter === 'this_month' && monthlyDigest && monthlyDigest.totalScreenshots > 0) {
      return (
        <ModernCard style={styles.digestCard}>
          <View style={styles.digestHeader}>
            <View style={[styles.digestIconWrap, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Icon name="calendar-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.digestTitle, { color: theme.colors.textPrimary }]}>
                {monthlyDigest.periodLabel} Highlights
              </Text>
              <Text style={[styles.digestSubtitle, { color: theme.colors.textSecondary }]}>
                {monthlyDigest.totalScreenshots} screenshots captured
              </Text>
            </View>
          </View>
          <Text style={[styles.digestSummaryText, { color: theme.colors.textPrimary }]}>
            {monthlyDigest.summary}
          </Text>
          {monthlyDigest.highlights.length > 0 && (
            <View style={styles.digestChipsRow}>
              {monthlyDigest.highlights.map((hl, idx) => (
                <View key={idx} style={[styles.digestHighlightPill, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Icon name="sparkles" size={11} color={theme.colors.accent} style={{ marginRight: 4 }} />
                  <Text style={[styles.digestHighlightText, { color: theme.colors.textPrimary }]}>{hl}</Text>
                </View>
              ))}
            </View>
          )}
        </ModernCard>
      );
    }

    if (selectedFilter === 'this_week' && weeklyDigest && weeklyDigest.totalScreenshots > 0) {
      return (
        <ModernCard style={styles.digestCard}>
          <View style={styles.digestHeader}>
            <View style={[styles.digestIconWrap, { backgroundColor: `${theme.colors.accent}20` }]}>
              <Icon name="flame-outline" size={18} color={theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.digestTitle, { color: theme.colors.textPrimary }]}>
                Weekly AI Recap
              </Text>
              <Text style={[styles.digestSubtitle, { color: theme.colors.textSecondary }]}>
                {weeklyDigest.totalScreenshots} screenshots this week
              </Text>
            </View>
          </View>
          <Text style={[styles.digestSummaryText, { color: theme.colors.textPrimary }]}>
            {weeklyDigest.summary}
          </Text>
          {weeklyDigest.highlights.length > 0 && (
            <View style={styles.digestChipsRow}>
              {weeklyDigest.highlights.map((hl, idx) => (
                <View key={idx} style={[styles.digestHighlightPill, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Icon name="sparkles" size={11} color={theme.colors.accent} style={{ marginRight: 4 }} />
                  <Text style={[styles.digestHighlightText, { color: theme.colors.textPrimary }]}>{hl}</Text>
                </View>
              ))}
            </View>
          )}
        </ModernCard>
      );
    }

    if (selectedFilter === 'spending' && financeInsights) {
      return (
        <ModernCard style={styles.digestCard}>
          <View style={styles.digestHeader}>
            <View style={[styles.digestIconWrap, { backgroundColor: `${theme.colors.success}20` }]}>
              <Icon name="wallet-outline" size={18} color={theme.colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.digestTitle, { color: theme.colors.textPrimary }]}>
                Spending Intelligence
              </Text>
              <Text style={[styles.digestSubtitle, { color: theme.colors.textSecondary }]}>
                Tracked UPI Payments from SQLite
              </Text>
            </View>
            <View style={[styles.amountHeroBadge, { backgroundColor: `${theme.colors.success}15` }]}>
              <Text style={[styles.amountHeroText, { color: theme.colors.success }]}>
                ₹{financeInsights.totalUpiSpending.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
          {financeInsights.topMerchants.length > 0 && (
            <View style={styles.digestChipsRow}>
              {financeInsights.topMerchants.slice(0, 3).map((m, idx) => (
                <View key={idx} style={[styles.digestHighlightPill, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text style={[styles.digestHighlightText, { color: theme.colors.textPrimary }]}>
                    {m.merchant}: ₹{m.amount.toLocaleString('en-IN')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ModernCard>
      );
    }

    // Default Today Digest Card
    if (todayDigest) {
      return (
        <ModernCard style={styles.digestCard}>
          <View style={styles.digestHeader}>
            <View style={[styles.digestIconWrap, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Icon name="sparkles" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.digestTitle, { color: theme.colors.textPrimary }]}>
                Today in ContextVault
              </Text>
              <Text style={[styles.digestSubtitle, { color: theme.colors.textSecondary }]}>
                {todayDigest.dateFormatted}
              </Text>
            </View>
            <View style={[styles.countPill, { backgroundColor: `${theme.colors.primary}15` }]}>
              <Text style={[styles.countPillText, { color: theme.colors.primary }]}>
                {todayDigest.totalScreenshots} screenshots
              </Text>
            </View>
          </View>
          <Text style={[styles.digestSummaryText, { color: theme.colors.textPrimary }]}>
            {todayDigest.summary}
          </Text>
          {todayDigest.highlights.length > 0 && (
            <View style={styles.digestChipsRow}>
              {todayDigest.highlights.map((hl, idx) => (
                <View key={idx} style={[styles.digestHighlightPill, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Icon name="checkmark-circle-outline" size={12} color={theme.colors.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.digestHighlightText, { color: theme.colors.textPrimary }]}>{hl}</Text>
                </View>
              ))}
            </View>
          )}
        </ModernCard>
      );
    }

    return null;
  };

  const renderTimelineItem = ({ item }: { item: MemoryTimelineEvent }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('ScreenshotDetail', { id: item.screenshotId })}
        style={styles.eventRow}
      >
        {/* Timeline Line & Node */}
        <View style={styles.timelineCol}>
          <View style={[styles.timelineNode, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.timelineLine, { backgroundColor: theme.colors.border }]} />
        </View>

        {/* Event Card */}
        <ModernCard style={styles.eventCard}>
          <View style={styles.eventCardHeader}>
            <View style={styles.eventMetaLeft}>
              <Text style={[styles.eventCategoryTag, { color: theme.colors.primary }]}>
                {item.categoryName.toUpperCase()}
              </Text>
              <Text style={[styles.eventTimeText, { color: theme.colors.textSecondary }]}>
                • {item.timeStr || item.date}
              </Text>
            </View>
            {item.amount ? (
              <View style={[styles.amountBadge, { backgroundColor: `${theme.colors.success}18` }]}>
                <Text style={[styles.amountBadgeText, { color: theme.colors.success }]}>
                  ₹{item.amount.toLocaleString('en-IN')}
                </Text>
              </View>
            ) : null}
          </View>

          <Text numberOfLines={1} style={[styles.eventTitle, { color: theme.colors.textPrimary }]}>
            {item.title}
          </Text>

          <Text numberOfLines={2} style={[styles.eventSummary, { color: theme.colors.textSecondary }]}>
            {item.summary}
          </Text>

          <View style={styles.eventFooter}>
            <View style={styles.pillsRow}>
              {item.merchant ? (
                <View style={[styles.merchantPill, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Icon name="business-outline" size={11} color={theme.colors.textSecondary} style={{ marginRight: 3 }} />
                  <Text style={[styles.merchantPillText, { color: theme.colors.textPrimary }]}>
                    {item.merchant}
                  </Text>
                </View>
              ) : null}

              {item.tags.slice(0, 2).map((t, idx) => (
                <View key={idx} style={[styles.tagPill, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text style={[styles.tagPillText, { color: theme.colors.textSecondary }]}>
                    #{t}
                  </Text>
                </View>
              ))}
            </View>

            {/* Thumbnail */}
            <View style={styles.thumbWrapper}>
              <ScreenshotImageThumbnail
                screenshot={{
                  id: item.screenshotId,
                  filePath: item.filePath,
                  thumbnailUri: item.thumbnailUri,
                  contentUri: item.contentUri,
                }}
                filePath={item.filePath}
                thumbnailUri={item.thumbnailUri}
                contentUri={item.contentUri}
                style={styles.thumbnail}
                borderRadius={8}
              />
            </View>
          </View>
        </ModernCard>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: TimelineSection }) => (
    <View style={[styles.stickySectionHeader, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.stickySectionTitle, { color: theme.colors.textPrimary }]}>
        {section.title}
      </Text>
      <Text style={[styles.stickySectionCount, { color: theme.colors.textSecondary }]}>
        {section.data.length} {section.data.length === 1 ? 'event' : 'events'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            AI Memory Timeline
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Privacy-First Life History
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('GlobalAISearch', { autoFocus: false })}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Search memory timeline"
          >
            <Icon name="search-outline" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRebuild}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Rebuild timeline"
          >
            <Icon name="sync-outline" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Chips Bar */}
      <View style={[styles.filterBar, { borderBottomColor: theme.colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { id: 'all', label: 'All Memories' },
            { id: 'today', label: 'Today' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'spending', label: 'Spending' },
            { id: 'travel', label: 'Travel' },
          ].map((chip) => {
            const active = selectedFilter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                onPress={() => setSelectedFilter(chip.id as TimelineFilter)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? '#FFFFFF' : theme.colors.textPrimary, fontWeight: active ? '700' : '500' },
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Synthesizing Memory Timeline...
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderTimelineItem}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={renderDigestBanner}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Icon name="time-outline" size={48} color={theme.colors.textSecondary} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
                No Timeline Events Found
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.colors.textSecondary }]}>
                Screenshots analyzed by Local Vision AI and OCR will appear here in chronological order.
              </Text>
            </View>
          }
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 6,
    marginLeft: 6,
  },
  filterBar: {
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 13,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 32,
  },
  digestCard: {
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
  },
  digestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  digestIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  digestTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  digestSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  amountHeroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  amountHeroText: {
    fontSize: 15,
    fontWeight: '800',
  },
  digestSummaryText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  digestChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  digestHighlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  digestHighlightText: {
    fontSize: 11,
    fontWeight: '600',
  },
  stickySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  stickySectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  stickySectionCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  timelineCol: {
    width: 24,
    alignItems: 'center',
    marginRight: 8,
  },
  timelineNode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 16,
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: -4,
  },
  eventCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventCategoryTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  eventTimeText: {
    fontSize: 11,
    marginLeft: 4,
  },
  amountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  amountBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventSummary: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
    marginRight: 8,
  },
  merchantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  merchantPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '500',
  },
  thumbWrapper: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 44,
    height: 44,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
