import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useFolderContextStore } from '../store/folderContext.store';
import { contextService } from '../services/contextService';
import { ModernCard } from '../components/ModernCard';
import { TagChip } from '../components/TagChip';

type Props = NativeStackScreenProps<RootStackParamList, 'FolderContext'>;

export const FolderContextScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId, categoryName } = route.params;
  const theme = useAppTheme();

  const folderContext = useFolderContextStore((s) => s.getFolderContext(categoryId, categoryName));
  const isGenerating = useFolderContextStore((s) => s.isGenerating);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadContext();
  }, [categoryId]);

  const loadContext = async () => {
    setLoading(true);
    const res = await contextService.getFolderContext(categoryId, categoryName);
    if (res.isSuccess && res.data) {
      useFolderContextStore.getState().setFolderContext(categoryId, res.data);
    }
    setLoading(false);
  };

  const handleGenerateOrRefresh = async () => {
    useFolderContextStore.getState().setGenerating(true);
    const res = await contextService.generateFolderContext(categoryId);
    if (res.isSuccess && res.data) {
      useFolderContextStore.getState().setFolderContext(categoryId, res.data);
    }
    useFolderContextStore.getState().setGenerating(false);
  };

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
            {categoryName} Context
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            AI Executive Intelligence
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleGenerateOrRefresh}
          disabled={isGenerating}
          style={[styles.refreshBtn, { backgroundColor: `${theme.colors.primary}20` }]}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Icon name="refresh-outline" size={20} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. Executive Summary */}
        <ModernCard style={styles.summaryCard}>
          <View style={styles.sectionHeading}>
            <Icon name="sparkles" size={20} color={theme.colors.primary} />
            <Text style={[styles.headingText, { color: theme.colors.textPrimary }]}>
              Executive Summary
            </Text>
          </View>
          <Text style={[styles.summaryBody, { color: theme.colors.textPrimary }]}>
            {folderContext.summary ||
              `This folder contains structured records for ${categoryName}. Tap refresh to generate real-time AI contextual extraction from your saved screenshots.`}
          </Text>
        </ModernCard>

        {/* 2. Key Topics & Entities */}
        {folderContext.keywords.length > 0 && (
          <ModernCard style={styles.card}>
            <View style={styles.sectionHeading}>
              <Icon name="pricetags-outline" size={18} color={theme.colors.secondary} />
              <Text style={[styles.headingText, { color: theme.colors.textPrimary }]}>
                Extracted Topics & Entities
              </Text>
            </View>
            <View style={styles.chipsWrap}>
              {folderContext.keywords.map((topic, i) => (
                <TagChip key={i} label={topic} colorHex={theme.colors.primary} />
              ))}
            </View>
          </ModernCard>
        )}

        {/* 3. Action Items Checklist */}
        {folderContext.tasks.length > 0 && (
          <ModernCard style={styles.card}>
            <View style={styles.sectionHeading}>
              <Icon name="checkbox-outline" size={18} color={theme.colors.success} />
              <Text style={[styles.headingText, { color: theme.colors.textPrimary }]}>
                Action Items
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

        {/* 4. Timeline & Dates */}
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
          <Text style={styles.chatCtaText}>Ask Context AI about this Folder</Text>
        </TouchableOpacity>
      </View>
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
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  },
  summaryBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  taskTitle: {
    fontSize: 14,
    marginLeft: 10,
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
    paddingVertical: 14,
    borderRadius: 14,
  },
  chatCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
});
