import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';

interface MerchantChipProps {
  merchant: string;
  amount?: number;
  icon?: string;
  color?: string;
  onPress?: () => void;
}

export const MerchantChip: React.FC<MerchantChipProps> = ({
  merchant,
  amount,
  icon = 'business-outline',
  color,
  onPress,
}) => {
  const theme = useAppTheme();
  const accentColor = color || theme.colors.primary;

  const content = (
    <View style={[styles.container, { borderColor: theme.isDark ? '#334155' : '#E2E8F0', backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC' }]}>
      <Icon name={icon} size={13} color={accentColor} style={styles.icon} />
      <Text style={[styles.name, { color: theme.colors.textPrimary }]} numberOfLines={1}>
        {merchant}
      </Text>
      {amount !== undefined && amount > 0 && (
        <Text style={styles.amount}>
          ₹{Math.round(amount).toLocaleString('en-IN')}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  icon: {
    marginRight: 5,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
  },
  amount: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
});
