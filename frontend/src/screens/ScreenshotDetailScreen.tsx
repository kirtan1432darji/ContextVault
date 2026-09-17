import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useScreenshotStore } from '../store/screenshot.store';
import { screenshotService } from '../services/screenshotService';
import { contextSyncService } from '../services/ContextSyncService';
import { ocrCacheRepository } from '../database/repositories/ocrCacheRepository';
import { classificationCacheRepository } from '../database/repositories/classificationCacheRepository';
import { OCRCacheRecord, ClassificationCacheRecord, ExtractedEntitiesDto } from '../models';
import { visionRepository } from '../database/repositories/VisionRepository';
import { visionAIService } from '../services/visionAIService';
import { VisionCacheRecord } from '../vision/types';
import { ModernCard } from '../components/ModernCard';
import { TagChip } from '../components/TagChip';
import { ReclassifyModal } from '../components/ReclassifyModal';
import { DateFormatter } from '../utils/dateFormatter';
import { FileUtils } from '../utils/fileUtils';
import { MediaStorePathResolver } from '../utils/MediaStorePathResolver';

type Props = NativeStackScreenProps<RootStackParamList, 'ScreenshotDetail'>;

export const ScreenshotDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const theme = useAppTheme();

  const screenshot = useScreenshotStore((s) => s.screenshots.find((item) => item.id === id));
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzingVision, setIsAnalyzingVision] = useState(false);
  const [visionRecord, setVisionRecord] = useState<VisionCacheRecord | null>(null);

  // OCR and Backend AI Cache States
  const [ocrRecord, setOcrRecord] = useState<OCRCacheRecord | null>(null);
  const [cacheRecord, setCacheRecord] = useState<ClassificationCacheRecord | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isReclassifyModalOpen, setIsReclassifyModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    ocrCacheRepository.getByScreenshotId(id).then((record) => {
      if (isMounted && record) {
        setOcrRecord(record);
      }
    });
    classificationCacheRepository.getCacheByScreenshotId(id).then((cache) => {
      if (isMounted && cache) {
        setCacheRecord(cache);
      }
    });
    visionRepository.getVisionResult(id).then((vr) => {
      if (isMounted && vr) {
        setVisionRecord(vr);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleAnalyzeWithVisionAI = async () => {
    if (!screenshot) return;
    setIsAnalyzingVision(true);

    try {
      const targetPath = screenshot.localPath || screenshot.filePath;
      const res = await visionAIService.analyzeScreenshot({
        screenshotId: id,
        filePath: targetPath,
        fileHash: (screenshot as any).fileHash,
        fileName: screenshot.fileName,
        ocrText: screenshot.ocrText || ocrRecord?.extractedText,
        forceRefresh: true,
      });

      if (res.isSuccess && res.data) {
        const vr = await visionRepository.getVisionResult(id);
        const cr = await classificationCacheRepository.getCacheByScreenshotId(id);
        setVisionRecord(vr);
        setCacheRecord(cr);
        Alert.alert(
          'Vision Analysis Complete',
          `Classified as ${res.data.category} (${res.data.confidence}% confidence)\n\nSummary: ${res.data.summary}`
        );
      } else {
        Alert.alert(res.error || 'Vision Analysis Failed', 'Could not complete visual scene analysis.');
      }
    } catch (err: any) {
      Alert.alert('Vision Analysis Failed', err?.message || 'Error executing vision analysis.');
    } finally {
      setIsAnalyzingVision(false);
    }
  };

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

  const handleDeleteScreenshot = () => {
    Alert.alert(
      'Move to Recycle Bin',
      `Move "${screenshot.fileName}" to the Recycle Bin?\n\nYou can restore it anytime from Settings > Recycle Bin. Original photos on your device will NOT be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Bin',
          style: 'destructive',
          onPress: async () => {
            try {
              await useScreenshotStore.getState().softDeleteScreenshot(id);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to move screenshot to Recycle Bin.');
            }
          },
        },
      ]
    );
  };

  const handleCopyText = () => {
    const textToCopy = screenshot.ocrText || ocrRecord?.extractedText || '';
    if (!textToCopy) return;

    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    Alert.alert('OCR Text Copied', 'The extracted text has been copied to your clipboard.');
  };

  const handleSyncWithBackendAI = async () => {
    setIsSyncing(true);
    const res = await contextSyncService.syncScreenshotMetadata(screenshot, ocrRecord);

    if (res.isSuccess && res.data) {
      const cache = await classificationCacheRepository.getCacheByScreenshotId(id);
      setCacheRecord(cache);
      Alert.alert(
        'AI Sync Complete',
        `Categorized as ${res.data.categoryName} (${res.data.subcategory}) with ${Math.round(
          res.data.confidence * 100
        )}% confidence.`
      );
    } else {
      Alert.alert(
        'Offline Queue Enqueued',
        'Backend server unavailable. Screenshot metadata has been saved to the offline sync queue and will sync automatically when online.'
      );
    }
    setIsSyncing(false);
  };

  const [imageError, setImageError] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [lastTap, setLastTap] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(true);

  // Full-resolution candidate order for detail inspection
  const candidateUris = React.useMemo(() => {
    const list: string[] = [];
    const add = (u?: string | null) => {
      if (u && typeof u === 'string') {
        const clean = u.trim();
        if (clean && !list.includes(clean)) list.push(clean);
      }
    };

    // 1. Content URI (Scoped Storage compatible)
    if (screenshot?.contentUri) {
      add(MediaStorePathResolver.resolveContentUri(screenshot.contentUri));
    } else if (screenshot?.deviceAssetId && /^\d+$/.test(screenshot.deviceAssetId)) {
      add(`content://media/external/images/media/${screenshot.deviceAssetId}`);
    }

    // 2. Local normalized file URI (full-res)
    const rawLocal = screenshot?.localPath || screenshot?.filePath;
    if (rawLocal) {
      add(MediaStorePathResolver.normalizeFileUri(rawLocal));
    }

    // 3. Cached 300px thumbnail fallback
    if (screenshot?.thumbnailUri) {
      add(MediaStorePathResolver.normalizeFileUri(screenshot.thumbnailUri));
    }

    return list;
  }, [screenshot]);

  useEffect(() => {
    setImageError(false);
    setCandidateIndex(0);
    setIsImageLoading(true);
  }, [candidateUris]);

  const activeUri = candidateUris[candidateIndex] || '';

  const handleImageError = () => {
    if (candidateIndex + 1 < candidateUris.length) {
      setCandidateIndex((prev) => prev + 1);
      setIsImageLoading(true);
    } else {
      setImageError(true);
      setIsImageLoading(false);
    }
  };

  const handleRetryImage = () => {
    setImageError(false);
    setCandidateIndex(0);
    setIsImageLoading(true);
  };

  // Swipe previous / next navigation across gallery
  const allScreenshots = useScreenshotStore((s) => s.screenshots);
  const currentIndex = allScreenshots.findIndex((item) => item.id === id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allScreenshots.length - 1;

  const navigateToPrevious = () => {
    if (hasPrevious) {
      navigation.setParams({ id: allScreenshots[currentIndex - 1].id });
    }
  };

  const navigateToNext = () => {
    if (hasNext) {
      navigation.setParams({ id: allScreenshots[currentIndex + 1].id });
    }
  };

  const touchStartX = React.useRef(0);
  const touchStartY = React.useRef(0);

  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
  };

  const handleTouchEnd = (e: any) => {
    const dx = e.nativeEvent.pageX - touchStartX.current;
    const dy = e.nativeEvent.pageY - touchStartY.current;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 60) {
      if (dx > 0) {
        navigateToPrevious();
      } else {
        navigateToNext();
      }
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      setZoomScale((prev) => (prev > 1.2 ? 1 : 2.5));
    }
    setLastTap(now);
  };

  const handleZoomIn = () => setZoomScale((s) => Math.min(4, +(s + 0.5).toFixed(1)));
  const handleZoomOut = () => setZoomScale((s) => Math.max(1, +(s - 0.5).toFixed(1)));
  const handleZoomReset = () => setZoomScale(1);

  const uri = activeUri;

  const ocrText = screenshot.ocrText || ocrRecord?.extractedText || '';
  const processingDuration = ocrRecord?.processingTime || 0;
  const ocrConfidence = ocrRecord?.confidence || screenshot.confidence || 0.88;
  const isManual = screenshot.classificationSource === 'manual' || (!screenshot.isAutoCategorized && screenshot.isReviewed);
  const isBackendAI = !isManual && ((screenshot.classificationSource === 'backend') || (cacheRecord?.source === 'backend'));
  const needsHumanReview = !screenshot.isReviewed && (screenshot.confidence < 0.7 || screenshot.categoryId === 'unsorted');

  // Parse extracted entities from backend cache
  let extractedEntities: ExtractedEntitiesDto = {
    amounts: [],
    urls: [],
    emails: [],
    phoneNumbers: [],
    merchants: [],
    projectNames: [],
    dates: [],
  };
  if (cacheRecord?.entitiesJson) {
    try {
      extractedEntities = JSON.parse(cacheRecord.entitiesJson);
    } catch {}
  }

  // Tags list
  const displayTags = screenshot.tags.map((t) => t.name).concat(screenshot.keywords || []);
  const uniqueTags = Array.from(new Set(displayTags)).filter(Boolean);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.actionBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            onPress={handleToggleFavorite}
            style={[styles.actionBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          >
            <Icon
              name={screenshot.isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={screenshot.isFavorite ? theme.colors.error : theme.colors.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('ContextAIChat', { screenshotId: id })}
            style={[styles.actionBtn, { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.border, marginLeft: 8 }]}
          >
            <Icon name="sparkles" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeleteScreenshot}
            style={[styles.actionBtn, { backgroundColor: `${theme.colors.error}15`, borderColor: theme.colors.border, marginLeft: 8 }]}
            accessibilityRole="button"
            accessibilityLabel="Move to Recycle Bin"
          >
            <Icon name="trash-outline" size={18} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Preview Image */}
        {imageError || !uri ? (
          <View
            style={[
              styles.imageErrorContainer,
              {
                backgroundColor: theme.isDark ? '#1E293B' : '#FEF2F2',
                borderColor: theme.isDark ? '#334155' : '#FCA5A5',
              },
            ]}
          >
            <Icon name="alert-circle-outline" size={36} color={theme.colors.error} />
            <Text style={[styles.imageErrorTitle, { color: theme.colors.error }]}>
              Screenshot Image Unavailable
            </Text>
            <Text style={[styles.imageErrorSubtext, { color: theme.colors.textSecondary }]}>
              The image file was not found at the recorded local path or could not be decoded.
            </Text>
            <Text numberOfLines={2} style={[styles.imageErrorPath, { color: theme.colors.textMuted }]}>
              {screenshot.filePath}
            </Text>
            <TouchableOpacity
              onPress={handleRetryImage}
              style={[styles.retryLoadBtn, { backgroundColor: `${theme.colors.primary}18`, borderColor: theme.colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Retry loading screenshot"
            >
              <Icon name="refresh-outline" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.retryLoadBtnText, { color: theme.colors.primary }]}>Retry Loading</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={[styles.imageContainer, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}
          >
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => {
                setZoomScale(1);
                setIsZoomModalOpen(true);
              }}
              style={styles.imageTouchable}
              accessibilityRole="button"
              accessibilityLabel="Tap to zoom screenshot full-screen"
            >
              <Image
                source={{ uri, cache: 'force-cache' }}
                style={styles.image}
                resizeMode="contain"
                onLoadStart={() => setIsImageLoading(true)}
                onLoadEnd={() => setIsImageLoading(false)}
                onError={handleImageError}
              />
              {isImageLoading && (
                <View style={styles.imageLoadingOverlay}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
              )}
            </TouchableOpacity>

            {/* Previous navigation chevron */}
            {hasPrevious && (
              <TouchableOpacity
                onPress={navigateToPrevious}
                style={[styles.navArrowBtn, styles.navArrowLeft]}
                accessibilityRole="button"
                accessibilityLabel="Previous screenshot"
              >
                <Icon name="chevron-back" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {/* Next navigation chevron */}
            {hasNext && (
              <TouchableOpacity
                onPress={navigateToNext}
                style={[styles.navArrowBtn, styles.navArrowRight]}
                accessibilityRole="button"
                accessibilityLabel="Next screenshot"
              >
                <Icon name="chevron-forward" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            <View style={styles.zoomHintPill}>
              <Icon name="scan-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.zoomHintText}>Tap to Zoom • Swipe for Next</Text>
            </View>
          </View>
        )}

        {/* Needs Human Review Alert Banner */}
        {needsHumanReview && (
          <View
            style={[
              styles.needsReviewBanner,
              {
                backgroundColor: theme.isDark ? '#78350F35' : '#FFFBEB',
                borderColor: theme.isDark ? '#92400E' : '#FDE68A',
              },
            ]}
          >
            <Icon name="alert-circle" size={20} color="#F59E0B" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.needsReviewBannerTitle, { color: theme.isDark ? '#FCD34D' : '#92400E' }]}>
                Action Required: Human Review
              </Text>
              <Text style={[styles.needsReviewBannerSubtext, { color: theme.isDark ? '#FDE68A' : '#B45309' }]}>
                AI confidence is low or category is unsorted.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsReclassifyModalOpen(true)}
              style={styles.needsReviewActionBtn}
              accessibilityRole="button"
              accessibilityLabel="Review and Reclassify"
            >
              <Text style={styles.needsReviewActionBtnText}>Review</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 1. Category, AI Source & Confidence Card */}
        <ModernCard style={styles.card}>
          <View style={styles.categoryRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.categoryName, { color: theme.colors.textPrimary }]}>
                {screenshot.categoryName}
              </Text>
              {screenshot.subcategory ? (
                <Text style={[styles.subcategoryName, { color: theme.colors.textSecondary }]}>
                  {screenshot.subcategory}
                </Text>
              ) : null}
            </View>

            {/* AI Confidence Badge */}
            <View style={[styles.confidencePill, { backgroundColor: `${theme.colors.primary}18` }]}>
              <Icon name="shield-checkmark-outline" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.confidencePillText, { color: theme.colors.primary }]}>
                {Math.round(screenshot.confidence * 100)}% Confidence
              </Text>
            </View>
          </View>

          {/* Folder Breadcrumb Path */}
          <View style={[styles.breadcrumbBox, { backgroundColor: theme.isDark ? '#1E293B60' : '#F1F5F9' }]}>
            <Icon name="folder-open-outline" size={14} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
            <Text numberOfLines={1} style={[styles.breadcrumbText, { color: theme.colors.textSecondary }]}>
              {screenshot.folderPath ? screenshot.folderPath.join(' › ') : `${screenshot.categoryName} › ${screenshot.subcategory || 'General'}`}
            </Text>
          </View>

          {/* Classification Source Badge */}
          <View style={styles.sourceRow}>
            <View
              style={[
                styles.sourceBadge,
                {
                  backgroundColor: isManual
                    ? `${theme.colors.primary}18`
                    : isBackendAI
                    ? `${theme.colors.success}18`
                    : `${theme.colors.accent}18`,
                },
              ]}
            >
              <Icon
                name={
                  isManual
                    ? 'checkmark-circle-outline'
                    : isBackendAI
                    ? 'cloud-done-outline'
                    : 'phone-portrait-outline'
                }
                size={14}
                color={
                  isManual
                    ? theme.colors.primary
                    : isBackendAI
                    ? theme.colors.success
                    : theme.colors.accent
                }
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.sourceBadgeText,
                  {
                    color: isManual
                      ? theme.colors.primary
                      : isBackendAI
                      ? theme.colors.success
                      : theme.colors.accent,
                  },
                ]}
              >
                {isManual
                  ? 'Manually Verified & Reclassified'
                  : isBackendAI
                  ? 'Backend AI Synchronized'
                  : 'On-Device Heuristic'}
              </Text>
            </View>
          </View>

          {/* Dual CTAs: Manual Reclassify and Backend AI Sync */}
          <View style={styles.ctaRow}>
            <TouchableOpacity
              onPress={() => setIsReclassifyModalOpen(true)}
              style={[
                styles.reclassifyBtn,
                {
                  flex: 1,
                  backgroundColor: `${theme.colors.primary}15`,
                  borderColor: theme.colors.primary,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Manually Reclassify Screenshot"
            >
              <Icon name="color-wand-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.reclassifyText, { color: theme.colors.primary }]}>
                Reclassify
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSyncWithBackendAI}
              disabled={isSyncing}
              style={[
                styles.reclassifyBtn,
                {
                  flex: 1,
                  borderColor: theme.colors.border,
                  marginLeft: 10,
                  opacity: isSyncing ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Sync with Backend AI"
            >
              <Icon name="sync-outline" size={16} color={theme.colors.textPrimary} />
              <Text style={[styles.reclassifyText, { color: theme.colors.textPrimary }]}>
                {isSyncing ? 'Syncing...' : 'Sync AI'}
              </Text>
            </TouchableOpacity>
          </View>
        </ModernCard>

        {/* Local Vision AI Scene Intelligence Card (Sprint P1-B) */}
        <ModernCard style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="sparkles" size={18} color="#8B5CF6" />
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary, marginLeft: 8 }]}>
                Local Vision AI Analysis
              </Text>
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#8B5CF620' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#8B5CF6' }}>
                RTX 4050
              </Text>
            </View>
          </View>

          {visionRecord ? (
            <View style={{ marginTop: 6 }}>
              {/* Summary */}
              {visionRecord.summary ? (
                <View style={{ marginBottom: 10, padding: 10, borderRadius: 8, backgroundColor: theme.colors.surfaceVariant }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#8B5CF6', marginBottom: 4 }}>
                    Visual Summary
                  </Text>
                  <Text style={{ fontSize: 13, lineHeight: 18, color: theme.colors.textPrimary }}>
                    {visionRecord.summary}
                  </Text>
                </View>
              ) : null}

              {/* Detected Application & Confidence */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Application</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary }}>
                  {visionRecord.application_name}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Vision Confidence</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#10B981' }}>
                  {Math.round(visionRecord.confidence * (visionRecord.confidence <= 1 ? 100 : 1))}%
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Model Engine</Text>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                  {visionRecord.model_version}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginVertical: 8 }}>
              This screenshot has not been visually inspected by the local Vision AI engine yet.
            </Text>
          )}

          <TouchableOpacity
            onPress={handleAnalyzeWithVisionAI}
            disabled={isAnalyzingVision}
            style={[
              styles.reclassifyBtn,
              {
                backgroundColor: '#8B5CF618',
                borderColor: '#8B5CF6',
                marginTop: 8,
                opacity: isAnalyzingVision ? 0.6 : 1,
              },
            ]}
          >
            {isAnalyzingVision ? (
              <ActivityIndicator size="small" color="#8B5CF6" style={{ marginRight: 6 }} />
            ) : (
              <Icon name="sparkles-outline" size={16} color="#8B5CF6" style={{ marginRight: 6 }} />
            )}
            <Text style={[styles.reclassifyText, { color: '#8B5CF6', fontWeight: '600' }]}>
              {isAnalyzingVision ? 'Analyzing on RTX 4050...' : visionRecord ? 'Re-analyze with Vision AI' : 'Analyze with Vision AI'}
            </Text>
          </TouchableOpacity>
        </ModernCard>

        {/* 2. Extracted Entities Card */}
        {(extractedEntities.amounts.length > 0 ||
          extractedEntities.merchants.length > 0 ||
          extractedEntities.urls.length > 0 ||
          extractedEntities.dates.length > 0 ||
          extractedEntities.emails.length > 0) && (
          <ModernCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="cube-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                AI Extracted Entities
              </Text>
            </View>

            {extractedEntities.merchants.length > 0 && (
              <View style={styles.entitySection}>
                <Text style={[styles.entitySectionTitle, { color: theme.colors.textSecondary }]}>
                  Merchants & Organizations
                </Text>
                <View style={styles.tagsWrap}>
                  {extractedEntities.merchants.map((m, idx) => (
                    <TagChip key={idx} label={m} colorHex="#3B82F6" />
                  ))}
                </View>
              </View>
            )}

            {extractedEntities.amounts.length > 0 && (
              <View style={styles.entitySection}>
                <Text style={[styles.entitySectionTitle, { color: theme.colors.textSecondary }]}>
                  Financial Amounts
                </Text>
                <View style={styles.tagsWrap}>
                  {extractedEntities.amounts.map((a, idx) => (
                    <TagChip key={idx} label={a} colorHex="#10B981" />
                  ))}
                </View>
              </View>
            )}

            {extractedEntities.dates.length > 0 && (
              <View style={styles.entitySection}>
                <Text style={[styles.entitySectionTitle, { color: theme.colors.textSecondary }]}>
                  Dates
                </Text>
                <View style={styles.tagsWrap}>
                  {extractedEntities.dates.map((d, idx) => (
                    <TagChip key={idx} label={d} colorHex="#F59E0B" />
                  ))}
                </View>
              </View>
            )}

            {extractedEntities.urls.length > 0 && (
              <View style={styles.entitySection}>
                <Text style={[styles.entitySectionTitle, { color: theme.colors.textSecondary }]}>
                  Web Links
                </Text>
                <View style={styles.tagsWrap}>
                  {extractedEntities.urls.map((u, idx) => (
                    <TagChip key={idx} label={u} colorHex={theme.colors.primary} />
                  ))}
                </View>
              </View>
            )}

            {extractedEntities.emails.length > 0 && (
              <View style={styles.entitySection}>
                <Text style={[styles.entitySectionTitle, { color: theme.colors.textSecondary }]}>
                  Emails
                </Text>
                <View style={styles.tagsWrap}>
                  {extractedEntities.emails.map((e, idx) => (
                    <TagChip key={idx} label={e} colorHex="#8B5CF6" />
                  ))}
                </View>
              </View>
            )}
          </ModernCard>
        )}

        {/* 3. OCR Text Preview Card */}
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

        {/* 4. AI Tags */}
        {uniqueTags.length > 0 && (
          <ModernCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="pricetags-outline" size={18} color={theme.colors.secondary} />
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                AI Tags & Keywords
              </Text>
            </View>
            <View style={styles.tagsWrap}>
              {uniqueTags.map((t, i) => (
                <TagChip key={i} label={t} colorHex={theme.colors.primary} />
              ))}
            </View>
          </ModernCard>
        )}

        {/* 5. Metadata Info */}
        <ModernCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="information-circle-outline" size={18} color={theme.colors.textSecondary} />
            <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
              File & System Metadata
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaKey, { color: theme.colors.textSecondary }]}>File Name</Text>
            <Text numberOfLines={1} style={[styles.metaVal, { color: theme.colors.textPrimary, maxWidth: '60%' }]}>
              {screenshot.fileName}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaKey, { color: theme.colors.textSecondary }]}>Dimensions</Text>
            <Text style={[styles.metaVal, { color: theme.colors.textPrimary }]}>
              {screenshot.width} x {screenshot.height} px
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaKey, { color: theme.colors.textSecondary }]}>Size</Text>
            <Text style={[styles.metaVal, { color: theme.colors.textPrimary }]}>
              {FileUtils.formatBytes(screenshot.fileSize)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaKey, { color: theme.colors.textSecondary }]}>Detected</Text>
            <Text style={[styles.metaVal, { color: theme.colors.textPrimary }]}>
              {DateFormatter.formatFullDateTime(screenshot.createdAt)}
            </Text>
          </View>
          {screenshot.detectedApp ? (
            <View style={styles.metaRow}>
              <Text style={[styles.metaKey, { color: theme.colors.textSecondary }]}>App Detected</Text>
              <Text style={[styles.metaVal, { color: theme.colors.textPrimary }]}>
                {screenshot.detectedApp}
              </Text>
            </View>
          ) : null}
        </ModernCard>
      </ScrollView>

      {/* Fullscreen Pinch-to-Zoom Lightbox Modal */}
      <Modal
        visible={isZoomModalOpen}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setIsZoomModalOpen(false)}
        testID="screenshot-zoom-modal"
      >
        <View style={styles.modalBackdrop}>
          {/* Modal Top Bar */}
          <View style={styles.modalTopBar}>
            <TouchableOpacity
              onPress={() => setIsZoomModalOpen(false)}
              style={styles.modalCloseBtn}
              accessibilityLabel="Close full screen view"
            >
              <Icon name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.modalTitleBox}>
              <Text numberOfLines={1} style={styles.modalTitleText}>
                {screenshot.fileName}
              </Text>
              <Text style={styles.modalMetaText}>
                {screenshot.width} x {screenshot.height} px • {FileUtils.formatBytes(screenshot.fileSize)}
              </Text>
            </View>

            {/* Zoom Controls Toolbar */}
            <View style={styles.modalControlsRow}>
              <TouchableOpacity
                onPress={handleZoomOut}
                disabled={zoomScale <= 1}
                style={[styles.zoomControlBtn, zoomScale <= 1 && styles.zoomBtnDisabled]}
                accessibilityLabel="Zoom out"
              >
                <Icon name="remove" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleZoomReset}
                style={styles.zoomScaleBadge}
                accessibilityLabel="Reset zoom"
              >
                <Text style={styles.zoomScaleText}>{zoomScale.toFixed(1)}x</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleZoomIn}
                disabled={zoomScale >= 4}
                style={[styles.zoomControlBtn, zoomScale >= 4 && styles.zoomBtnDisabled]}
                accessibilityLabel="Zoom in"
              >
                <Icon name="add" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Interactive Zoom Viewport */}
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            maximumZoomScale={4.0}
            minimumZoomScale={1.0}
            centerContent={true}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleDoubleTap}
              style={styles.modalImageTouchable}
            >
              <Image
                source={{ uri, cache: 'force-cache' }}
                style={[
                  styles.modalImage,
                  {
                    transform: [{ scale: zoomScale }],
                  },
                ]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </ScrollView>

          {/* Double Tap Hint Footer */}
          <View style={styles.modalFooter}>
            <Text style={styles.modalFooterText}>
              Double tap to zoom • Pinch with two fingers to inspect details
            </Text>
          </View>
        </View>
      </Modal>

      {/* Manual Reclassification Modal */}
      <ReclassifyModal
        visible={isReclassifyModalOpen}
        screenshot={screenshot}
        onClose={() => setIsReclassifyModalOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarActions: {
    flexDirection: 'row',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  imageContainer: {
    height: 320,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  imageTouchable: {
    width: '100%',
    height: '100%',
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  navArrowBtn: {
    position: 'absolute',
    top: '42%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navArrowLeft: {
    left: 10,
  },
  navArrowRight: {
    right: 10,
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
    fontSize: 14,
    marginTop: 2,
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  confidencePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  breadcrumbBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  breadcrumbText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  sourceRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sourceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  reclassifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  reclassifyText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  needsReviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  needsReviewBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  needsReviewBannerSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  needsReviewActionBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  needsReviewActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  entitySection: {
    marginBottom: 10,
  },
  entitySectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  ocrHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ocrHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ocrIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  ocrSubtext: {
    fontSize: 11,
    marginTop: 1,
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
  imageErrorContainer: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  imageErrorTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  imageErrorSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  imageErrorPath: {
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryLoadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  retryLoadBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  zoomHintPill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  zoomHintText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 10,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleBox: {
    flex: 1,
    marginHorizontal: 12,
  },
  modalTitleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalMetaText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
  modalControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomControlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnDisabled: {
    opacity: 0.35,
  },
  zoomScaleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  zoomScaleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalFooter: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalFooterText: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
