import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { ModernCard } from '../components/ModernCard';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { TagChip } from '../components/TagChip';
import { visionAIService } from '../vision/VisionAIService';
import { visionModelManager } from '../vision/VisionModelManager';
import { visionRepository } from '../database/repositories/VisionRepository';
import { screenshotRepository } from '../database/repositories/screenshotRepository';
import { VisionInferenceResult, VisionScene } from '../vision/types';
import { useVisionStore } from '../store/vision.store';

type Props = NativeStackScreenProps<RootStackParamList, 'VisionDebug'>;

interface ScenarioPreset {
  id: string;
  name: string;
  icon: string;
  fileName: string;
  filePath: string;
  ocrText: string;
}

const PRESET_SCENARIOS: ScenarioPreset[] = [
  {
    id: 'amazon',
    name: 'Scenario 1: Amazon Order',
    icon: 'cart-outline',
    fileName: 'amazon_order_mouse.png',
    filePath: 'content://media/external/images/media/101',
    ocrText: 'Amazon.in Order Placed\nLogitech MX Master 3S Wireless Mouse\n₹7,499\nOrder # 403-1234567\nArriving Tuesday 12 Sep 2026\nBuy Again',
  },
  {
    id: 'phonepe',
    name: 'Scenario 2: PhonePe UPI',
    icon: 'card-outline',
    fileName: 'phonepe_payment_receipt.png',
    filePath: 'content://media/external/images/media/102',
    ocrText: 'PhonePe\nPayment Successful\n₹1,250\nPaid to Star Supermarket\nUPI Transaction ID: 3245987124\n12 Sep 2026, 08:30 PM\nShare Receipt',
  },
  {
    id: 'vscode',
    name: 'Scenario 3: VS Code Error',
    icon: 'code-slash-outline',
    fileName: 'vscode_stacktrace.png',
    filePath: 'content://media/external/images/media/103',
    ocrText: 'VS Code - ContextVault\nsrc/api/apiClient.ts\nTypeError: Cannot read properties of undefined (reading "baseURL")\nat new ApiClient (apiClient.ts:45)\nat Object.<anonymous> (index.ts:12)',
  },
  {
    id: 'whatsapp',
    name: 'Scenario 4: WhatsApp Chat',
    icon: 'chatbubble-ellipses-outline',
    fileName: 'whatsapp_dev_discussion.png',
    filePath: 'content://media/external/images/media/104',
    ocrText: 'WhatsApp\nContextVault Core Team\nKirtan: Vision AI pipeline is ready for v1.1 release\nArjun: Outstanding! Testing with Groq & Gemini keys.\n12 Sep 2026',
  },
];

export const VisionDebugScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();
  const apiKeys = useVisionStore((s) => s.apiKeys);

  const [selectedScenario, setSelectedScenario] = useState<ScenarioPreset>(PRESET_SCENARIOS[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<VisionInferenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dbScreenshots, setDbScreenshots] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'presets' | 'database'>('presets');

  const loadScreenshots = useCallback(async () => {
    try {
      const items = await screenshotRepository.getAllScreenshots({ limit: 10 });
      setDbScreenshots(items);
    } catch {
      // Ignored if empty
    }
  }, []);

  useEffect(() => {
    loadScreenshots();
  }, [loadScreenshots]);

  const handleRunVision = async (forceRefresh = false) => {
    setIsRunning(true);
    setError(null);

    try {
      const res = await visionAIService.analyzeScreenshot({
        screenshotId: selectedScenario.id,
        filePath: selectedScenario.filePath,
        fileName: selectedScenario.fileName,
        ocrText: selectedScenario.ocrText,
        forceRefresh,
      });

      if (res.isSuccess && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || 'Vision AI inference returned no output');
      }
    } catch (err: any) {
      setError(err?.message || 'Vision AI processing failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleClearCache = async () => {
    try {
      await visionRepository.deleteVisionResult(selectedScenario.id);
      setResult(null);
      Alert.alert('Cache Cleared', `Removed SQLite vision cache for ${selectedScenario.name}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to clear cache');
    }
  };

  const handleShareJson = () => {
    if (!result) return;
    Share.share({
      message: JSON.stringify(result.scene, null, 2),
      title: `Vision AI Result - ${result.scene.application}`,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: theme.colors.card }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-back" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            Vision AI Debugger
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Version 1.1 Foundation • Offline + Multi-Key Failover
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleShareJson}
          disabled={!result}
          style={[styles.actionIconBtn, { opacity: result ? 1 : 0.4 }]}
        >
          <Icon name="share-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Dynamic API Keys Status Card */}
        <ModernCard style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Icon name="key-outline" size={18} color="#8B5CF6" />
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary, marginLeft: 8 }]}>
                Dynamic API Key Failover Pool ({apiKeys.length} Keys)
              </Text>
            </View>
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>AUTO FAILOVER</Text>
            </View>
          </View>
          <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
            Configured in <Text style={{ fontFamily: 'monospace' }}>vision_api_keys.json</Text>. If Key 1 fails or rates limit, the engine automatically falls over to Key 2, 3, 4, then Local Offline Heuristics.
          </Text>

          <View style={styles.keysList}>
            {apiKeys.map((k, i) => (
              <View
                key={k.id || i}
                style={[
                  styles.keyRow,
                  {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor:
                      result?.provider === k.provider ? theme.colors.success : theme.colors.border,
                  },
                ]}
              >
                <View style={styles.keyLeft}>
                  <Text style={[styles.keyIndex, { color: theme.colors.primary }]}>#{i + 1}</Text>
                  <View style={{ marginLeft: 8 }}>
                    <Text style={[styles.keyProvider, { color: theme.colors.textPrimary }]}>
                      {k.provider.toUpperCase()} • {k.model}
                    </Text>
                    <Text style={[styles.keyMasked, { color: theme.colors.textMuted }]}>
                      {k.apiKey.substring(0, 8)}••••••••{k.apiKey.substring(k.apiKey.length - 6)}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        (k.errorCount || 0) > 0 ? '#EF444420' : '#10B98120',
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: (k.errorCount || 0) > 0 ? '#EF4444' : '#10B981',
                    }}
                  >
                    {(k.errorCount || 0) > 0 ? `${k.errorCount} ERR` : 'READY'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ModernCard>

        {/* Scenario Selector */}
        <ModernCard style={styles.card}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              onPress={() => setActiveTab('presets')}
              style={[
                styles.tabButton,
                activeTab === 'presets' && {
                  borderBottomColor: theme.colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === 'presets' ? theme.colors.primary : theme.colors.textSecondary,
                  },
                ]}
              >
                Sprint V01 Scenarios (1-4)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('database')}
              style={[
                styles.tabButton,
                activeTab === 'database' && {
                  borderBottomColor: theme.colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === 'database' ? theme.colors.primary : theme.colors.textSecondary,
                  },
                ]}
              >
                Device SQLite ({dbScreenshots.length})
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'presets' ? (
            <View style={styles.presetGrid}>
              {PRESET_SCENARIOS.map((p) => {
                const isSelected = selectedScenario.id === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedScenario(p)}
                    style={[
                      styles.presetCard,
                      {
                        backgroundColor: isSelected
                          ? `${theme.colors.primary}15`
                          : theme.colors.surfaceVariant,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                  >
                    <Icon
                      name={p.icon}
                      size={22}
                      color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.presetName,
                        {
                          color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              {dbScreenshots.length === 0 ? (
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, padding: 8 }}>
                  No screenshots in SQLite database yet.
                </Text>
              ) : (
                dbScreenshots.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() =>
                      setSelectedScenario({
                        id: item.id,
                        name: item.fileName || 'Screenshot',
                        icon: 'image-outline',
                        fileName: item.fileName || 'screenshot.png',
                        filePath: item.localPath || item.filePath,
                        ocrText: item.ocrText || '',
                      })
                    }
                    style={[
                      styles.dbRow,
                      {
                        backgroundColor:
                          selectedScenario.id === item.id
                            ? `${theme.colors.primary}15`
                            : theme.colors.surfaceVariant,
                        borderColor:
                          selectedScenario.id === item.id
                            ? theme.colors.primary
                            : theme.colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: theme.colors.textPrimary, fontSize: 13 }} numberOfLines={1}>
                      {item.fileName}
                    </Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                      {item.categoryName}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={() => handleRunVision(false)}
              disabled={isRunning}
              style={[styles.primaryRunBtn, { backgroundColor: theme.colors.primary }]}
            >
              {isRunning ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryRunBtnText}>Run Vision AI</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleRunVision(true)}
              disabled={isRunning}
              style={[styles.secondaryBtn, { borderColor: theme.colors.border }]}
            >
              <Icon name="refresh" size={16} color={theme.colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClearCache}
              disabled={isRunning}
              style={[styles.secondaryBtn, { borderColor: theme.colors.border }]}
            >
              <Icon name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </ModernCard>

        {/* Error View */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: '#EF444415', borderColor: '#EF4444' }]}>
            <Icon name="alert-circle" size={20} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Results View */}
        {result && (
          <>
            {/* Visual Metadata Summary Card */}
            <ModernCard style={styles.card}>
              <View style={styles.resultHeader}>
                <View>
                  <Text style={[styles.resultApp, { color: theme.colors.textPrimary }]}>
                    {result.scene.application}
                  </Text>
                  <Text style={[styles.resultType, { color: theme.colors.primary }]}>
                    {result.scene.screenType.toUpperCase()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <ConfidenceBadge confidence={result.scene.confidence} />
                  <Text style={[styles.timeBadge, { color: theme.colors.textSecondary }]}>
                    {result.processingTimeMs} ms • {result.cached ? 'SQLite Cache' : result.provider}
                  </Text>
                </View>
              </View>

              <Text style={[styles.resultSummary, { color: theme.colors.textPrimary }]}>
                {result.scene.summary}
              </Text>

              {/* Detected Objects */}
              {result.scene.objects.length > 0 && (
                <View style={styles.chipsSection}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                    DETECTED OBJECTS
                  </Text>
                  <View style={styles.chipsRow}>
                    {result.scene.objects.map((obj, i) => (
                      <TagChip key={i} label={obj} selected={false} />
                    ))}
                  </View>
                </View>
              )}

              {/* Detected Logos */}
              {result.scene.detectedLogos.length > 0 && (
                <View style={styles.chipsSection}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                    DETECTED LOGOS
                  </Text>
                  <View style={styles.chipsRow}>
                    {result.scene.detectedLogos.map((logo, i) => (
                      <View
                        key={i}
                        style={[
                          styles.logoBadge,
                          { backgroundColor: `${theme.colors.primary}20`, borderColor: theme.colors.primary },
                        ]}
                      >
                        <Icon name="shield-checkmark" size={12} color={theme.colors.primary} />
                        <Text style={[styles.logoBadgeText, { color: theme.colors.primary }]}>
                          {logo}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ModernCard>

            {/* Parsed Entities Card */}
            <ModernCard style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Icon name="finger-print-outline" size={18} color="#10B981" />
                  <Text style={[styles.cardTitle, { color: theme.colors.textPrimary, marginLeft: 8 }]}>
                    Parsed Visual Entities
                  </Text>
                </View>
              </View>

              {Object.keys(result.scene.entities).length === 0 ? (
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                  No structured entities extracted for this screen.
                </Text>
              ) : (
                <View style={styles.entityTable}>
                  {Object.entries(result.scene.entities).map(([k, v]) => (
                    <View
                      key={k}
                      style={[
                        styles.entityRow,
                        { borderBottomColor: theme.colors.border, borderBottomWidth: 1 },
                      ]}
                    >
                      <Text style={[styles.entityKey, { color: theme.colors.textSecondary }]}>
                        {k}
                      </Text>
                      <Text
                        style={[styles.entityVal, { color: theme.colors.textPrimary }]}
                        selectable
                      >
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ModernCard>

            {/* Raw JSON View */}
            <ModernCard style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Icon name="code-working" size={18} color="#F59E0B" />
                  <Text style={[styles.cardTitle, { color: theme.colors.textPrimary, marginLeft: 8 }]}>
                    Raw Model JSON Output
                  </Text>
                </View>
              </View>
              <View style={styles.jsonContainer}>
                <Text style={styles.jsonCode} selectable>
                  {JSON.stringify(result.scene, null, 2)}
                </Text>
              </View>
            </ModernCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
  },
  actionIconBtn: {
    padding: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF620',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B5CF6',
    marginRight: 4,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  helperText: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  keysList: {
    marginTop: 4,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  keyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  keyIndex: {
    fontSize: 12,
    fontWeight: '800',
  },
  keyProvider: {
    fontSize: 11,
    fontWeight: '700',
  },
  keyMasked: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F020',
    marginBottom: 12,
  },
  tabButton: {
    paddingVertical: 8,
    marginRight: 16,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetCard: {
    width: '48%',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  presetName: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  dbRow: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  primaryRunBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryRunBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  resultApp: {
    fontSize: 18,
    fontWeight: '800',
  },
  resultType: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  timeBadge: {
    fontSize: 10,
    marginTop: 4,
  },
  resultSummary: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  chipsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  logoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  entityTable: {
    marginTop: 4,
  },
  entityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  entityKey: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  entityVal: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  jsonContainer: {
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  jsonCode: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#38BDF8',
    lineHeight: 16,
  },
});
