import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import {
  memoryTimelineService,
  dailyDigestService,
  digestAggregationService,
  memoryInsightsService,
  MemoryTimelineEvent,
  TimelineGrouping,
  DailyDigest,
  PeriodDigest,
  InsightDomainCard,
} from '../services/memory';
import {
  TimelineCard,
  DigestCard,
  InsightCard,
  TimelineSection,
} from '../components/memory';

type TimelineFilter =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'earlier_this_month'
  | 'older'
  | 'spending'
  | 'travel';

export const MemoryTimelineScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<TimelineFilter>('all');

  const [grouping, setGrouping] = useState<TimelineGrouping | null>(null);
  const [allEvents, setAllEvents] = useState<MemoryTimelineEvent[]>([]);
  const [todayDigest, setTodayDigest] = useState<DailyDigest | null>(null);
  const [weeklyDigest, setWeeklyDigest] = useState<PeriodDigest | null>(null);
  const [insights, setInsights] = useState<InsightDomainCard[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [showInsights, setShowInsights] = useState(false);

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [timelineGroup, digest, week, insightCards, streakDays] = await Promise.all([
        memoryTimelineService.getTimeline({ forceRefresh }),
        dailyDigestService.getTodayDigest(forceRefresh),
        digestAggregationService.getWeeklyDigest(0),
        memoryInsightsService.getAllInsights(forceRefresh),
        digestAggregationService.calculateScreenshotStreak(),
      ]);

      setGrouping(timelineGroup);
      setAllEvents(timelineGroup.allEvents || []);
      setTodayDigest(digest);
      setWeeklyDigest(week);
      setInsights(insightCards);
      setStreak(streakDays);
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

  const handleRebuild = async () => {
    try {
      setRebuilding(true);
      const newGrouping = await memoryTimelineService.rebuildTimeline();
      setGrouping(newGrouping);
      setAllEvents(newGrouping.allEvents || []);
      const [digest, week, insightCards] = await Promise.all([
        dailyDigestService.getTodayDigest(true),
        digestAggregationService.getWeeklyDigest(0),
        memoryInsightsService.getAllInsights(true),
      ]);
      setTodayDigest(digest);
      setWeeklyDigest(week);
      setInsights(insightCards);
    } catch (err) {
      console.warn('[MemoryTimelineScreen] Error rebuilding timeline:', err);
    } finally {
      setRebuilding(false);
    }
  };

  const handleCardPress = (event: MemoryTimelineEvent) => {
    navigation.navigate('ScreenshotDetail', { id: event.screenshotId });
  };

  // Filter events according to selected chip
  const filteredEvents = useMemo(() => {
    if (selectedFilter === 'all') return allEvents;
    if (selectedFilter === 'today') return grouping?.today || [];
    if (selectedFilter === 'yesterday') return grouping?.yesterday || [];
    if (selectedFilter === 'this_week') return grouping?.thisWeek || [];
    if (selectedFilter === 'earlier_this_month') return grouping?.earlierThisMonth || [];
    if (selectedFilter === 'older') return grouping?.older || [];
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
  }, [allEvents, grouping, selectedFilter]);

  const filterChips: { id: TimelineFilter; label: string; icon?: string }[] = [
    { id: 'all', label: 'All', icon: 'grid-outline' },
    { id: 'today', label: 'Today', icon: 'today-outline' },
    { id: 'yesterday', label: 'Yesterday', icon: 'time-outline' },
    { id: 'this_week', label: 'This Week', icon: 'calendar-outline' },
    { id: 'earlier_this_month', label: 'This Month', icon: 'layers-outline' },
    { id: 'older', label: 'Older', icon: 'archive-outline' },
    { id: 'spending', label: 'Spending', icon: 'wallet-outline' },
    { id: 'travel', label: 'Travel', icon: 'airplane-outline' },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.isDark ? '#0B0F19' : '#F8FAFC' }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.isDark ? '#0B0F19' : '#F8FAFC'}
      />

      {/* Screen App Bar */}
      <View style={[styles.appBar, { borderBottomColor: theme.isDark ? '#1F2937' : '#E5E7EB' }]}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>AI Memory Timeline</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Chronological Screenshot Assistant</Text>
          </View>
        </View>

        <View style={styles.appBarRight}>
          <TouchableOpacity
            onPress={() => setShowInsights(!showInsights)}
            style={[styles.headerIconBtn, showInsights && { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}
          >
            <Icon name="analytics-outline" size={20} color={showInsights ? '#3B82F6' : theme.colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRebuild} disabled={rebuilding} style={styles.headerIconBtn}>
            {rebuilding ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <Icon name="refresh-outline" size={20} color={theme.colors.textPrimary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
      >
        {/* 1. Hero Memory Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.isDark ? '#111827' : '#FFFFFF',
              borderColor: theme.isDark ? '#1F2937' : '#E5E7EB',
            },
          ]}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <View style={styles.sparkleWrap}>
                <Icon name="sparkles" size={18} color="#3B82F6" />
              </View>
              <View>
                <Text style={[styles.heroHeading, { color: theme.colors.textPrimary }]}>AI Screenshot Memories</Text>
                <Text style={[styles.heroSub, { color: theme.colors.textSecondary }]}>
                  {allEvents.length} memories tracked across {grouping ? Object.keys(grouping.monthly).length : 1} months
                </Text>
              </View>
            </View>

            {streak > 0 && (
              <View style={styles.streakBadge}>
                <Icon name="flame" size={14} color="#F97316" style={{ marginRight: 4 }} />
                <Text style={styles.streakText}>{streak}d Streak</Text>
              </View>
            )}
          </View>

          {/* Quick Metrics Bar */}
          <View style={styles.heroMetrics}>
            <View style={styles.heroMetricItem}>
              <Text style={styles.heroMetricVal}>{grouping?.today.length || 0}</Text>
              <Text style={[styles.heroMetricLabel, { color: theme.colors.textSecondary }]}>Today</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroMetricItem}>
              <Text style={styles.heroMetricVal}>{grouping?.thisWeek.length || 0}</Text>
              <Text style={[styles.heroMetricLabel, { color: theme.colors.textSecondary }]}>This Week</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroMetricItem}>
              <Text style={[styles.heroMetricVal, { color: '#10B981' }]}>
                ₹{Math.round(todayDigest?.spendingTotal || 0).toLocaleString('en-IN')}
              </Text>
              <Text style={[styles.heroMetricLabel, { color: theme.colors.textSecondary }]}>Spent Today</Text>
            </View>
          </View>
        </View>

        {/* 2. Today's AI Daily Digest Banner */}
        {todayDigest && todayDigest.totalScreenshots > 0 && (
          <DigestCard
            digest={todayDigest}
            type="daily"
            onPress={() => setSelectedFilter('today')}
          />
        )}

        {/* 3. Domain Insights Horizontal Strip (Toggleable or Visible) */}
        {(showInsights || insights.length > 0) && (
          <View style={styles.insightsSection}>
            <View style={styles.sectionHeader}>
              <Icon name="bulb-outline" size={16} color="#3B82F6" style={{ marginRight: 6 }} />
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Memory Insights</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.insightsScroll}>
              {insights.map((insight, idx) => (
                <InsightCard key={idx} insight={insight} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* 4. Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {filterChips.map((chip) => {
            const isSelected = selectedFilter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                onPress={() => setSelectedFilter(chip.id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected
                      ? '#3B82F6'
                      : theme.isDark
                      ? '#1E293B'
                      : '#F1F5F9',
                    borderColor: isSelected
                      ? '#3B82F6'
                      : theme.isDark
                      ? '#334155'
                      : '#CBD5E1',
                  },
                ]}
              >
                {chip.icon && (
                  <Icon
                    name={chip.icon}
                    size={13}
                    color={isSelected ? '#FFFFFF' : theme.colors.textSecondary}
                    style={{ marginRight: 5 }}
                  />
                )}
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? '#FFFFFF' : theme.colors.textPrimary },
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 5. Chronological Timeline Sections */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading AI Memory Timeline...</Text>
          </View>
        ) : filteredEvents.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Icon name="archive-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No memories found</Text>
            <Text style={[styles.emptySub, { color: theme.colors.textSecondary }]}>
              {selectedFilter === 'all'
                ? 'Screenshots captured will automatically be organized chronologically into daily digests and memory timeline events.'
                : 'No screenshots found matching this filter.'}
            </Text>
          </View>
        ) : selectedFilter !== 'all' ? (
          // Single flat list when filtered
          <View style={{ paddingTop: 8 }}>
            {filteredEvents.map((evt) => (
              <TimelineCard key={evt.id} event={evt} onPress={handleCardPress} />
            ))}
          </View>
        ) : (
          // Multi-period sections for 'all'
          <View style={{ paddingTop: 4 }}>
            {/* Today */}
            {grouping && grouping.today.length > 0 && (
              <TimelineSection title="Today" period="today" count={grouping.today.length}>
                {grouping.today.map((evt) => (
                  <TimelineCard key={evt.id} event={evt} onPress={handleCardPress} />
                ))}
              </TimelineSection>
            )}

            {/* Yesterday */}
            {grouping && grouping.yesterday.length > 0 && (
              <TimelineSection title="Yesterday" period="yesterday" count={grouping.yesterday.length}>
                {grouping.yesterday.map((evt) => (
                  <TimelineCard key={evt.id} event={evt} onPress={handleCardPress} />
                ))}
              </TimelineSection>
            )}

            {/* This Week */}
            {grouping && grouping.thisWeek && grouping.thisWeek.length > 0 && (
              <TimelineSection title="This Week" period="this_week" count={grouping.thisWeek.length}>
                {weeklyDigest && weeklyDigest.totalScreenshots > 0 && (
                  <DigestCard digest={weeklyDigest} type="weekly" />
                )}
                {grouping.thisWeek.map((evt) => (
                  <TimelineCard key={evt.id} event={evt} onPress={handleCardPress} />
                ))}
              </TimelineSection>
            )}

            {/* Earlier This Month */}
            {grouping && grouping.earlierThisMonth && grouping.earlierThisMonth.length > 0 && (
              <TimelineSection
                title="Earlier This Month"
                period="earlier_this_month"
                count={grouping.earlierThisMonth.length}
              >
                {grouping.earlierThisMonth.map((evt) => (
                  <TimelineCard key={evt.id} event={evt} onPress={handleCardPress} />
                ))}
              </TimelineSection>
            )}

            {/* Older Memories */}
            {grouping && grouping.older && grouping.older.length > 0 && (
              <TimelineSection title="Older Memories" period="older" count={grouping.older.length}>
                {grouping.older.map((evt) => (
                  <TimelineCard key={evt.id} event={evt} onPress={handleCardPress} />
                ))}
              </TimelineSection>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroCard: {
    margin: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sparkleWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  heroHeading: {
    fontSize: 16,
    fontWeight: '800',
  },
  heroSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F97316',
  },
  heroMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    paddingVertical: 10,
  },
  heroMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  heroMetricVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3B82F6',
  },
  heroMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  insightsSection: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  insightsScroll: {
    paddingHorizontal: 16,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  emptyWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
