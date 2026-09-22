jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 34,
    select: (obj: any) => obj.android,
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
    },
    check: jest.fn(),
    request: jest.fn(),
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openSettings: jest.fn().mockResolvedValue(true),
  },
}));

import { voiceSearchService } from '../services/voiceSearchService';
import { permissionService } from '../services/permissionService';
import { useSearchStore } from '../store/search.store';
import { globalSearchService } from '../services/GlobalSearchService';

jest.mock('../services/permissionService', () => ({
  permissionService: {
    checkAudioPermission: jest.fn(),
    requestAudioPermission: jest.fn(),
  },
}));

jest.mock('../services/GlobalSearchService', () => ({
  globalSearchService: {
    searchGlobal: jest.fn().mockResolvedValue({
      results: [
        {
          id: 'sc-01',
          screenshot: {
            id: 'sc-01',
            fileName: 'amazon_invoice.png',
            filePath: 'file:///path/amazon_invoice.png',
          },
          relevanceScore: 0.95,
          snippet: 'Amazon Invoice #10293',
          matchedKeywords: ['invoice', 'amazon'],
        },
      ],
      groupedResults: {},
      aiAnswer: null,
      isOffline: false,
    }),
  },
}));

jest.mock('../database/repositories/searchRepository', () => ({
  searchRepository: {
    getRecentSearches: jest.fn().mockResolvedValue([]),
    getSavedSearches: jest.fn().mockResolvedValue([]),
    saveRecentSearch: jest.fn().mockResolvedValue(undefined),
    saveCustomSearch: jest.fn().mockResolvedValue(undefined),
    deleteRecentSearch: jest.fn().mockResolvedValue(undefined),
    deleteSavedSearch: jest.fn().mockResolvedValue(undefined),
    clearRecentSearches: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('VoiceSearchService & Voice Search Integration (Sprint P2-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSearchStore.setState({
      query: '',
      lastVoiceQuery: null,
      isVoiceModalOpen: false,
      results: [],
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  describe('normalizeVoiceQuery', () => {
    it('strips common conversational filler phrases from voice input', () => {
      expect(voiceSearchService.normalizeVoiceQuery('Can you find all invoices from Amazon?')).toBe(
        'invoices from Amazon'
      );
      expect(voiceSearchService.normalizeVoiceQuery('Show me all UPI payments')).toBe(
        'UPI payments'
      );
      expect(voiceSearchService.normalizeVoiceQuery('Please search for flight bookings.')).toBe(
        'flight bookings'
      );
      expect(voiceSearchService.normalizeVoiceQuery('Where is my passport screenshot?')).toBe(
        'passport screenshot'
      );
      expect(voiceSearchService.normalizeVoiceQuery('Look for shopping receipts')).toBe(
        'shopping receipts'
      );
    });

    it('preserves direct query without filler', () => {
      expect(voiceSearchService.normalizeVoiceQuery('Amazon UPI payment')).toBe('Amazon UPI payment');
      expect(voiceSearchService.normalizeVoiceQuery('Flutter code')).toBe('Flutter code');
    });

    it('handles empty or whitespace strings', () => {
      expect(voiceSearchService.normalizeVoiceQuery('')).toBe('');
      expect(voiceSearchService.normalizeVoiceQuery('   ')).toBe('');
    });
  });

  describe('PRESET_VOICE_QUERIES', () => {
    it('includes essential category presets', () => {
      const presets = voiceSearchService.PRESET_VOICE_QUERIES;
      expect(presets.length).toBeGreaterThanOrEqual(4);

      const categories = presets.map((p) => p.category);
      expect(categories).toContain('Finance');
      expect(categories).toContain('Shopping');
      expect(categories).toContain('Development');
    });
  });

  describe('ensureAudioPermission', () => {
    it('returns true if permission is already granted', async () => {
      (permissionService.checkAudioPermission as jest.Mock).mockResolvedValue(true);

      const granted = await voiceSearchService.ensureAudioPermission();
      expect(granted).toBe(true);
      expect(permissionService.requestAudioPermission).not.toHaveBeenCalled();
    });

    it('requests permission if not yet granted', async () => {
      (permissionService.checkAudioPermission as jest.Mock).mockResolvedValue(false);
      (permissionService.requestAudioPermission as jest.Mock).mockResolvedValue(true);

      const granted = await voiceSearchService.ensureAudioPermission();
      expect(granted).toBe(true);
      expect(permissionService.requestAudioPermission).toHaveBeenCalled();
    });
  });

  describe('getRandomWaveformHeights', () => {
    it('returns 5 valid height values for waveform visualizer', () => {
      const heights = voiceSearchService.getRandomWaveformHeights();
      expect(heights).toHaveLength(5);
      heights.forEach((h) => {
        expect(h).toBeGreaterThan(0);
        expect(typeof h).toBe('number');
      });
    });
  });

  describe('useSearchStore.executeVoiceSearch', () => {
    it('normalizes speech query, updates state, and triggers global search', async () => {
      const rawVoiceInput = 'Can you find all invoices from Amazon?';

      await useSearchStore.getState().executeVoiceSearch(rawVoiceInput);

      const state = useSearchStore.getState();
      expect(state.query).toBe('invoices from Amazon');
      expect(state.lastVoiceQuery).toBe('Can you find all invoices from Amazon?');
      expect(state.isVoiceModalOpen).toBe(false);

      expect(globalSearchService.searchGlobal).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'invoices from Amazon',
        })
      );
    });

    it('toggles isVoiceModalOpen correctly', () => {
      expect(useSearchStore.getState().isVoiceModalOpen).toBe(false);
      useSearchStore.getState().setVoiceModalOpen(true);
      expect(useSearchStore.getState().isVoiceModalOpen).toBe(true);
      useSearchStore.getState().setVoiceModalOpen(false);
      expect(useSearchStore.getState().isVoiceModalOpen).toBe(false);
    });
  });
});
