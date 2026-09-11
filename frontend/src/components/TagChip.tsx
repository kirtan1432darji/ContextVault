import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../theme';

interface TagChipProps {
  label: string;
  colorHex?: string;
  onPress?: () => void;
  onRemove?: () => void;
  selected?: boolean;
}

export const TagChip: React.FC<TagChipProps> = ({
  label,
  colorHex = '#6366F1',
  onPress,
  onRemove,
  selected = false,
}) => {
  const theme = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected
            ? colorHex
            : theme.colors.surfaceVariant,
          borderColor: selected ? colorHex : theme.colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: selected
              ? '#FFFFFF'
              : theme.colors.textPrimary,
          },
        ]}
      >
        #{label}
      </Text>
      {onRemove && (
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.removeButton}
        >
          <Icon
            name="close-circle"
            size={14}
            color={selected ? '#FFFFFF' : theme.colors.textMuted}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
  removeButton: {
    marginLeft: 4,
  },
});
