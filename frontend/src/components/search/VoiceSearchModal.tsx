import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme';
import { voiceSearchService, VoiceListeningState } from '../../services/voiceSearchService';

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
  const [listeningState, setListeningState] = useState<VoiceListeningState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean>(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(10)).current;
  const waveAnim2 = useRef(new Animated.Value(16)).current;
  const waveAnim3 = useRef(new Animated.Value(24)).current;
  const waveAnim4 = useRef(new Animated.Value(18)).current;
  const waveAnim5 = useRef(new Animated.Value(12)).current;

  // Pulse & Wave Animations
  useEffect(() => {
    let animPulse: Animated.CompositeAnimation | null = null;
    let anim1: Animated.CompositeAnimation | null = null;
    let anim2: Animated.CompositeAnimation | null = null;
    let anim3: Animated.CompositeAnimation | null = null;
    let anim4: Animated.CompositeAnimation | null = null;
    let anim5: Animated.CompositeAnimation | null = null;

    if (visible && (listeningState === 'listening' || listeningState === 'idle')) {
      animPulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.22,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      animPulse.start();

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

      anim1 = createWave(waveAnim1, 36, 450);
      anim2 = createWave(waveAnim2, 48, 600);
      anim3 = createWave(waveAnim3, 56, 380);
      anim4 = createWave(waveAnim4, 44, 520);
      anim5 = createWave(waveAnim5, 32, 400);

      anim1.start();
      anim2.start();
      anim3.start();
      anim4.start();
      anim5.start();
    } else {
      pulseAnim.setValue(1);
      waveAnim1.setValue(8);
      waveAnim2.setValue(8);
      waveAnim3.setValue(8);
      waveAnim4.setValue(8);
      waveAnim5.setValue(8);
    }

    return () => {
      animPulse?.stop();
      anim1?.stop();
      anim2?.stop();
      anim3?.stop();
      anim4?.stop();
      anim5?.stop();
    };
  }, [visible, listeningState]);

  // Request audio permission and initialize on modal open
  useEffect(() => {
    if (visible) {
      setTranscript('');
      setListeningState('listening');

      voiceSearchService.ensureAudioPermission().then((granted) => {
        setHasPermission(granted);
        if (!granted) {
          setListeningState('idle');
        }
      });
    } else {
      setListeningState('idle');
      setTranscript('');
    }
  }, [visible]);

  const handleMicToggle = () => {
    if (listeningState === 'listening') {
      setListeningState('processing');
      // If we have an active transcript, submit it
      if (transcript.trim()) {
        const normalized = voiceSearchService.normalizeVoiceQuery(transcript);
        onSpeechResult(normalized);
        onClose();
      } else {
        setListeningState('idle');
      }
    } else {
      setListeningState('listening');
    }
  };

  const handleSelectQuery = (rawQuery: string) => {
    const normalized = voiceSearchService.normalizeVoiceQuery(rawQuery);
    setTranscript(normalized);
    setListeningState('recognized');
    setTimeout(() => {
      onSpeechResult(normalized);
      onClose();
    }, 250);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleBox}>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                Ask ContextVault by Voice
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                Natural language screenshot search
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.colors.background }]}>
              <Icon name="close" size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Pulsing Mic Visual Center */}
          <View style={styles.micCenterContainer}>
            <TouchableOpacity activeOpacity={0.85} onPress={handleMicToggle}>
              <Animated.View
                style={[
                  styles.pulseOuter,
                  {
                    backgroundColor: listeningState === 'listening' ? `${theme.colors.primary}25` : `${theme.colors.textMuted}15`,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.micCircle,
                    {
                      backgroundColor:
                        listeningState === 'listening'
                          ? theme.colors.primary
                          : theme.isDark
                          ? '#334155'
                          : '#94A3B8',
                    },
                  ]}
                >
                  <Icon
                    name={listeningState === 'listening' ? 'mic' : 'mic-outline'}
                    size={32}
                    color="#FFFFFF"
                  />
                </View>
              </Animated.View>
            </TouchableOpacity>

            {/* Dynamic Audio Waveform Visualizer */}
            <View style={styles.waveBarContainer}>
              <Animated.View style={[styles.waveBar, { height: waveAnim1, backgroundColor: theme.colors.primary }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim2, backgroundColor: theme.colors.accent }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim3, backgroundColor: theme.colors.primary }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim4, backgroundColor: theme.colors.accent }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim5, backgroundColor: theme.colors.primary }]} />
            </View>

            {/* Listening Status & Live Transcript */}
            <Text style={[styles.statusText, { color: theme.colors.textPrimary }]}>
              {transcript
                ? `"${transcript}"`
                : listeningState === 'listening'
                ? 'Listening for your question...'
                : 'Tap microphone to speak'}
            </Text>

            <Text style={[styles.subStatusText, { color: theme.colors.textSecondary }]}>
              {!hasPermission
                ? 'Microphone permission disabled. Select a quick query below.'
                : 'Speak naturally: receipts, payments, flight tickets, code, or shopping'}
            </Text>
          </View>

          {/* Quick Voice Query Suggestions */}
          <View style={styles.suggestionsContainer}>
            <Text style={[styles.suggestionsTitle, { color: theme.colors.textSecondary }]}>
              OR SELECT A VOICE QUERY PRESET
            </Text>
            <ScrollView style={styles.presetsScroll} showsVerticalScrollIndicator={false}>
              {voiceSearchService.PRESET_VOICE_QUERIES.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  onPress={() => handleSelectQuery(preset.query)}
                  style={[
                    styles.samplePrompt,
                    {
                      backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC',
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={[styles.presetIconBox, { backgroundColor: `${theme.colors.primary}15` }]}>
                    <Icon name={preset.icon} size={15} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.samplePromptText, { color: theme.colors.textPrimary }]}>
                      "{preset.query}"
                    </Text>
                    <Text style={[styles.presetCategory, { color: theme.colors.textSecondary }]}>
                      {preset.category}
                    </Text>
                  </View>
                  {preset.badge && (
                    <View style={[styles.presetBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                      <Text style={[styles.presetBadgeText, { color: theme.colors.primary }]}>
                        {preset.badge}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Bottom Cancel / Keyboard Fallback */}
          <TouchableOpacity
            onPress={onClose}
            style={[styles.keyboardBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
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
    padding: 20,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleBox: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micCenterContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  pulseOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  micCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  waveBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    marginBottom: 8,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  subStatusText: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 300,
  },
  suggestionsContainer: {
    marginTop: 12,
    marginBottom: 12,
  },
  suggestionsTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  presetsScroll: {
    maxHeight: 180,
  },
  samplePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  presetIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  samplePromptText: {
    fontSize: 13,
    fontWeight: '600',
  },
  presetCategory: {
    fontSize: 10,
    marginTop: 1,
  },
  presetBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  presetBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  keyboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  keyboardBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
