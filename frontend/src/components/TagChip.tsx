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
  colorHex,
  onPress,
  onRemove,
  selected = false,
}) => {
  const theme = useAppTheme();
  const activeColor = colorHex || theme.colors.primary;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected
            ? activeColor
            : theme.isDark
            ? '#252525'
            : '#F1F3F4',
          borderColor: selected
            ? activeColor
            : theme.isDark
            ? '#333333'
            : '#E5E7EB',
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: selected
              ? '#FFFFFF'
              : theme.isDark
              ? '#E5E7EB'
              : '#374151',
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    marginLeft: 4,
  },
});
