import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { DEVELOPER_MODE } from '../config/developerConfig';

export const DeveloperModeBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [isMinimized, setIsMinimized] = useState(false);

  if (!DEVELOPER_MODE) {
    return null;
  }

  if (isMinimized) {
    return (
      <TouchableOpacity
        style={[styles.minimizedPill, { top: Math.max(insets.top, 8) + 4 }]}
        onPress={() => setIsMinimized(false)}
        activeOpacity={0.8}
      >
        <Icon name="construct" size={12} color="#92400E" style={{ marginRight: 4 }} />
        <Text style={styles.minimizedText}>DEV MODE</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Icon name="construct" size={16} color="#92400E" />
        </View>
        <View style={styles.textWrapper}>
          <Text style={styles.title}>🛠 Developer Mode Enabled</Text>
          <Text style={styles.subtitle}>Authentication Bypassed</Text>
        </View>
        <TouchableOpacity
          style={styles.minimizeBtn}
          onPress={() => setIsMinimized(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="chevron-up" size={14} color="#92400E" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 6,
    paddingTop: 2,
  },
  iconWrapper: {
    marginRight: 8,
  },
  textWrapper: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '500',
    color: '#B45309',
  },
  minimizeBtn: {
    padding: 4,
    borderRadius: 10,
    backgroundColor: '#FDE68A',
  },
  minimizedPill: {
    position: 'absolute',
    right: 10,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  minimizedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
});
