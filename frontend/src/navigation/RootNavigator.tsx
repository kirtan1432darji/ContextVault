import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { FolderDetailScreen } from '../screens/FolderDetailScreen';
import { FolderContextScreen } from '../screens/FolderContextScreen';
import { ContextAIChatScreen } from '../screens/ContextAIChatScreen';
import { ScreenshotDetailScreen } from '../screens/ScreenshotDetailScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
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
    </Stack.Navigator>
  );
};
