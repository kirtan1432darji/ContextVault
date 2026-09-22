import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { DailyDigest, PeriodDigest } from '../../services/memory/types';

interface DigestCardProps {
  digest: DailyDigest | PeriodDigest;
  type?: 'daily' | 'weekly' | 'monthly';
  onPress?: () => void;
}

export const DigestCard: React.FC<DigestCardProps> = ({ digest, type = 'daily', onPress }) => {
  const theme = useAppTheme();

  const isDaily = type === 'daily';
  const daily = isDaily ? (digest as DailyDigest) : null;
  const period = !isDaily ? (digest as PeriodDigest) : null;

  const title = isDaily
    ? "Today's AI Digest"
    : period?.periodLabel
    ? `${period.periodLabel} Digest`
    : 'AI Memory Digest';

  const subtitle = isDaily
    ? daily?.dateFormatted || daily?.date || ''
    : `${period?.dateFrom || ''} – ${period?.dateTo || ''}`;

  const screenshotCount = isDaily
    ? daily?.totalScreenshots || 0
    : period?.totalScreenshots || 0;

  const spending = isDaily
    ? daily?.spendingTotal || 0
    : period?.spending?.totalAmount || 0;

  const highlights = isDaily
    ? daily?.highlights || []
    : period?.highlights || [];

  const topMerchant = isDaily
    ? daily?.topMerchant
    : period?.spending?.topMerchant;

  const topCategory = isDaily
    ? daily?.topCategory
    : period?.spending?.topCategory;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC',
          borderColor: theme.isDark ? '#2563EB40' : '#93C5FD',
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Icon name="sparkles" size={16} color="#3B82F6" />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
          </View>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{screenshotCount} screenshots</Text>
        </View>
      </View>

      {/* AI Summary */}
      <Text style={[styles.summary, { color: theme.colors.textPrimary }]}>
        {digest.summary}
      </Text>

      {/* Stats Pill Row */}
      <View style={styles.statsRow}>
        {spending > 0 && (
          <View style={styles.spendingPill}>
            <Icon name="wallet-outline" size={12} color="#10B981" style={{ marginRight: 4 }} />
            <Text style={styles.spendingText}>₹{Math.round(spending).toLocaleString('en-IN')}</Text>
          </View>
        )}
        {topMerchant && (
          <View style={styles.statPill}>
            <Icon name="business-outline" size={12} color="#3B82F6" style={{ marginRight: 4 }} />
            <Text style={styles.statPillText}>{topMerchant}</Text>
          </View>
        )}
        {topCategory && (
          <View style={styles.statPill}>
            <Icon name="folder-outline" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={styles.statPillText}>{topCategory}</Text>
          </View>
        )}
      </View>

      {/* Highlights */}
      {highlights.length > 0 && (
        <View style={styles.highlightsWrap}>
          {highlights.slice(0, 3).map((item, idx) => (
            <View key={idx} style={styles.highlightItem}>
              <View style={styles.bullet} />
              <Text style={[styles.highlightText, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  countBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
  },
  summary: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  spendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 4,
  },
  spendingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 4,
  },
  statPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  highlightsWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3B82F6',
    marginRight: 8,
  },
  highlightText: {
    fontSize: 12,
    fontWeight: '400',
    flex: 1,
  },
});
