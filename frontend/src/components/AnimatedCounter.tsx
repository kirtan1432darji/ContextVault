import React from 'react';
import { Text, TextStyle } from 'react-native';

interface AnimatedCounterProps {
  value: number;
  style?: TextStyle;
  prefix?: string;
  suffix?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  style,
  prefix = '',
  suffix = '',
}) => {
  return (
    <Text style={style}>
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </Text>
  );
};
