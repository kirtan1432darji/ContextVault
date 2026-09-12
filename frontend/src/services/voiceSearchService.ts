import { permissionService } from './permissionService';
import { loggerService } from './loggerService';

export type VoiceListeningState =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'processing'
  | 'recognized'
  | 'error';

export interface VoiceQueryPreset {
  id: string;
  query: string;
  category: string;
  icon: string;
  badge?: string;
}

export class VoiceSearchService {
  private currentState: VoiceListeningState = 'idle';

  /**
   * Recommended voice query prompts organized by domain.
   */
  readonly PRESET_VOICE_QUERIES: VoiceQueryPreset[] = [
    {
      id: 'p1',
      query: 'Show all UPI payments',
      category: 'Finance',
      icon: 'card-outline',
      badge: 'Popular',
    },
    {
      id: 'p2',
      query: 'Find invoices from Amazon',
      category: 'Shopping',
      icon: 'receipt-outline',
    },
    {
      id: 'p3',
      query: 'Show shopping items under ₹1000',
      category: 'Shopping',
      icon: 'pricetag-outline',
    },
    {
      id: 'p4',
      query: 'Find Flutter code and error screenshots',
      category: 'Development',
      icon: 'code-slash-outline',
    },
    {
      id: 'p5',
      query: 'Find passport, tickets and bookings',
      category: 'Travel',
      icon: 'airplane-outline',
    },
    {
      id: 'p6',
      query: 'Show medical prescriptions and lab reports',
      category: 'Health',
      icon: 'fitness-outline',
    },
  ];

  /**
   * Conversational filler prefixes to strip for optimal OCR index searching.
   */
  private readonly FILLER_PREFIXES = [
    /^(please\s+)?(can\s+you\s+)?(could\s+you\s+)?(find|show\s+me|search\s+for|look\s+for|get|list)\s+(all\s+)?(my\s+)?(the\s+)?/i,
    /^(where\s+is\s+my|where\s+are\s+the|find\s+screenshots\s+of)\s+/i,
    /^(show\s+all|find\s+all)\s+/i,
  ];

  getState(): VoiceListeningState {
    return this.currentState;
  }

  setState(state: VoiceListeningState): void {
    this.currentState = state;
  }

  /**
   * Checks and requests audio record permission.
   */
  async ensureAudioPermission(): Promise<boolean> {
    try {
      const hasPermission = await permissionService.checkAudioPermission();
      if (hasPermission) return true;

      return await permissionService.requestAudioPermission();
    } catch (err) {
      loggerService.warn('App', 'Failed ensuring audio permission for voice search', err);
      return false;
    }
  }

  /**
   * Cleans conversational voice transcript into an optimized search query.
   * Example: "Can you find all invoices from Amazon" -> "invoices Amazon"
   */
  normalizeVoiceQuery(rawTranscript: string): string {
    if (!rawTranscript) return '';

    let cleaned = rawTranscript.trim();

    // Remove conversational filler prefixes
    for (const prefix of this.FILLER_PREFIXES) {
      cleaned = cleaned.replace(prefix, '');
    }

    // Remove punctuation at end
    cleaned = cleaned.replace(/[?.!]+$/, '').trim();

    return cleaned || rawTranscript.trim();
  }

  /**
   * Generates randomized waveform height values for live audio visualizer.
   */
  getRandomWaveformHeights(): number[] {
    return [
      Math.floor(Math.random() * 28) + 10,
      Math.floor(Math.random() * 42) + 14,
      Math.floor(Math.random() * 52) + 18,
      Math.floor(Math.random() * 38) + 12,
      Math.floor(Math.random() * 24) + 8,
    ];
  }
}

export const voiceSearchService = new VoiceSearchService();
