import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';

interface DateSeparatorProps {
  dateString: string;
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({ dateString }) => {
  const theme = useAppTheme();

  const formatHeader = (dStr: string) => {
    try {
      const msgDate = new Date(dStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      if (msgDate.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (msgDate.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      } else {
        return msgDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: msgDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
        });
      }
    } catch {
      return dateString;
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
      <View
        style={[
          styles.pill,
          {
            backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9',
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
          {formatHeader(dateString)}
        </Text>
      </View>
      <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    paddingHorizontal: 20,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 10,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
