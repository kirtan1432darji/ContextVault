import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useFolderContextStore } from '../store/folderContext.store';
import { folderContextService } from '../services/FolderContextService';
import { folderContextExportService, ExportFormat } from '../services/folderContextExportService';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { ScreenshotModel } from '../models';
import { ModernCard } from '../components/ModernCard';
import { TagChip } from '../components/TagChip';
import { ScreenshotImageThumbnail } from '../components/ScreenshotImageThumbnail';
import { useAuthStore } from '../store/auth.store';
import { FeatureLockCard } from '../components/FeatureLockCard';

type Props = NativeStackScreenProps<RootStackParamList, 'FolderContext'>;

export const FolderContextScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId, categoryName } = route.params;
  const theme = useAppTheme();

  const isGuest = useAuthStore((s) => s.isGuest);
  const folderContext = useFolderContextStore((s) => s.getFolderContext(categoryId, categoryName));
  const isGenerating = useFolderContextStore((s) => s.isGenerating);
  const [loading, setLoading] = useState(false);
  const [screenshots, setScreenshots] = useState<ScreenshotModel[]>([]);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isGuest) {
      loadContext();
    }
    loadFolderScreenshots();
  }, [categoryId, isGuest]);

  const loadFolderScreenshots = async () => {
    const items = await screenshotRepository.getScreenshotsByCategoryId(categoryId);
    setScreenshots(items || []);
  };

  const loadContext = async () => {
    setLoading(true);
    await folderContextService.getOrGenerateContext(categoryId, categoryName, false);
    setLoading(false);
  };

  const handleManualRefresh = async () => {
    if (isGuest) return;
    useFolderContextStore.getState().setGenerating(true);
    await folderContextService.generateFolderContext(categoryId, categoryName);
    await loadFolderScreenshots();
    useFolderContextStore.getState().setGenerating(false);
  };

  const handleExportShare = async () => {
    try {
      setIsExporting(true);
      await folderContextExportService.shareExport(
        exportFormat,
        folderContext,
        categoryName,
        screenshots
      );
      setExportModalVisible(false);
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Could not export folder context report.');
    } finally {
      setIsExporting(false);
    }
  };

  const getPreviewText = (): string => {
    if (exportFormat === 'markdown') {
      return folderContextExportService.generateMarkdown(folderContext, categoryName, screenshots);
    } else if (exportFormat === 'text') {
      return folderContextExportService.generatePlainText(folderContext, categoryName, screenshots);
    } else {
      const lineCount = folderContextExportService.generatePlainText(folderContext, categoryName, screenshots).split('\n').length;
      const estimatedPages = Math.max(1, Math.ceil(lineCount / 50));
      return `[PDF DOCUMENT PREVIEW]\nTitle: ${categoryName} — Living Intelligence Report\nFormat: Standard US-Letter PDF 1.4\nPages: ~${estimatedPages}\nEncoding: Base64 Binary Stream\n\nIncluded Sections:\n- Executive Summary\n- Key Insights & Topics (${folderContext.keywords.length})\n- Extracted Entities & Financials\n- Action Items Checklist (${folderContext.tasks.length})\n- Chronological Timeline (${folderContext.timeline.length})\n- Source Screenshot Index (${screenshots.length})\n\nTap "Share / Save Report" below to open the Android Print & Share Sheet.`;
    }
  };

  const structured = folderContext.structuredEntities;

  if (isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          >
            <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.titleBox}>
            <Text numberOfLines={1} style={[styles.title, { color: theme.colors.textPrimary }]}>
              {categoryName} Context
            </Text>
            <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
              Living Folder Intelligence
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
          <FeatureLockCard
            title="Folder Context Locked"
            featureName="Folder Context"
            description="Sign in to ContextVault to generate AI summaries, extracted entities, action items, and timelines for your screenshots."
            onSignIn={() => navigation.navigate('Login')}
            onCreateAccount={() => navigation.navigate('Register')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.textPrimary }]}>
            {categoryName}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Context Folder • Living Intelligence
          </Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity
            onPress={() => setExportModalVisible(true)}
            style={[styles.headerExportBtn, { backgroundColor: `${theme.colors.primary}20` }]}
            accessibilityLabel="Export folder context report"
          >
            <Icon name="share-outline" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('ContextAIChat', { categoryId, categoryName })}
            style={[styles.headerAiBtn, { backgroundColor: `${theme.colors.primary}20` }]}
            accessibilityLabel="Ask AI about this folder"
          >
            <Icon name="chatbubbles-outline" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleManualRefresh}
            disabled={isGenerating}
            style={[styles.refreshBtn, { backgroundColor: `${theme.colors.primary}20` }]}
            accessibilityLabel="Refresh living context"
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Icon name="refresh-outline" size={18} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. Executive Summary */}
        <ModernCard style={styles.summaryCard}>
          <View style={styles.sectionHeading}>
            <Icon name="sparkles" size={20} color={theme.colors.primary} />
            <Text style={[styles.headingText, { color: theme.colors.textPrimary }]}>
              Executive Summary
            </Text>
            {folderContext.confidence > 0 && (
              <View style={[styles.confidenceBadge, { backgroundColor: `${theme.colors.success}18` }]}>
                <Text style={[styles.confidenceText, { color: theme.colors.success }]}>
                  {Math.round(folderContext.confidence * 100)}% AI Match
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.summaryBody, { color: theme.colors.textPrimary }]}>
            {folderContext.summary ||
              `This folder contains structured records for ${categoryName}. Tap refresh to generate real-time AI contextual extraction from your saved screenshots.`}
          </Text>
          {folderContext.lastUpdatedAt && (
            <Text style={[styles.updatedAtText, { color: theme.colors.textSecondary }]}>
              Updated {new Date(folderContext.lastUpdatedAt).toLocaleDateString()} at{' '}
              {new Date(folderContext.lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </ModernCard>

        {/* 2. Key Insights & Topics */}
        {folderContext.keywords.length > 0 && (
          <ModernCard style={styles.card}>
            <View style={styles.sectionHeading}>
              <Icon name="bulb-outline" size={18} color={theme.colors.secondary} />
              <Text style={[styles.headingText, { color: theme.colors.textPrimary }]}>
                Key Insights & Topics
              </Text>
            </View>
            <View style={styles.chipsWrap}>
              {folderContext.keywords.map((topic, i) => (
                <TagChip key={i} label={topic} colorHex={theme.colors.primary} />
              ))}
            </View>
          </ModernCard>
        )}

        {/* 3. Extracted Entities Breakdown */}
        {structured && (
          <ModernCard style={styles.card}>
            <View style={styles.sectionHeading}>
              <Icon name="cube-outline" size={18} color={theme.colors.accent} />
              <Text style={[styles.headingText, { color: theme.colors.textPrimary }]}>
                Extracted Entities
              </Text>
            </View>

            {/* Organizations */}
            {structured.organizations.length > 0 && (
              <View style={styles.entityGroup}>
                <Text style={[styles.entityLabel, { color: theme.colors.textSecondary }]}>
                  Organizations & Merchants
                </Text>
                <View style={styles.chipsWrap}>
                  {structured.organizations.map((org, i) => (
                    <TagChip key={i} label={org} colorHex="#3B82F6" />
                  ))}
                </View>
              </View>
            )}

            {/* Payments & Values */}
            {structured.payments.length > 0 && (
              <View style={styles.entityGroup}>
                <Text style={[styles.entityLabel, { color: theme.colors.textSecondary }]}>
                  Payments & Values
                </Text>
                <View style={styles.chipsWrap}>
                  {structured.payments.map((pay, i) => (
                    <TagChip key={i} label={pay} colorHex="#10B981" />
                  ))}
                </View>
              </View>
            )}

            {/* Shopping Items */}
            {structured.shopping.length > 0 && (
              <View style={styles.entityGroup}>
                <Text style={[styles.entityLabel, { color: theme.colors.textSecondary }]}>
                  Shopping Items
                </Text>
                <View style={styles.chipsWrap}>
                  {structured.shopping.map((item, i) => (
                    <TagChip key={i} label={item} colorHex="#F97316" />
                  ))}
                </View>
              </View>
            )}

            {/* Documents */}
            {structured.documents.length > 0 && (
              <View style={styles.entityGroup}>
                <Text style={[styles.entityLabel, { color: theme.colors.textSecondary }]}>
                  Documents & IDs
                </Text>
                <View style={styles.chipsWrap}>
                  {structured.documents.map((doc, i) => (
                    <TagChip key={i} label={doc} colorHex="#06B6D4" />
                  ))}
                </View>
              </View>
            )}

            {/* People */}
            {structured.people.length > 0 && (
              <View style={styles.entityGroup}>
                <Text style={[styles.entityLabel, { color: theme.colors.textSecondary }]}>
                  People & Contacts
                </Text>
                <View style={styles.chipsWrap}>
                  {structured.people.map((p, i) => (
                    <TagChip key={i} label={p} colorHex="#8B5CF6" />
                  ))}
                </View>
              </View>
            )}

            {/* URLs */}
            {structured.urls.length > 0 && (
              <View style={styles.entityGroup}>
                <Text style={[styles.entityLabel, { color: theme.colors.textSecondary }]}>
                  Links & URLs
                </Text>
                <View style={styles.chipsWrap}>
                  {structured.urls.map((u, i) => (
                    <TagChip key={i} label={u} colorHex={theme.colors.primary} />
                  ))}
                </View>
              </View>
            )}
          </ModernCard>
        )}

        {/* 4. Action Items Checklist */}
        {folderContext.tasks.length > 0 && (
          <ModernCard style={styles.card}>
            <View style={styles.sectionHeading}>
              <Icon name="checkbox-outline" size={18} color={theme.colors.success} />
              <Text style={[styles.headingText, { color: theme.colors.textPrimary }]}>
                Action Items ({folderContext.tasks.filter((t) => !t.isCompleted).length} Pending)
              </Text>
            </View>
            {folderContext.tasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                onPress={() =>
                  useFolderContextStore.getState().toggleTaskCompleted(categoryId, task.id)
                }
                style={styles.taskRow}
              >
                <Icon
                  name={task.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={task.isCompleted ? theme.colors.success : theme.colors.textMuted}
                />
                <Text
                  style={[
                    styles.taskTitle,
                    {
                      color: task.isCompleted
                        ? theme.colors.textMuted
                        : theme.colors.textPrimary,
                      textDecorationLine: task.isCompleted ? 'line-through' : 'none',
                    },
                  ]}
                >
                  {task.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ModernCard>
        )}

        {/* 5. Timeline */}
        {folderContext.timeline.length > 0 && (
          <ModernCard style={styles.card}>
            <View style={styles.sectionHeading}>
              <Icon name="time-outline" size={18} color={theme.colors.accent} />
              <Text style={[styles.headingText, { color: theme.colors.textPrimary }]}>
                Timeline
              </Text>
            </View>
            {folderContext.timeline.map((item, idx) => (
              <View key={idx} style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: theme.colors.primary }]} />
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineTitle, { color: theme.colors.textPrimary }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.timelineDesc, { color: theme.colors.textSecondary }]}>
                    {item.description}
                  </Text>
                </View>
              </View>
            ))}
          </ModernCard>
        )}

        {/* 6. Related Screenshots Carousel */}
        {screenshots.length > 0 && (
          <View style={styles.screenshotsSection}>
            <View style={styles.sectionHeading}>
              <Icon name="images-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.headingText, { color: theme.colors.textPrimary }]}>
                Related Screenshots ({screenshots.length})
              </Text>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={screenshots}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.screenshotsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => navigation.navigate('ScreenshotDetail', { id: item.id })}
                  style={[styles.screenshotThumbBox, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}
                >
                  <ScreenshotImageThumbnail
                    filePath={item.filePath}
                    deviceAssetId={item.deviceAssetId}
                    style={styles.screenshotThumb}
                    borderRadius={8}
                    showLoadingIndicator
                  />
                  <View style={styles.thumbLabelBox}>
                    <Text numberOfLines={1} style={styles.thumbLabel}>
                      {item.subcategory || item.fileName}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </ScrollView>

      {/* Floating Ask Context AI CTA */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('ContextAIChat', { categoryId, categoryName })
          }
          style={[styles.chatCta, { backgroundColor: theme.colors.primary }]}
        >
          <Icon name="chatbubble-ellipses" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Export Context Modal */}
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.exportSheet,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                  Export Living Context
                </Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                  {categoryName} • Structured Dossier & Action Items
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setExportModalVisible(false)}
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Icon name="close" size={18} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Format Selector */}
            <Text style={[styles.selectorLabel, { color: theme.colors.textSecondary }]}>
              SELECT EXPORT FORMAT
            </Text>
            <View style={styles.formatTabsRow}>
              {/* PDF Option */}
              <TouchableOpacity
                onPress={() => setExportFormat('pdf')}
                style={[
                  styles.formatTab,
                  {
                    backgroundColor:
                      exportFormat === 'pdf'
                        ? `${theme.colors.primary}18`
                        : theme.colors.background,
                    borderColor:
                      exportFormat === 'pdf'
                        ? theme.colors.primary
                        : theme.colors.border,
                  },
                ]}
              >
                <Icon
                  name="document-text"
                  size={20}
                  color={
                    exportFormat === 'pdf'
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.formatTabTitle,
                    {
                      color:
                        exportFormat === 'pdf'
                          ? theme.colors.primary
                          : theme.colors.textPrimary,
                    },
                  ]}
                >
                  PDF
                </Text>
                <Text style={[styles.formatTabDesc, { color: theme.colors.textMuted }]}>
                  Printable Doc
                </Text>
              </TouchableOpacity>

              {/* Markdown Option */}
              <TouchableOpacity
                onPress={() => setExportFormat('markdown')}
                style={[
                  styles.formatTab,
                  {
                    backgroundColor:
                      exportFormat === 'markdown'
                        ? `${theme.colors.primary}18`
                        : theme.colors.background,
                    borderColor:
                      exportFormat === 'markdown'
                        ? theme.colors.primary
                        : theme.colors.border,
                  },
                ]}
              >
                <Icon
                  name="code-slash"
                  size={20}
                  color={
                    exportFormat === 'markdown'
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.formatTabTitle,
                    {
                      color:
                        exportFormat === 'markdown'
                          ? theme.colors.primary
                          : theme.colors.textPrimary,
                    },
                  ]}
                >
                  Markdown
                </Text>
                <Text style={[styles.formatTabDesc, { color: theme.colors.textMuted }]}>
                  Notion / Obsidian
                </Text>
              </TouchableOpacity>

              {/* Text Option */}
              <TouchableOpacity
                onPress={() => setExportFormat('text')}
                style={[
                  styles.formatTab,
                  {
                    backgroundColor:
                      exportFormat === 'text'
                        ? `${theme.colors.primary}18`
                        : theme.colors.background,
                    borderColor:
                      exportFormat === 'text'
                        ? theme.colors.primary
                        : theme.colors.border,
                  },
                ]}
              >
                <Icon
                  name="reader-outline"
                  size={20}
                  color={
                    exportFormat === 'text'
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.formatTabTitle,
                    {
                      color:
                        exportFormat === 'text'
                          ? theme.colors.primary
                          : theme.colors.textPrimary,
                    },
                  ]}
                >
                  Plain Text
                </Text>
                <Text style={[styles.formatTabDesc, { color: theme.colors.textMuted }]}>
                  Universal TXT
                </Text>
              </TouchableOpacity>
            </View>

            {/* Preview Box */}
            <Text
              style={[
                styles.selectorLabel,
                { color: theme.colors.textSecondary, marginTop: 14 },
              ]}
            >
              EXPORT PREVIEW
            </Text>
            <View
              style={[
                styles.previewContainer,
                {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <ScrollView
                style={styles.previewScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                <Text
                  style={[
                    styles.previewText,
                    { color: theme.colors.textPrimary },
                  ]}
                >
                  {getPreviewText()}
                </Text>
              </ScrollView>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                onPress={handleExportShare}
                disabled={isExporting}
                style={[
                  styles.shareActionBtn,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                {isExporting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="share-social-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.shareActionBtnText}>
                      Share / Save as {exportFormat.toUpperCase()}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleBox: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerExportBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAiBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  summaryCard: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headingText: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  summaryBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  updatedAtText: {
    fontSize: 11,
    marginTop: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  entityGroup: {
    marginTop: 10,
  },
  entityLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  taskTitle: {
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  screenshotsSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  screenshotsList: {
    paddingVertical: 8,
  },
  screenshotThumbBox: {
    width: 100,
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  screenshotThumb: {
    width: '100%',
    height: '100%',
  },
  thumbLabelBox: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  thumbLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  chatCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    elevation: 1,
  },
  chatCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  exportSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  formatTabsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formatTab: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatTabTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  formatTabDesc: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  previewContainer: {
    height: 140,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 16,
  },
  previewScroll: {
    flex: 1,
  },
  previewText: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  modalActionsRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  shareActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  shareActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

