import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useScreenshotStore } from '../store/screenshot.store';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { EmptyStateView } from '../components/EmptyStateView';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

export const FavoritesScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const favorites = useScreenshotStore((s) => s.favorites);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Favorites
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {favorites.length} starred screenshots
        </Text>
      </View>

      {favorites.length === 0 ? (
        <EmptyStateView
          iconName="heart-outline"
          title="No Favorites Yet"
          description="Star your essential receipts, documents, and reference shots for quick access."
        />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('ScreenshotDetail', { id: item.id })}
              style={[styles.gridItem, { width: COLUMN_WIDTH }]}
            >
              <ScreenshotImageThumbnail
                filePath={item.filePath}
                deviceAssetId={item.deviceAssetId}
                style={styles.gridThumb}
              />
              <View style={styles.metaRow}>
                <Text numberOfLines={1} style={[styles.titleText, { color: theme.colors.textPrimary }]}>
                  {item.categoryName}
                </Text>
                <ConfidenceBadge confidence={item.confidence} showPercent={false} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  gridItem: {
    margin: 8,
  },
  gridThumb: {
    width: '100%',
    height: 200,
    borderRadius: 10,
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginRight: 4,
  },
});
