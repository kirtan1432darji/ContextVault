import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { ModernCard } from '../components/ModernCard';
import {
  folderAnalyticsService,
  FolderAnalyticsOverview,
} from '../services/FolderAnalyticsService';
import { FileUtils } from '../utils/fileUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'FolderAnalytics'>;

export const FolderAnalyticsScreen: React.FC<Props> = ({ route, navigation }) => {
  const theme = useAppTheme();
  const categoryId = route.params?.categoryId;
  const categoryName = route.params?.categoryName;

  const [analytics, setAnalytics] = useState<FolderAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await folderAnalyticsService.getAnalyticsOverview(categoryId);
      setAnalytics(data);
    } catch (err) {
      console.warn('[FolderAnalyticsScreen] Error fetching metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Navigation Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {categoryName ? `${categoryName} Analytics` : 'Folder Analytics'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {categoryName ? 'Category Storage & Intelligence' : 'Global Storage & AI Metrics'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.backBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Refresh analytics"
        >
          <Icon name="refresh-outline" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading && !analytics ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Aggregating folder intelligence...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* 1. Key Metric Overview Cards (2x2 Grid) */}
          <View style={styles.metricsGrid}>
            <ModernCard style={styles.metricCard}>
              <View style={[styles.metricIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
                <Icon name="images-outline" size={20} color={theme.colors.primary} />
              </View>
              <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
                {analytics?.totalScreenshots || 0}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Total Screenshots
              </Text>
            </ModernCard>

            <ModernCard style={styles.metricCard}>
              <View style={[styles.metricIconCircle, { backgroundColor: `${theme.colors.success}18` }]}>
                <Icon name="server-outline" size={20} color={theme.colors.success} />
              </View>
              <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
                {FileUtils.formatBytes(analytics?.totalStorageBytes || 0)}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Vault Storage
              </Text>
            </ModernCard>

            <ModernCard style={styles.metricCard}>
              <View style={[styles.metricIconCircle, { backgroundColor: `${theme.colors.accent}18` }]}>
                <Icon name="shield-checkmark-outline" size={20} color={theme.colors.accent} />
              </View>
              <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
                {analytics ? `${Math.round(analytics.averageConfidence * 100)}%` : '0%'}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Avg AI Confidence
              </Text>
            </ModernCard>

            <ModernCard style={styles.metricCard}>
              <View style={[styles.metricIconCircle, { backgroundColor: '#8B5CF618' }]}>
                <Icon name="checkmark-done-circle-outline" size={20} color="#8B5CF6" />
              </View>
              <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
                {analytics?.manualReclassifiedCount || 0}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                User Verified
              </Text>
            </ModernCard>
          </View>

          {/* 2. Folder Screenshot & Storage Distribution */}
          <ModernCard style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
                <Icon name="folder-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  Folder Storage Distribution
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  Item count and size breakdown per category
                </Text>
              </View>
            </View>

            {analytics?.categories && analytics.categories.length > 0 ? (
              <View style={styles.distributionList}>
                {analytics.categories.map((cat) => (
                  <View key={cat.categoryId} style={styles.distributionRow}>
                    <View style={styles.distributionMeta}>
                      <View style={styles.catNameRow}>
                        <View style={[styles.catDot, { backgroundColor: cat.colorHex }]} />
                        <Text style={[styles.catNameText, { color: theme.colors.textPrimary }]}>
                          {cat.categoryName}
                        </Text>
                      </View>
                      <Text style={[styles.catCountText, { color: theme.colors.textSecondary }]}>
                        {cat.count} items ({FileUtils.formatBytes(cat.totalSizeBytes)})
                      </Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={[styles.progressTrack, { backgroundColor: theme.isDark ? '#1F2937' : '#E5E7EB' }]}>
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${Math.max(4, Math.min(100, cat.percentageOfTotal))}%`,
                            backgroundColor: cat.colorHex,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                No categories indexed yet.
              </Text>
            )}
          </ModernCard>

          {/* 3. AI Classification Confidence Breakdown */}
          <ModernCard style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: `${theme.colors.success}18` }]}>
                <Icon name="analytics-outline" size={18} color={theme.colors.success} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  AI Classification Accuracy
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  Quality distribution of neural and heuristic categorization
                </Text>
              </View>
            </View>

            <View style={styles.tiersContainer}>
              {analytics?.confidenceTiers.map((tier) => (
                <View
                  key={tier.tier}
                  style={[
                    styles.tierCard,
                    {
                      backgroundColor: theme.isDark ? '#1F293750' : '#F9FAFB',
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.tierHeader}>
                    <View style={[styles.tierBadge, { backgroundColor: `${tier.color}18` }]}>
                      <Text style={[styles.tierBadgeText, { color: tier.color }]}>
                        {tier.label}
                      </Text>
                    </View>
                    <Text style={[styles.tierCountText, { color: theme.colors.textPrimary }]}>
                      {tier.count} ({tier.percentage}%)
                    </Text>
                  </View>
                  <Text style={[styles.tierDescText, { color: theme.colors.textSecondary }]}>
                    {tier.description}
                  </Text>
                  {/* Progress Line */}
                  <View style={[styles.progressTrack, { backgroundColor: theme.isDark ? '#374151' : '#E5E7EB', marginTop: 8 }]}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${Math.max(2, Math.min(100, tier.percentage))}%`,
                          backgroundColor: tier.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </ModernCard>

          {/* 4. OCR & Semantic Entities Tally */}
          <ModernCard style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: '#F59E0B18' }]}>
                <Icon name="cube-outline" size={18} color="#F59E0B" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  OCR Semantic Knowledge Tally
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  Entities extracted across entire screenshot corpus
                </Text>
              </View>
            </View>

            <View style={styles.entitiesGrid}>
              <View style={[styles.entityBox, { backgroundColor: theme.isDark ? '#1F2937' : '#F3F4F6' }]}>
                <Icon name="cash-outline" size={20} color="#10B981" />
                <Text style={[styles.entityNumber, { color: theme.colors.textPrimary }]}>
                  {analytics?.entitiesTally.amountsCount || 0}
                </Text>
                <Text style={[styles.entityLabel, { color: theme.colors.textSecondary }]}>
                  Currencies & Amounts
                </Text>
              </View>

              <View style={[styles.entityBox, { backgroundColor: theme.isDark ? '#1F2937' : '#F3F4F6' }]}>
                <Icon name="storefront-outline" size={20} color="#3B82F6" />
                <Text style={[styles.entityNumber, { color: theme.colors.textPrimary }]}>
                  {analytics?.entitiesTally.merchantsCount || 0}
                </Text>
                <Text style={[styles.entityLabel, { color: theme.colors.textSecondary }]}>
                  Merchants & Brands
                </Text>
              </View>

              <View style={[styles.entityBox, { backgroundColor: theme.isDark ? '#1F2937' : '#F3F4F6' }]}>
                <Icon name="calendar-outline" size={20} color="#8B5CF6" />
                <Text style={[styles.entityNumber, { color: theme.colors.textPrimary }]}>
                  {analytics?.entitiesTally.datesCount || 0}
                </Text>
                <Text style={[styles.entityLabel, { color: theme.colors.textSecondary }]}>
                  Key Dates & Deadlines
                </Text>
              </View>

              <View style={[styles.entityBox, { backgroundColor: theme.isDark ? '#1F2937' : '#F3F4F6' }]}>
                <Icon name="link-outline" size={20} color="#EC4899" />
                <Text style={[styles.entityNumber, { color: theme.colors.textPrimary }]}>
                  {analytics?.entitiesTally.urlsCount || 0}
                </Text>
                <Text style={[styles.entityLabel, { color: theme.colors.textSecondary }]}>
                  URLs & Portals
                </Text>
              </View>
            </View>
          </ModernCard>

          {/* 5. Top Source Applications */}
          {analytics?.sourceApps && analytics.sourceApps.length > 0 && (
            <ModernCard style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconCircle, { backgroundColor: '#6366F118' }]}>
                  <Icon name="apps-outline" size={18} color="#6366F1" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                    Top Source Applications
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                    Origin of captured content
                  </Text>
                </View>
              </View>

              <View style={styles.distributionList}>
                {analytics.sourceApps.map((app, idx) => (
                  <View key={`${app.appName}-${idx}`} style={styles.distributionRow}>
                    <View style={styles.distributionMeta}>
                      <Text style={[styles.catNameText, { color: theme.colors.textPrimary }]}>
                        {app.appName}
                      </Text>
                      <Text style={[styles.catCountText, { color: theme.colors.textSecondary }]}>
                        {app.count} screenshots ({app.percentage}%)
                      </Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: theme.isDark ? '#1F2937' : '#E5E7EB' }]}>
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${Math.max(4, Math.min(100, app.percentage))}%`,
                            backgroundColor: '#6366F1',
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </ModernCard>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: 14,
    borderRadius: 16,
  },
  metricIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  sectionCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  distributionList: {
    gap: 12,
  },
  distributionRow: {
    gap: 6,
  },
  distributionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  catNameText: {
    fontSize: 14,
    fontWeight: '600',
  },
  catCountText: {
    fontSize: 12,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  tiersContainer: {
    gap: 10,
  },
  tierCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tierCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tierDescText: {
    fontSize: 12,
  },
  entitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  entityBox: {
    flex: 1,
    minWidth: '45%',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  entityNumber: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
  },
  entityLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
});
