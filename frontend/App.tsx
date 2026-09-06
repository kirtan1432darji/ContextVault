import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppTheme } from './src/theme';
import { useSettingsStore } from './src/store/settings.store';
import { screenshotListenerService } from './src/services/ScreenshotListenerService';

export const App: React.FC = () => {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const theme = useAppTheme(themeMode);

  useEffect(() => {
    // Automatically initialize screenshot detection engine on app launch
    screenshotListenerService.initialize().catch((err) => {
      console.warn('[App] Error initializing screenshot listener:', err);
    });

    return () => {
      screenshotListenerService.destroy();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;
