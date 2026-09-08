import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { ModernCard } from '../ModernCard';
import { AIAnswerCardData, DetectedEntity } from '../../models';

interface AIAnswerCardProps {
  data: AIAnswerCardData;
  loading?: boolean;
  onSelectFollowUp?: (suggestion: string) => void;
}

export const AIAnswerCard: React.FC<AIAnswerCardProps> = ({
  data,
  loading = false,
  onSelectFollowUp,
}) => {
  const theme = useAppTheme();

  const renderEntityIcon = (type: DetectedEntity['type']) => {
    switch (type) {
      case 'amount':
        return 'cash-outline';
      case 'merchant':
        return 'storefront-outline';
      case 'order':
        return 'receipt-outline';
      case 'date':
        return 'calendar-outline';
      case 'code':
        return 'code-slash-outline';
      default:
        return 'pricetag-outline';
    }
  };

  return (
    <ModernCard style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.sparkleIconBox, { backgroundColor: `${theme.colors.primary}20` }]}>
            <Icon name="sparkles" size={16} color={theme.colors.primary} />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Context AI Answer
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Synthesized across your vault
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {data.isOffline && (
            <View style={[styles.offlinePill, { backgroundColor: `${theme.colors.warning}20` }]}>
              <Icon name="cloud-offline-outline" size={11} color={theme.colors.warning} style={{ marginRight: 3 }} />
              <Text style={[styles.offlinePillText, { color: theme.colors.warning }]}>Offline</Text>
            </View>
          )}
          <View style={[styles.matchCountPill, { backgroundColor: `${theme.colors.primary}18` }]}>
            <Text style={[styles.matchCountText, { color: theme.colors.primary }]}>
              {data.matchCount} match{data.matchCount !== 1 ? 'es' : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Answer Body */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Synthesizing intelligence across screenshots...
          </Text>
        </View>
      ) : (
        <Text style={[styles.summaryText, { color: theme.colors.textPrimary }]}>
          {data.summary}
        </Text>
      )}

      {/* Detected Entities */}
      {data.entities && data.entities.length > 0 && (
        <View style={styles.entitiesSection}>
          <Text style={[styles.entitiesSectionTitle, { color: theme.colors.textSecondary }]}>
            KEY IDENTIFIERS
          </Text>
          <View style={styles.entitiesWrap}>
            {data.entities.map((entity, index) => (
              <View
                key={`${entity.label}_${index}`}
                style={[
                  styles.entityChip,
                  {
                    backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9',
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Icon
                  name={renderEntityIcon(entity.type)}
                  size={12}
                  color={entity.type === 'amount' ? theme.colors.success : theme.colors.primary}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.entityLabel, { color: theme.colors.textSecondary }]}>
                  {entity.label}:
                </Text>
                <Text
                  style={[
                    styles.entityValue,
                    {
                      color:
                        entity.type === 'amount' ? theme.colors.success : theme.colors.textPrimary,
                    },
                  ]}
                >
                  {entity.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Suggested Follow-up Prompts */}
      {data.suggestedFollowUps && data.suggestedFollowUps.length > 0 && (
        <View style={styles.followUpSection}>
          <Text style={[styles.followUpTitle, { color: theme.colors.textSecondary }]}>
            SUGGESTED EXPLORATIONS
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.followUpScroll}>
            {data.suggestedFollowUps.map((prompt, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => onSelectFollowUp?.(prompt)}
                style={[
                  styles.followUpChip,
                  {
                    backgroundColor: theme.isDark ? '#1E293B80' : '#FFFFFF',
                    borderColor: `${theme.colors.primary}40`,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Icon name="search-outline" size={12} color={theme.colors.primary} style={{ marginRight: 5 }} />
                <Text style={[styles.followUpText, { color: theme.colors.textPrimary }]}>
                  {prompt}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </ModernCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sparkleIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  offlinePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  matchCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  matchCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  loadingText: {
    fontSize: 13,
    marginLeft: 10,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  entitiesSection: {
    marginTop: 4,
    marginBottom: 12,
  },
  entitiesSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  entitiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  entityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  entityLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 4,
  },
  entityValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  followUpSection: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#64748B30',
  },
  followUpTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  followUpScroll: {
    flexDirection: 'row',
  },
  followUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  followUpText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
