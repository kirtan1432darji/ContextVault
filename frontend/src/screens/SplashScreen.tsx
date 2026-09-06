import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { AppInfo } from '../utils/appConstants';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('MainTabs', { screen: 'Home' });
    }, 1200);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.logoContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
        <Icon name="scan-outline" size={54} color={theme.colors.primary} />
      </View>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
        {AppInfo.appName}
      </Text>
      <Text style={[styles.tagline, { color: theme.colors.textSecondary }]}>
        {AppInfo.tagline}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
