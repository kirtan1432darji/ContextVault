import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../theme';
import { ScreenshotModel, CategoryModel } from '../models';
import { useCategoryStore } from '../store/category.store';
import { smartFolderService } from '../services/SmartFolderService';
import { TagChip } from './TagChip';

interface ReclassifyModalProps {
  visible: boolean;
  screenshot: ScreenshotModel;
  onClose: () => void;
  onReclassified?: (updated: ScreenshotModel) => void;
}

export const ReclassifyModal: React.FC<ReclassifyModalProps> = ({
  visible,
  screenshot,
  onClose,
  onReclassified,
}) => {
  const theme = useAppTheme();
  const categories = useCategoryStore((s) => s.categories);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(screenshot.categoryId);
  const [subcategory, setSubcategory] = useState<string>(screenshot.subcategory || '');
  const [tags, setTags] = useState<string[]>(
    screenshot.keywords && screenshot.keywords.length > 0
      ? [...screenshot.keywords]
      : screenshot.tags?.map((t) => t.name) || []
  );
  const [tagInput, setTagInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state whenever modal opens or screenshot changes
  useEffect(() => {
    if (visible && screenshot) {
      setSelectedCategoryId(screenshot.categoryId);
      setSubcategory(screenshot.subcategory || '');
      setTags(
        screenshot.keywords && screenshot.keywords.length > 0
          ? [...screenshot.keywords]
          : screenshot.tags?.map((t) => t.name) || []
      );
      setTagInput('');
      setIsSubmitting(false);
    }
  }, [visible, screenshot]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (!trimmed) return;
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTagInput('');
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleSave = async () => {
    if (!selectedCategoryId) {
      Alert.alert('Category Required', 'Please select a destination category.');
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await smartFolderService.reclassifyScreenshot({
        screenshotId: screenshot.id,
        targetCategoryId: selectedCategoryId,
        targetSubcategory: subcategory.trim(),
        tags,
      });

      if (updated) {
        if (onReclassified) {
          onReclassified(updated);
        }
        onClose();
        Alert.alert(
          'Reclassification Saved',
          `Screenshot moved to ${updated.categoryName} › ${updated.subcategory || 'General'} and flagged as manually verified.`
        );
      } else {
        Alert.alert('Error', 'Failed to update classification. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update classification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
                <Icon name="color-wand-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                  Manual Reclassification
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                  Override AI categorization and tags
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Icon name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Section 1: Choose Smart Category */}
            <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
              1. Select Smart Category
            </Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat: CategoryModel) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategoryId(cat.id)}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: isSelected
                          ? `${theme.colors.primary}18`
                          : theme.isDark
                          ? '#1F2937'
                          : '#F3F4F6',
                        borderColor: isSelected ? theme.colors.primary : 'transparent',
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Icon
                      name={isSelected ? 'checkmark-circle' : cat.iconName || 'folder-outline'}
                      size={18}
                      color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.categoryCardText,
                        {
                          color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Section 2: Subcategory / Subfolder */}
            <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary, marginTop: 16 }]}>
              2. Subcategory / Specific Topic
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                },
              ]}
              value={subcategory}
              onChangeText={setSubcategory}
              placeholder="e.g. Invoices, Receipts, Health, Taxes..."
              placeholderTextColor={theme.colors.textMuted}
            />

            {/* Section 3: Semantic Tags */}
            <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary, marginTop: 16 }]}>
              3. Keywords & Context Tags
            </Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={[
                  styles.tagInput,
                  {
                    backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                    color: theme.colors.textPrimary,
                    borderColor: theme.colors.border,
                  },
                ]}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add custom keyword or tag..."
                placeholderTextColor={theme.colors.textMuted}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={handleAddTag}
                style={[styles.addTagBtn, { backgroundColor: theme.colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Add Tag"
              >
                <Icon name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.tagsContainer}>
              {tags.map((tag, idx) => (
                <View key={`${tag}-${idx}`} style={styles.tagWrapper}>
                  <TagChip
                    label={tag}
                    colorHex={theme.colors.primary}
                    onRemove={() => handleRemoveTag(tag)}
                  />
                </View>
              ))}
              {tags.length === 0 && (
                <Text style={[styles.emptyTagsText, { color: theme.colors.textMuted }]}>
                  No tags added yet. Add tags above to enhance search index.
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              style={[styles.cancelBtn, { borderColor: theme.colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.cancelBtnText, { color: theme.colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={isSubmitting || !selectedCategoryId}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: isSubmitting || !selectedCategoryId ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save Reclassification"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>Apply Override</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    maxHeight: 450,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  categoryCardText: {
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  addTagBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  tagWrapper: {
    marginBottom: 4,
  },
  emptyTagsText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
