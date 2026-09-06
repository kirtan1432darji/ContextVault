import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useScreenshotStore } from '../store/screenshot.store';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { EmptyStateView } from '../components/EmptyStateView';

type Props = NativeStackScreenProps<RootStackParamList, 'FolderDetail'>;

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

export const FolderDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId, categoryName } = route.params;
  const theme = useAppTheme();
  const allScreenshots = useScreenshotStore((s) => s.screenshots);

  const folderScreenshots = allScreenshots.filter((s) => s.categoryId === categoryId);
  const [selectedSubcat, setSelectedSubcat] = useState<string>('all');

  // Derive subcategories
  const subcategories = Array.from(
    new Set(
      folderScreenshots
        .map((s) => s.subcategory)
        .filter((sub) => sub && sub.trim().length > 0)
    )
  );

  const displayedScreenshots =
    selectedSubcat === 'all'
      ? folderScreenshots
      : folderScreenshots.filter((s) => s.subcategory === selectedSubcat);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
        >
          <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.textPrimary }]}>
            {categoryName}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {folderScreenshots.length} items
          </Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('FolderContext', { categoryId, categoryName })
          }
          style={[styles.aiContextBtn, { backgroundColor: `${theme.colors.primary}20` }]}
        >
          <Icon name="sparkles" size={18} color={theme.colors.primary} />
          <Text style={[styles.aiBtnText, { color: theme.colors.primary }]}>AI Context</Text>
        </TouchableOpacity>
      </View>

      {/* Subcategory Filter Chips */}
      {subcategories.length > 0 && (
        <View style={styles.chipsContainer}>
          <TouchableOpacity
            onPress={() => setSelectedSubcat('all')}
            style={[
              styles.chip,
              selectedSubcat === 'all'
                ? { backgroundColor: theme.colors.primary }
                : { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: selectedSubcat === 'all' ? '#FFFFFF' : theme.colors.textSecondary },
              ]}
            >
              All ({folderScreenshots.length})
            </Text>
          </TouchableOpacity>
          {subcategories.map((sub) => {
            const count = folderScreenshots.filter((s) => s.subcategory === sub).length;
            const isSelected = selectedSubcat === sub;
            return (
              <TouchableOpacity
                key={sub}
                onPress={() => setSelectedSubcat(sub)}
                style={[
                  styles.chip,
                  isSelected
                    ? { backgroundColor: theme.colors.primary }
                    : { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: isSelected ? '#FFFFFF' : theme.colors.textSecondary },
                  ]}
                >
                  {sub} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Grid of Screenshots */}
      {displayedScreenshots.length === 0 ? (
        <EmptyStateView
          iconName="images-outline"
          title="No Screenshots in Folder"
          description={`Screenshots categorized as "${categoryName}" will automatically appear here.`}
        />
      ) : (
        <FlatList
          data={displayedScreenshots}
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
                style={styles.gridThumb}
              />
              <View style={styles.itemMeta}>
                <Text numberOfLines={1} style={[styles.itemName, { color: theme.colors.textPrimary }]}>
                  {item.fileName}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleBox: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
  },
  aiContextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  aiBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  chipsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
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
    borderRadius: 14,
  },
  itemMeta: {
    marginTop: 6,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
});
