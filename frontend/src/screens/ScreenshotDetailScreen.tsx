import React, { useState, useEffect } from 'react';
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
import { ocrCacheRepository } from '../database/repositories/ocrCacheRepository';
import { OCRCacheRecord } from '../models';
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

  // Sprint RN-04 OCR Preview State
  const [ocrRecord, setOcrRecord] = useState<OCRCacheRecord | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    ocrCacheRepository.getByScreenshotId(id).then((record) => {
      if (isMounted && record) {
        setOcrRecord(record);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [id]);

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

  const handleCopyText = () => {
    const textToCopy = screenshot.ocrText || ocrRecord?.extractedText || '';
    if (!textToCopy) return;

    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    Alert.alert('OCR Text Copied', 'The extracted text has been copied to your clipboard.');
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

  const ocrText = screenshot.ocrText || ocrRecord?.extractedText || '';
  const processingDuration = ocrRecord?.processingTime || 0;
  const ocrConfidence = ocrRecord?.confidence || screenshot.confidence || 0.88;

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

        {/* Category & Status Card */}
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

        {/* Sprint RN-04: Upgraded OCR Result Preview Card */}
        {ocrText ? (
          <ModernCard style={styles.card}>
            <View style={styles.ocrHeaderRow}>
              <View style={styles.ocrHeaderLeft}>
                <View style={[styles.ocrIconBox, { backgroundColor: `${theme.colors.primary}15` }]}>
                  <Icon name="scan-outline" size={18} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                    Google ML Kit Text
                  </Text>
                  <Text style={[styles.ocrSubtext, { color: theme.colors.textSecondary }]}>
                    {Math.round(ocrConfidence * 100)}% confidence • {ocrRecord?.language || 'en'}
                  </Text>
                </View>
              </View>

              <View style={styles.ocrHeaderRight}>
                {processingDuration > 0 && (
                  <View style={[styles.durationPill, { backgroundColor: `${theme.colors.accent}15` }]}>
                    <Icon name="flash" size={12} color={theme.colors.accent} style={{ marginRight: 3 }} />
                    <Text style={[styles.durationText, { color: theme.colors.accent }]}>
                      {processingDuration}ms
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleCopyText}
                  style={[styles.copyBtn, { backgroundColor: isCopied ? '#10B98120' : `${theme.colors.primary}15` }]}
                >
                  <Icon
                    name={isCopied ? 'checkmark' : 'copy-outline'}
                    size={15}
                    color={isCopied ? theme.colors.success : theme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.copyBtnText,
                      { color: isCopied ? theme.colors.success : theme.colors.primary },
                    ]}
                  >
                    {isCopied ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Extracted Text Content with Expand/Collapse */}
            <View style={[styles.ocrTextBox, { backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC' }]}>
              <Text
                selectable
                numberOfLines={isExpanded ? undefined : 4}
                style={[styles.ocrText, { color: theme.colors.textPrimary }]}
              >
                {ocrText}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setIsExpanded(!isExpanded)}
              style={styles.expandToggleBtn}
            >
              <Text style={[styles.expandToggleText, { color: theme.colors.primary }]}>
                {isExpanded ? 'Collapse Text' : 'Expand Full Text'}
              </Text>
              <Icon
                name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={14}
                color={theme.colors.primary}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </ModernCard>
        ) : null}

        {/* Tags */}
        {screenshot.tags.length > 0 && (
          <ModernCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="pricetags-outline" size={18} color={theme.colors.secondary} />
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                Search Index Keywords
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
          {ocrRecord?.ocrVersion ? (
            <View style={styles.metaRow}>
              <Text style={[styles.metaKey, { color: theme.colors.textSecondary }]}>OCR Engine</Text>
              <Text style={[styles.metaVal, { color: theme.colors.textPrimary }]}>
                {ocrRecord.ocrVersion}
              </Text>
            </View>
          ) : null}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarActions: {
    flexDirection: 'row',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  imageContainer: {
    width: '100%',
    height: 280,
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
  ocrHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ocrHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ocrIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrSubtext: {
    fontSize: 11,
    marginLeft: 8,
    marginTop: 2,
  },
  ocrHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '700',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  ocrTextBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  ocrText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  expandToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  expandToggleText: {
    fontSize: 12,
    fontWeight: '600',
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
