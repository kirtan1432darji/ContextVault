import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { SearchFilterState, SearchDateRange } from '../../models';
import { useCategoryStore } from '../../store/category.store';

interface SearchFilterBarProps {
  filters: SearchFilterState;
  onChangeFilter: (patch: Partial<SearchFilterState>) => void;
  onResetFilters: () => void;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  filters,
  onChangeFilter,
  onResetFilters,
}) => {
  const theme = useAppTheme();
  const categories = useCategoryStore((s) => s.categories);

  const [activeModal, setActiveModal] = useState<'folder' | 'date' | 'app' | null>(null);

  const hasActiveFilters =
    (filters.folderId && filters.folderId !== 'all') ||
    (filters.dateRange && filters.dateRange !== 'all') ||
    (filters.sourceApp && filters.sourceApp !== 'all') ||
    filters.onlyFavorites ||
    filters.onlyNeedsReview;

  const getFolderLabel = () => {
    if (!filters.folderId || filters.folderId === 'all') return 'Folder';
    const cat = categories.find((c) => c.id === filters.folderId);
    return cat ? cat.name : 'Folder';
  };

  const getDateLabel = () => {
    switch (filters.dateRange) {
      case 'today':
        return 'Today';
      case '7days':
        return 'Last 7 Days';
      case '30days':
        return 'This Month';
      default:
        return 'Date Range';
    }
  };

  const getAppLabel = () => {
    if (!filters.sourceApp || filters.sourceApp === 'all') return 'App Source';
    return filters.sourceApp;
  };

  const APP_OPTIONS = [
    'all',
    'Amazon',
    'Google Pay',
    'PhonePe',
    'Paytm',
    'WhatsApp',
    'Telegram',
    'Swiggy',
    'Zomato',
    'Chrome',
    'GitHub',
    'NHDC',
  ];

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Reset Filters Chip */}
        {hasActiveFilters && (
          <TouchableOpacity
            onPress={onResetFilters}
            style={[styles.chip, { backgroundColor: `${theme.colors.error}20`, borderColor: theme.colors.error }]}
          >
            <Icon name="close-circle" size={14} color={theme.colors.error} style={{ marginRight: 4 }} />
            <Text style={[styles.chipText, { color: theme.colors.error, fontWeight: '700' }]}>Reset</Text>
          </TouchableOpacity>
        )}

        {/* 1. Folder Dropdown Chip */}
        <TouchableOpacity
          onPress={() => setActiveModal('folder')}
          style={[
            styles.chip,
            filters.folderId && filters.folderId !== 'all'
              ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
              : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Icon
            name="folder-outline"
            size={13}
            color={filters.folderId && filters.folderId !== 'all' ? '#FFFFFF' : theme.colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.chipText,
              {
                color:
                  filters.folderId && filters.folderId !== 'all' ? '#FFFFFF' : theme.colors.textPrimary,
              },
            ]}
          >
            {getFolderLabel()}
          </Text>
          <Icon
            name="chevron-down"
            size={12}
            color={filters.folderId && filters.folderId !== 'all' ? '#FFFFFF' : theme.colors.textSecondary}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>

        {/* 2. Date Range Chip */}
        <TouchableOpacity
          onPress={() => setActiveModal('date')}
          style={[
            styles.chip,
            filters.dateRange && filters.dateRange !== 'all'
              ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
              : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Icon
            name="calendar-outline"
            size={13}
            color={filters.dateRange && filters.dateRange !== 'all' ? '#FFFFFF' : theme.colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.chipText,
              {
                color:
                  filters.dateRange && filters.dateRange !== 'all' ? '#FFFFFF' : theme.colors.textPrimary,
              },
            ]}
          >
            {getDateLabel()}
          </Text>
          <Icon
            name="chevron-down"
            size={12}
            color={filters.dateRange && filters.dateRange !== 'all' ? '#FFFFFF' : theme.colors.textSecondary}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>

        {/* 3. App Source Chip */}
        <TouchableOpacity
          onPress={() => setActiveModal('app')}
          style={[
            styles.chip,
            filters.sourceApp && filters.sourceApp !== 'all'
              ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
              : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Icon
            name="apps-outline"
            size={13}
            color={filters.sourceApp && filters.sourceApp !== 'all' ? '#FFFFFF' : theme.colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.chipText,
              {
                color:
                  filters.sourceApp && filters.sourceApp !== 'all' ? '#FFFFFF' : theme.colors.textPrimary,
              },
            ]}
          >
            {getAppLabel()}
          </Text>
          <Icon
            name="chevron-down"
            size={12}
            color={filters.sourceApp && filters.sourceApp !== 'all' ? '#FFFFFF' : theme.colors.textSecondary}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>

        {/* 4. Favorites Only Toggle Chip */}
        <TouchableOpacity
          onPress={() => onChangeFilter({ onlyFavorites: !filters.onlyFavorites })}
          style={[
            styles.chip,
            filters.onlyFavorites
              ? { backgroundColor: '#EF4444', borderColor: '#EF4444' }
              : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Icon
            name={filters.onlyFavorites ? 'heart' : 'heart-outline'}
            size={13}
            color={filters.onlyFavorites ? '#FFFFFF' : theme.colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.chipText,
              { color: filters.onlyFavorites ? '#FFFFFF' : theme.colors.textPrimary },
            ]}
          >
            Favorites
          </Text>
        </TouchableOpacity>

        {/* 5. Needs Review Toggle Chip */}
        <TouchableOpacity
          onPress={() => onChangeFilter({ onlyNeedsReview: !filters.onlyNeedsReview })}
          style={[
            styles.chip,
            filters.onlyNeedsReview
              ? { backgroundColor: theme.colors.warning, borderColor: theme.colors.warning }
              : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Icon
            name="alert-circle-outline"
            size={13}
            color={filters.onlyNeedsReview ? '#FFFFFF' : theme.colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.chipText,
              { color: filters.onlyNeedsReview ? '#FFFFFF' : theme.colors.textPrimary },
            ]}
          >
            Needs Review
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Pickers */}
      <Modal visible={activeModal !== null} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActiveModal(null)}
        >
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              {activeModal === 'folder'
                ? 'Filter by Smart Folder'
                : activeModal === 'date'
                ? 'Filter by Date Range'
                : 'Filter by Source App'}
            </Text>

            {/* Folder Selection */}
            {activeModal === 'folder' && (
              <ScrollView style={{ maxHeight: 320 }}>
                <TouchableOpacity
                  onPress={() => {
                    onChangeFilter({ folderId: 'all' });
                    setActiveModal(null);
                  }}
                  style={[styles.modalOption, (!filters.folderId || filters.folderId === 'all') && styles.modalOptionSelected]}
                >
                  <Text style={[styles.modalOptionText, { color: theme.colors.textPrimary }]}>All Folders</Text>
                  {(!filters.folderId || filters.folderId === 'all') && (
                    <Icon name="checkmark" size={16} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => {
                      onChangeFilter({ folderId: cat.id });
                      setActiveModal(null);
                    }}
                    style={[styles.modalOption, filters.folderId === cat.id && styles.modalOptionSelected]}
                  >
                    <Text style={[styles.modalOptionText, { color: theme.colors.textPrimary }]}>{cat.name}</Text>
                    {filters.folderId === cat.id && (
                      <Icon name="checkmark" size={16} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Date Selection */}
            {activeModal === 'date' && (
              <View>
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'today', label: 'Today' },
                  { key: '7days', label: 'Last 7 Days' },
                  { key: '30days', label: 'This Month' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => {
                      onChangeFilter({ dateRange: opt.key as SearchDateRange });
                      setActiveModal(null);
                    }}
                    style={[styles.modalOption, filters.dateRange === opt.key && styles.modalOptionSelected]}
                  >
                    <Text style={[styles.modalOptionText, { color: theme.colors.textPrimary }]}>
                      {opt.label}
                    </Text>
                    {filters.dateRange === opt.key && (
                      <Icon name="checkmark" size={16} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* App Selection */}
            {activeModal === 'app' && (
              <ScrollView style={{ maxHeight: 320 }}>
                {APP_OPTIONS.map((app) => (
                  <TouchableOpacity
                    key={app}
                    onPress={() => {
                      onChangeFilter({ sourceApp: app });
                      setActiveModal(null);
                    }}
                    style={[styles.modalOption, filters.sourceApp === app && styles.modalOptionSelected]}
                  >
                    <Text style={[styles.modalOptionText, { color: theme.colors.textPrimary }]}>
                      {app === 'all' ? 'All Apps' : app}
                    </Text>
                    {filters.sourceApp === app && (
                      <Icon name="checkmark" size={16} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
