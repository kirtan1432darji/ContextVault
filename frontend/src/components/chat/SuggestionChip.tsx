import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';

interface SuggestionChipProps {
  label: string;
  onPress: (text: string) => void;
  disabled?: boolean;
}

export const SuggestionChip: React.FC<SuggestionChipProps> = ({
  label,
  onPress,
  disabled = false,
}) => {
  const theme = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={() => onPress(label)}
      style={[
        styles.chip,
        {
          backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9',
          borderColor: theme.isDark ? '#334155' : '#E2E8F0',
        },
      ]}
    >
      <Icon
        name="sparkles"
        size={13}
        color={theme.colors.primary}
        style={styles.icon}
      />
      <Text
        numberOfLines={1}
        style={[styles.text, { color: theme.colors.textPrimary }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginVertical: 4,
  },
  icon: {
    marginRight: 5,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
  },
});
