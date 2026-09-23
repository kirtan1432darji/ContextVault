import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { StorageService, StorageKeys } from '../utils/storage';
import { useAuthStore } from '../store/auth.store';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

interface OnboardingSlide {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  badge1: string;
  badge2: string;
  badge3: string;
}

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'shield-checkmark-outline',
    iconColor: '#1E8E3E',
    title: 'Non-Destructive Privacy',
    subtitle:
      'Zero binary uploads. Your original photos never leave your device and are never modified, deleted, or compressed.',
    badge1: '100% On-Device OCR',
    badge2: 'Originals Untouched',
    badge3: 'Zero Cloud Storage',
  },
  {
    id: '2',
    icon: 'folder-open-outline',
    iconColor: '#1A73E8',
    title: 'Smart Hierarchical Folders',
    subtitle:
      'Receipts, Invoices, Bank Statements, Project Specs, and Shopping items are auto-filed with multi-tier taxonomic intelligence.',
    badge1: 'Instant Auto-Tagging',
    badge2: 'Financial Heuristics',
    badge3: 'Multi-Facet Search',
  },
  {
    id: '3',
    icon: 'sparkles-outline',
    iconColor: '#0284C7',
    title: 'Context AI Assistant',
    subtitle:
      'Ask questions across your entire screenshot history, extract payment details, tasks, and executive summaries on demand.',
    badge1: 'Interactive Chat',
    badge2: 'Action Item Detection',
    badge3: 'Full Offline Cache',
  },
];

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleFinishOnboarding = () => {
    StorageService.setBoolean(StorageKeys.IS_ONBOARDED, true);
    navigation.replace('Login');
  };

  const handleLoginAsGuest = () => {
    StorageService.setBoolean(StorageKeys.IS_ONBOARDED, true);
    useAuthStore.getState().loginAsGuest();
    navigation.replace('MainTabs', { screen: 'Home' });
  };

  const handleNext = () => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinishOnboarding();
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollOffset / width);
    if (index !== currentIndex && index >= 0 && index < ONBOARDING_SLIDES.length) {
      setCurrentIndex(index);
    }
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={[styles.slide, { width }]}>
      <View style={[styles.iconCircle, { backgroundColor: `${item.iconColor}18` }]}>
        <Icon name={item.icon} size={64} color={item.iconColor} />
      </View>

      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{item.title}</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{item.subtitle}</Text>

      <View style={styles.badgeContainer}>
        {[item.badge1, item.badge2, item.badge3].map((badge, idx) => (
          <View
            key={idx}
            style={[
              styles.badge,
              {
                backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9',
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Icon name="checkmark-circle" size={14} color={item.iconColor} style={{ marginRight: 6 }} />
            <Text style={[styles.badgeText, { color: theme.colors.textPrimary }]}>{badge}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Icon name="scan" size={22} color={theme.colors.primary} />
          <Text style={[styles.brandTitle, { color: theme.colors.textPrimary }]}>ContextVault</Text>
        </View>

        <TouchableOpacity onPress={handleFinishOnboarding} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        bounces={false}
      />

      <View style={styles.bottomBar}>
        <View style={styles.dotsRow}>
          {ONBOARDING_SLIDES.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    idx === currentIndex ? theme.colors.primary : theme.colors.border,
                  width: idx === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {currentIndex === ONBOARDING_SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
          <Icon
            name={currentIndex === ONBOARDING_SLIDES.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={18}
            color="#FFFFFF"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.guestLink}
          onPress={handleLoginAsGuest}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Login as a Guest"
        >
          <Text style={[styles.guestLinkText, { color: theme.colors.textSecondary }]}>
            or <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Login as a Guest</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 8,
    letterSpacing: -0.3,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  slide: {
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  badgeContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    width: '100%',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  guestLink: {
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  guestLinkText: {
    fontSize: 14,
  },
});
