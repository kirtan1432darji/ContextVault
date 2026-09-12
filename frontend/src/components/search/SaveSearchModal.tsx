import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { SavedSearchItem } from '../../models';

export interface SaveSearchModalProps {
  visible: boolean;
  query: string;
  existingItem?: SavedSearchItem | null;
  onClose: () => void;
  onSave: (query: string, title: string, iconName: string, colorHex: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const SAVED_SEARCH_ICONS = [
  { name: 'bookmark-outline', label: 'Bookmark' },
  { name: 'receipt-outline', label: 'Receipt' },
  { name: 'card-outline', label: 'Payment' },
  { name: 'pricetag-outline', label: 'Tag' },
  { name: 'code-slash-outline', label: 'Code' },
  { name: 'document-text-outline', label: 'Document' },
  { name: 'airplane-outline', label: 'Travel' },
  { name: 'cart-outline', label: 'Shop' },
  { name: 'star-outline', label: 'Star' },
  { name: 'flash-outline', label: 'Quick' },
  { name: 'images-outline', label: 'Photos' },
  { name: 'heart-outline', label: 'Favorite' },
];

export const SAVED_SEARCH_COLORS = [
  { hex: '#6366F1', label: 'Indigo' },
  { hex: '#3B82F6', label: 'Blue' },
  { hex: '#10B981', label: 'Emerald' },
  { hex: '#F59E0B', label: 'Amber' },
  { hex: '#EF4444', label: 'Rose' },
  { hex: '#8B5CF6', label: 'Purple' },
  { hex: '#EC4899', label: 'Pink' },
  { hex: '#06B6D4', label: 'Cyan' },
];

export const getSmartPresetForQuery = (rawQuery: string): { icon: string; color: string } => {
  const q = (rawQuery || '').toLowerCase();
  if (q.includes('doc') || q.includes('id') || q.includes('pdf') || q.includes('aadhaar') || q.includes('pan') || q.includes('passport')) {
    return { icon: 'document-text-outline', color: '#8B5CF6' };
  }
  if (q.includes('receipt') || q.includes('invoice') || q.includes('bill') || q.includes('tax')) {
    return { icon: 'receipt-outline', color: '#10B981' };
  }
  if (q.includes('upi') || q.includes('pay') || q.includes('bank') || q.includes('card') || q.includes('transfer')) {
    return { icon: 'card-outline', color: '#6366F1' };
  }
  if (q.includes('code') || q.includes('bug') || q.includes('flutter') || q.includes('react') || q.includes('error')) {
    return { icon: 'code-slash-outline', color: '#3B82F6' };
  }
  if (q.includes('flight') || q.includes('ticket') || q.includes('travel') || q.includes('hotel') || q.includes('trip')) {
    return { icon: 'airplane-outline', color: '#EC4899' };
  }
  if (q.includes('amazon') || q.includes('flipkart') || q.includes('shop') || q.includes('cart') || q.includes('order')) {
    return { icon: 'cart-outline', color: '#F59E0B' };
  }
  return { icon: 'bookmark-outline', color: '#6366F1' };
};

export const SaveSearchModal: React.FC<SaveSearchModalProps> = ({
  visible,
  query,
  existingItem,
  onClose,
  onSave,
  onDelete,
}) => {
  const theme = useAppTheme();

  const [title, setTitle] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('bookmark-outline');
  const [selectedColor, setSelectedColor] = useState('#6366F1');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (existingItem) {
        setTitle(existingItem.title || existingItem.query);
        setSelectedIcon(existingItem.iconName || 'bookmark-outline');
        setSelectedColor(existingItem.colorHex || '#6366F1');
      } else {
        const smart = getSmartPresetForQuery(query);
        const trimmed = (query || '').trim();
        const smartTitle = trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : '';
        setTitle(smartTitle);
        setSelectedIcon(smart.icon);
        setSelectedColor(smart.color);
      }
      setIsSaving(false);
    }
  }, [visible, query, existingItem]);

  const handleSave = async () => {
    const trimmedQuery = (query || (existingItem ? existingItem.query : '')).trim();
    if (!trimmedQuery) return;

    const finalTitle = title.trim() || trimmedQuery;
    setIsSaving(true);
    try {
      await onSave(trimmedQuery, finalTitle, selectedIcon, selectedColor);
      onClose();
    } catch (err) {
      console.warn('[SaveSearchModal] Failed to save search:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existingItem || !onDelete) return;

    Alert.alert(
      'Remove Saved Search',
      `Are you sure you want to remove "${existingItem.title || existingItem.query}" from your pinned searches?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(existingItem.id);
              onClose();
            } catch (err) {
              console.warn('[SaveSearchModal] Delete error:', err);
            }
          },
        },
      ]
    );
  };

  const displayQuery = query || existingItem?.query || '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleBox}>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                {existingItem ? 'Edit Saved Search' : 'Save & Pin Search'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                Customize title, icon, and color for quick 1-tap access
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* 1. Query Badge Preview */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                SEARCH QUERY
              </Text>
              <View
                style={[
                  styles.queryBadge,
                  {
                    backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC',
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Icon name="search-outline" size={15} color={theme.colors.primary} style={{ marginRight: 8 }} />
                <Text numberOfLines={1} style={[styles.queryBadgeText, { color: theme.colors.textPrimary }]}>
                  "{displayQuery}"
                </Text>
              </View>
            </View>

            {/* 2. Custom Title Input */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                CUSTOM TITLE
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: theme.colors.textPrimary,
                    backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC',
                    borderColor: theme.colors.border,
                  },
                ]}
                placeholder="e.g., Amazon Invoices, Bank Receipts"
                placeholderTextColor={theme.colors.textSecondary}
                value={title}
                onChangeText={setTitle}
                maxLength={40}
              />
            </View>

            {/* 3. Live Preview Chip */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                PIN PREVIEW
              </Text>
              <View style={styles.previewWrap}>
                <View
                  style={[
                    styles.previewChip,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: `${selectedColor}40`,
                      shadowColor: selectedColor,
                    },
                  ]}
                >
                  <View style={[styles.previewIconBox, { backgroundColor: `${selectedColor}20` }]}>
                    <Icon name={selectedIcon} size={15} color={selectedColor} />
                  </View>
                  <Text style={[styles.previewTitle, { color: theme.colors.textPrimary }]}>
                    {title.trim() || displayQuery || 'Saved Search'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 4. Select Accent Color */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                ACCENT COLOR
              </Text>
              <View style={styles.colorPaletteRow}>
                {SAVED_SEARCH_COLORS.map((c) => {
                  const isSelected = selectedColor === c.hex;
                  return (
                    <TouchableOpacity
                      key={c.hex}
                      onPress={() => setSelectedColor(c.hex)}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: c.hex },
                        isSelected && styles.colorSwatchSelected,
                      ]}
                      activeOpacity={0.8}
                      accessibilityLabel={c.label}
                    >
                      {isSelected && <Icon name="checkmark" size={14} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 5. Select Icon */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                CHOOSE ICON
              </Text>
              <View style={styles.iconGrid}>
                {SAVED_SEARCH_ICONS.map((item) => {
                  const isSelected = selectedIcon === item.name;
                  return (
                    <TouchableOpacity
                      key={item.name}
                      onPress={() => setSelectedIcon(item.name)}
                      style={[
                        styles.iconCell,
                        {
                          backgroundColor: isSelected
                            ? `${selectedColor}18`
                            : theme.isDark
                            ? '#1E293B'
                            : '#F8FAFC',
                          borderColor: isSelected ? selectedColor : theme.colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Icon
                        name={item.name}
                        size={20}
                        color={isSelected ? selectedColor : theme.colors.textSecondary}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.iconLabel,
                          {
                            color: isSelected ? selectedColor : theme.colors.textSecondary,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            {existingItem && onDelete && (
              <TouchableOpacity
                onPress={handleDelete}
                style={[styles.deleteBtn, { borderColor: `${theme.colors.error}40` }]}
                activeOpacity={0.8}
              >
                <Icon name="trash-outline" size={18} color={theme.colors.error} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.cancelBtn,
                {
                  backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9',
                  borderColor: theme.colors.border,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelBtnText, { color: theme.colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={[
                styles.saveBtn,
                { backgroundColor: selectedColor },
                isSaving && { opacity: 0.6 },
              ]}
              activeOpacity={0.8}
            >
              <Icon
                name={existingItem ? 'checkmark-circle-outline' : 'bookmark'}
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.saveBtnText}>
                {existingItem ? 'Update Search' : 'Save Search'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 18,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerTitleBox: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  queryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  queryBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  textInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  previewWrap: {
    flexDirection: 'row',
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  previewIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconCell: {
    width: '22%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconLabel: {
    fontSize: 10,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF444415',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
