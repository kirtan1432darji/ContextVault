import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';

interface VoiceSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSpeechResult: (recognizedText: string) => void;
}

export const VoiceSearchModal: React.FC<VoiceSearchModalProps> = ({
  visible,
  onClose,
  onSpeechResult,
}) => {
  const theme = useAppTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(10)).current;
  const waveAnim2 = useRef(new Animated.Value(16)).current;
  const waveAnim3 = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (visible) {
      // Pulsing circle animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Simulated wave bar animations
      const createWave = (anim: Animated.Value, max: number, duration: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: max,
              duration,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 8,
              duration,
              useNativeDriver: false,
            }),
          ])
        );

      const anim1 = createWave(waveAnim1, 36, 500);
      const anim2 = createWave(waveAnim2, 48, 650);
      const anim3 = createWave(waveAnim3, 32, 400);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        pulseAnim.stopAnimation();
        waveAnim1.stopAnimation();
        waveAnim2.stopAnimation();
        waveAnim3.stopAnimation();
      };
    }
  }, [visible]);

  const SAMPLE_QUERIES = [
    'Show all UPI payments',
    'Find invoices from Amazon',
    'Show shopping items under ₹500',
    'Find Flutter screenshots from last week',
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Ask ContextVault by Voice
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Pulsing Mic Visual */}
          <View style={styles.micCenterContainer}>
            <Animated.View
              style={[
                styles.pulseOuter,
                {
                  backgroundColor: `${theme.colors.primary}20`,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <View style={[styles.micCircle, { backgroundColor: theme.colors.primary }]}>
                <Icon name="mic" size={32} color="#FFFFFF" />
              </View>
            </Animated.View>

            {/* Audio Waveform Simulator */}
            <View style={styles.waveBarContainer}>
              <Animated.View style={[styles.waveBar, { height: waveAnim1, backgroundColor: theme.colors.primary }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim2, backgroundColor: theme.colors.accent }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim3, backgroundColor: theme.colors.primary }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim2, backgroundColor: theme.colors.accent }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim1, backgroundColor: theme.colors.primary }]} />
            </View>

            <Text style={[styles.statusText, { color: theme.colors.textPrimary }]}>
              Listening for your question...
            </Text>
            <Text style={[styles.subStatusText, { color: theme.colors.textSecondary }]}>
              Speak naturally about any payment, code, receipt, or topic
            </Text>
          </View>

          {/* Quick Speech Prompts */}
          <View style={styles.suggestionsContainer}>
            <Text style={[styles.suggestionsTitle, { color: theme.colors.textSecondary }]}>
              OR TAP A VOICE QUERY
            </Text>
            {SAMPLE_QUERIES.map((sample, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  onSpeechResult(sample);
                  onClose();
                }}
                style={[
                  styles.samplePrompt,
                  {
                    backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9',
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Icon name="chatbubble-outline" size={13} color={theme.colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.samplePromptText, { color: theme.colors.textPrimary }]}>
                  "{sample}"
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bottom Cancel / Keyboard Fallback */}
          <TouchableOpacity
            onPress={onClose}
            style={[styles.keyboardBtn, { borderColor: theme.colors.border }]}
          >
            <Icon name="keypad-outline" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.keyboardBtnText, { color: theme.colors.primary }]}>
              Type with Keyboard Instead
            </Text>
          </TouchableOpacity>
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
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  micCenterContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  pulseOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  micCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#6366F1',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  waveBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    marginBottom: 12,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  subStatusText: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
  suggestionsContainer: {
    marginTop: 20,
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  samplePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  samplePromptText: {
    fontSize: 13,
    fontWeight: '500',
  },
  keyboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  keyboardBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
