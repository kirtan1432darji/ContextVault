import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { InsightDomainCard } from '../../services/memory/types';

interface InsightCardProps {
  insight: InsightDomainCard;
  onPress?: () => void;
}

export const InsightCard: React.FC<InsightCardProps> = ({ insight, onPress }) => {
  const theme = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.isDark ? '#111827' : '#FFFFFF',
          borderColor: theme.isDark ? '#1F2937' : '#E5E7EB',
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${insight.color}20` }]}>
          <Icon name={insight.icon} size={18} color={insight.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            {insight.title}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {insight.subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.metricWrap}>
        <Text style={[styles.primaryMetric, { color: insight.color }]}>
          {insight.primaryMetric}
        </Text>
        {insight.secondaryMetric && (
          <Text style={[styles.secondaryMetric, { color: theme.colors.textSecondary }]}>
            {insight.secondaryMetric}
          </Text>
        )}
      </View>

      {insight.items && insight.items.length > 0 && (
        <View style={styles.itemsWrap}>
          {insight.items.slice(0, 3).map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={[styles.itemLabel, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.itemValue, { color: theme.colors.textPrimary }]}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      )}

      {insight.highlights && insight.highlights.length > 0 && (
        <View style={styles.highlightPill}>
          <Icon name="information-circle-outline" size={13} color={insight.color} style={{ marginRight: 4 }} />
          <Text style={[styles.highlightText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {insight.highlights[0]}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 260,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  metricWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  primaryMetric: {
    fontSize: 22,
    fontWeight: '800',
    marginRight: 6,
  },
  secondaryMetric: {
    fontSize: 12,
    fontWeight: '500',
  },
  itemsWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  itemValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  highlightText: {
    fontSize: 11,
    flex: 1,
  },
});
