import React, { useEffect, useMemo } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useAppTheme, getNavigationTheme } from './src/theme';
import { screenshotListenerService } from './src/services/ScreenshotListenerService';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { performanceAuditService } from './src/services/performanceAuditService';
import { crashReportingService } from './src/services/crashReportingService';
import { AuthProvider } from './src/context/AuthContext';
import { DeveloperModeBanner } from './src/components/DeveloperModeBanner';

const MainAppContent: React.FC = () => {
  const theme = useAppTheme();
  const navigationTheme = useMemo(() => getNavigationTheme(theme), [theme]);

  return (
    <>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        animated={true}
      />
      <DeveloperModeBanner />
      <NavigationContainer theme={navigationTheme}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
};

export const App: React.FC = () => {
  useEffect(() => {
    // Initialize crash reporting (active in production release builds)
    crashReportingService.init();

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
        <ThemeProvider>
          <AuthProvider>
            <MainAppContent />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

export default App;
