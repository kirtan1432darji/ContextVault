import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';

interface ActivityBadgeProps {
  label: string;
  count?: number | string;
  icon?: string;
  variant?: 'primary' | 'success' | 'warning' | 'purple' | 'cyan' | 'neutral';
}

export const ActivityBadge: React.FC<ActivityBadgeProps> = ({
  label,
  count,
  icon,
  variant = 'primary',
}) => {
  const theme = useAppTheme();

  const colorMap = {
    primary: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
    success: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' },
    warning: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
    purple: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8B5CF6', border: 'rgba(139, 92, 246, 0.3)' },
    cyan: { bg: 'rgba(6, 182, 212, 0.15)', text: '#06B6D4', border: 'rgba(6, 182, 212, 0.3)' },
    neutral: { bg: theme.isDark ? '#1E293B' : '#F1F5F9', text: theme.colors.textSecondary, border: theme.isDark ? '#334155' : '#CBD5E1' },
  };

  const scheme = colorMap[variant];

  return (
    <View style={[styles.badge, { backgroundColor: scheme.bg, borderColor: scheme.border }]}>
      {icon && <Icon name={icon} size={12} color={scheme.text} style={styles.icon} />}
      <Text style={[styles.label, { color: scheme.text }]}>
        {label}
      </Text>
      {count !== undefined && (
        <View style={[styles.countPill, { backgroundColor: scheme.text }]}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  countPill: {
    marginLeft: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
