import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { ScreenshotImageThumbnail } from '../ScreenshotImageThumbnail';
import { MemoryTimelineEvent } from '../../services/memory/types';

interface TimelineCardProps {
  event: MemoryTimelineEvent;
  onPress?: (event: MemoryTimelineEvent) => void;
}

export const TimelineCard: React.FC<TimelineCardProps> = ({ event, onPress }) => {
  const theme = useAppTheme();

  const getCategoryColor = (cat: string): string => {
    const c = (cat || '').toLowerCase();
    if (c.includes('finance') || c.includes('bill')) return '#10B981';
    if (c.includes('shop') || c.includes('order') || c.includes('food')) return '#F59E0B';
    if (c.includes('travel') || c.includes('transit')) return '#06B6D4';
    if (c.includes('chat') || c.includes('social')) return '#8B5CF6';
    if (c.includes('work') || c.includes('doc')) return '#3B82F6';
    if (c.includes('health') || c.includes('med')) return '#EC4899';
    return theme.colors.primary;
  };

  const getAppIcon = (category: string, app?: string): string => {
    const a = (app || '').toLowerCase();
    if (a.includes('phonepe') || a.includes('gpay') || a.includes('paytm') || a.includes('cred')) return 'card-outline';
    if (a.includes('whatsapp') || a.includes('telegram')) return 'chatbubble-ellipses-outline';
    if (a.includes('amazon') || a.includes('swiggy') || a.includes('zomato') || a.includes('flipkart')) return 'bag-handle-outline';
    if (a.includes('irctc') || a.includes('uber') || a.includes('flight')) return 'airplane-outline';

    const c = (category || '').toLowerCase();
    if (c.includes('finance')) return 'cash-outline';
    if (c.includes('shop')) return 'cart-outline';
    if (c.includes('travel')) return 'compass-outline';
    if (c.includes('chat')) return 'chatbubbles-outline';
    if (c.includes('doc')) return 'document-text-outline';
    return 'image-outline';
  };

  const catColor = getCategoryColor(event.category);
  const appIcon = getAppIcon(event.category, event.merchant || event.sourceApp);

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onPress && onPress(event)}
      style={[
        styles.card,
        {
          backgroundColor: theme.isDark ? '#111827' : '#FFFFFF',
          borderColor: theme.isDark ? '#1F2937' : '#E5E7EB',
        },
      ]}
    >
      <View style={styles.thumbnailWrap}>
        <ScreenshotImageThumbnail
          filePath={event.filePath}
          thumbnailUri={event.thumbnailUri}
          contentUri={event.contentUri}
          style={styles.thumbnail}
          borderRadius={10}
        />
        {event.screenshotCount > 1 && (
          <View style={styles.mergedPill}>
            <Text style={styles.mergedText}>+{event.screenshotCount - 1}</Text>
          </View>
        )}
      </View>

      <View style={styles.contentWrap}>
        {/* Top Header: Merchant / App & Time */}
        <View style={styles.topRow}>
          <View style={styles.merchantBadge}>
            <Icon name={appIcon} size={12} color={catColor} style={styles.appIcon} />
            <Text style={[styles.merchantText, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {event.merchant || event.sourceApp || event.categoryName}
            </Text>
          </View>
          <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
            {event.timeStr}
          </Text>
        </View>

        {/* AI Summary */}
        <Text style={[styles.summaryText, { color: theme.colors.textPrimary }]} numberOfLines={2}>
          {event.summary || event.title}
        </Text>

        {/* Bottom Row: Amount Pill, Category, Tags */}
        <View style={styles.bottomRow}>
          {event.amount !== undefined && event.amount > 0 && (
            <View style={styles.amountPill}>
              <Text style={styles.amountText}>
                ₹{Math.round(event.amount).toLocaleString('en-IN')}
              </Text>
            </View>
          )}

          <View style={[styles.categoryPill, { backgroundColor: `${catColor}15`, borderColor: `${catColor}30` }]}>
            <Text style={[styles.categoryText, { color: catColor }]}>
              {event.categoryName}
            </Text>
          </View>

          {event.tags && event.tags.length > 0 && (
            <View style={styles.tagChip}>
              <Text style={[styles.tagText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                #{event.tags[0]}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  thumbnailWrap: {
    position: 'relative',
    marginRight: 12,
  },
  thumbnail: {
    width: 68,
    height: 68,
  },
  mergedPill: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#111827',
  },
  mergedText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contentWrap: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  merchantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  appIcon: {
    marginRight: 4,
  },
  merchantText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  amountPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
  },
  amountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
  },
  tagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 10,
    fontStyle: 'italic',
  },
});
