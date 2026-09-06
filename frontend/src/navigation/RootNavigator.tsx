import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import {
  SplashScreen,
  OnboardingScreen,
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  FolderDetailScreen,
  FolderContextScreen,
  ContextAIChatScreen,
  ScreenshotDetailScreen,
  PrivacyPolicyScreen,
  ScannerStatusScreen,
} from '../screens';
import { useAuthStore } from '../store/auth.store';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {/* 1. Launch & Authentication Gate */}
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

      {/* 2. Protected Routes */}
      {isAuthenticated ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen
            name="FolderDetail"
            component={FolderDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="FolderContext"
            component={FolderContextScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="ContextAIChat"
            component={ContextAIChatScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="ScreenshotDetail"
            component={ScreenshotDetailScreen}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ScannerStatus"
            component={ScannerStatusScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </>
      ) : null}
    </Stack.Navigator>
  );
};
