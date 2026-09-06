import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme';

interface LoadingShimmerProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export const LoadingShimmer: React.FC<LoadingShimmerProps> = ({
  width = '100%',
  height = 100,
  borderRadius = 12,
  style,
}) => {
  const theme = useAppTheme();

  return (
    <View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0',
        },
        style,
      ]}
    />
  );
};
