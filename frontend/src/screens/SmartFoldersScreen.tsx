import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useCategoryStore } from '../store/category.store';
import { CategoryModel } from '../models';

export const SmartFoldersScreen: React.FC = () => {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const categories = useCategoryStore((s) => s.categories);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFolderItem = ({ item }: { item: CategoryModel }) => {
    const hex = item.colorHex.startsWith('#') ? item.colorHex : `#${item.colorHex}`;
    return (
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('FolderDetail', {
            categoryId: item.id,
            categoryName: item.name,
          })
        }
        style={[
          styles.folderTile,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={[styles.iconBox, { backgroundColor: `${hex}20` }]}>
          <Icon name={item.iconName || 'folder'} size={24} color={hex} />
        </View>
        <View style={styles.tileContent}>
          <Text style={[styles.tileName, { color: theme.colors.textPrimary }]}>
            {item.name}
          </Text>
          <Text style={[styles.tileDesc, { color: theme.colors.textSecondary }]}>
            {item.description || `${item.screenshotCount || 0} screenshots`}
          </Text>
        </View>
        <View style={styles.tileMeta}>
          <Text style={[styles.countBadge, { color: theme.colors.primary }]}>
            {item.screenshotCount || 0}
          </Text>
          <Icon name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Smart Folders
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Hierarchical, auto-categorized knowledge collections
        </Text>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Icon name="search-outline" size={18} color={theme.colors.textMuted} />
          <TextInput
            placeholder="Search folders..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderFolderItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  folderTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  tileContent: {
    flex: 1,
  },
  tileName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  tileDesc: {
    fontSize: 12,
  },
  tileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 6,
  },
});
