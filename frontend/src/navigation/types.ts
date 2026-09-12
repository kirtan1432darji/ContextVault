import { NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type MainTabParamList = {
  Home: undefined;
  Folders: undefined;
  Search: undefined;
  Favorites: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  FolderDetail: {
    categoryId: string;
    categoryName: string;
  };
  FolderContext: {
    categoryId: string;
    categoryName: string;
  };
  ContextAIChat: {
    categoryId?: string;
    categoryName?: string;
    screenshotId?: string;
  };
  ScreenshotDetail: {
    id: string;
  };
  GlobalAISearch:
    | {
        initialQuery?: string;
        autoFocus?: boolean;
      }
    | undefined;
  PrivacyPolicy: undefined;
  ScannerStatus: undefined;
  Storage: undefined;
  QADebugPanel: undefined;
  NotificationCenter: undefined;
  RecycleBin: undefined;
  FolderAnalytics:
    | {
        categoryId?: string;
        categoryName?: string;
      }
    | undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
