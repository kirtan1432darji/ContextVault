import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppTheme } from './src/theme';
import { useSettingsStore } from './src/store/settings.store';
import { screenshotListenerService } from './src/services/ScreenshotListenerService';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { performanceAuditService } from './src/services/performanceAuditService';
import { AuthProvider } from './src/context/AuthContext';
import { DeveloperModeBanner } from './src/components/DeveloperModeBanner';

export const App: React.FC = () => {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const theme = useAppTheme(themeMode);

  useEffect(() => {
    // Benchmark cold start completion
    performanceAuditService.initColdStart();

    // Automatically initialize screenshot detection engine on app launch
    screenshotListenerService.initialize().catch((err) => {
      console.warn('[App] Error initializing screenshot listener:', err);
    });

    return () => {
      screenshotListenerService.destroy();
    };
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar
            barStyle={theme.isDark ? 'light-content' : 'dark-content'}
            backgroundColor={theme.colors.background}
          />
          <DeveloperModeBanner />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

export default App;
