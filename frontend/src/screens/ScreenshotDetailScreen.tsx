import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useScreenshotStore } from '../store/screenshot.store';
import { useCategoryStore } from '../store/category.store';
import { screenshotService } from '../services/screenshotService';
import { classificationService } from '../services/classificationService';
import { ModernCard } from '../components/ModernCard';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { TagChip } from '../components/TagChip';
import { DateFormatter } from '../utils/dateFormatter';
import { FileUtils } from '../utils/fileUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'ScreenshotDetail'>;

export const ScreenshotDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const theme = useAppTheme();

  const screenshot = useScreenshotStore((s) => s.screenshots.find((item) => item.id === id));
  const categories = useCategoryStore((s) => s.categories);
  const [isReclassifying, setIsReclassifying] = useState(false);

  if (!screenshot) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textPrimary }}>Screenshot not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
          <Text style={{ color: theme.colors.primary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleToggleFavorite = async () => {
    useScreenshotStore.getState().toggleFavoriteLocal(id);
    await screenshotService.toggleFavorite(id);
  };

  const handleReclassify = async () => {
    setIsReclassifying(true);
    const res = await classificationService.classifyScreenshot({
      screenshotId: id,
      fileName: screenshot.fileName,
      filePath: screenshot.filePath,
      ocrText: screenshot.ocrText || '',
    });

    if (res.isSuccess && res.data) {
      useScreenshotStore.getState().updateCategoryLocal(
        id,
        res.data.categoryId,
        res.data.categoryName,
        res.data.subcategory
      );
      Alert.alert('Reclassified', `Filed into ${res.data.categoryName} (${res.data.subcategory})`);
    }
    setIsReclassifying(false);
  };

  const uri = screenshot.filePath.startsWith('http') || screenshot.filePath.startsWith('file://')
    ? screenshot.filePath
    : `file://${screenshot.filePath}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.actionBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
        >
          <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            onPress={handleToggleFavorite}
            style={[styles.actionBtn, { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' }]}
          >
            <Icon
              name={screenshot.isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={screenshot.isFavorite ? theme.colors.error : theme.colors.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('ContextAIChat', { screenshotId: id })}
            style={[styles.actionBtn, { backgroundColor: `${theme.colors.primary}20`, marginLeft: 8 }]}
          >
            <Icon name="sparkles" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Preview Image */}
        <View style={[styles.imageContainer, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        </View>

        {/* Category & Confidence Card */}
        <ModernCard style={styles.card}>
          <View style={styles.categoryRow}>
            <View>
              <Text style={[styles.categoryName, { color: theme.colors.textPrimary }]}>
                {screenshot.categoryName}
              </Text>
              {screenshot.subcategory ? (
                <Text style={[styles.subcategoryName, { color: theme.colors.textSecondary }]}>
                  {screenshot.subcategory}
                </Text>
              ) : null}
            </View>
            <ConfidenceBadge confidence={screenshot.confidence} />
          </View>

          <TouchableOpacity
            onPress={handleReclassify}
            disabled={isReclassifying}
            style={[styles.reclassifyBtn, { borderColor: theme.colors.primary }]}
          >
            <Icon name="sync-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.reclassifyText, { color: theme.colors.primary }]}>
              {isReclassifying ? 'Reclassifying...' : 'Re-analyze with AI'}
            </Text>
          </TouchableOpacity>
        </ModernCard>

        {/* OCR Text Card */}
        {screenshot.ocrText ? (
          <ModernCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="text-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                Recognized OCR Text
              </Text>
            </View>
            <Text
              selectable
              style={[styles.ocrText, { color: theme.colors.textPrimary }]}
            >
              {screenshot.ocrText}
            </Text>
          </ModernCard>
        ) : null}

        {/* Tags */}
        {screenshot.tags.length > 0 && (
          <ModernCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="pricetags-outline" size={18} color={theme.colors.secondary} />
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                Assigned Tags
              </Text>
            </View>
            <View style={styles.tagsWrap}>
              {screenshot.tags.map((t) => (
                <TagChip key={t.id} label={t.name} colorHex={t.colorHex} />
              ))}
            </View>
          </ModernCard>
        )}

        {/* Metadata Panel */}
        <ModernCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="information-circle-outline" size={18} color={theme.colors.textMuted} />
            <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
              File Information
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaKey, { color: theme.colors.textSecondary }]}>File Name</Text>
            <Text style={[styles.metaVal, { color: theme.colors.textPrimary }]}>{screenshot.fileName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaKey, { color: theme.colors.textSecondary }]}>Dimensions</Text>
            <Text style={[styles.metaVal, { color: theme.colors.textPrimary }]}>
              {screenshot.width} × {screenshot.height}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaKey, { color: theme.colors.textSecondary }]}>File Size</Text>
            <Text style={[styles.metaVal, { color: theme.colors.textPrimary }]}>
              {FileUtils.formatBytes(screenshot.fileSize)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaKey, { color: theme.colors.textSecondary }]}>Captured</Text>
            <Text style={[styles.metaVal, { color: theme.colors.textPrimary }]}>
              {DateFormatter.formatFullDateTime(screenshot.createdAt)}
            </Text>
          </View>
        </ModernCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  imageContainer: {
    height: 340,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  card: {
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '700',
  },
  subcategoryName: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  reclassifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  reclassifyText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  ocrText: {
    fontSize: 13,
    lineHeight: 20,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  metaKey: {
    fontSize: 13,
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '600',
  },
});
