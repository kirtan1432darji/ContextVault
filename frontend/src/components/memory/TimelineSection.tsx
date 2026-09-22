import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { TimelinePeriod } from '../../services/memory/types';

interface TimelineSectionProps {
  title: string;
  period?: TimelinePeriod;
  count: number;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({
  title,
  period = 'today',
  count,
  children,
  collapsible = false,
  defaultExpanded = true,
}) => {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const getPeriodIcon = (p: string): string => {
    switch (p) {
      case 'today':
        return 'today';
      case 'yesterday':
        return 'time-outline';
      case 'this_week':
      case 'last_7_days':
        return 'calendar-outline';
      case 'earlier_this_month':
      case 'last_30_days':
        return 'layers-outline';
      case 'older':
      case 'monthly':
      case 'yearly':
        return 'archive-outline';
      default:
        return 'calendar-outline';
    }
  };

  const iconName = getPeriodIcon(period);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={collapsible ? 0.7 : 1}
        onPress={() => collapsible && setExpanded(!expanded)}
        style={[
          styles.header,
          {
            backgroundColor: theme.isDark ? '#0B0F19' : '#F1F5F9',
            borderBottomColor: theme.isDark ? '#1F2937' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Icon name={iconName} size={15} color="#3B82F6" />
          </View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        </View>

        {collapsible && (
          <Icon
            name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={18}
            color={theme.colors.textSecondary}
          />
        )}
      </TouchableOpacity>

      {expanded && <View style={styles.body}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  countPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
  },
  body: {
    paddingTop: 4,
  },
});
