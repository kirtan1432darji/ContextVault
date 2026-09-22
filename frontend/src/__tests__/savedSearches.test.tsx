jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android ?? obj.default,
  },
  StyleSheet: {
    create: (styles: any) => styles,
    hairlineWidth: 1,
    absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 400, height: 800 })),
  },
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  Modal: 'Modal',
  TextInput: 'TextInput',
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openSettings: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../theme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      background: '#FFFFFF',
      card: '#FFFFFF',
      border: '#E5E7EB',
      primary: '#1A73E8',
      secondary: '#5F6368',
      accent: '#188038',
      success: '#188038',
      warning: '#F29900',
      error: '#D93025',
      textPrimary: '#202124',
      textSecondary: '#5F6368',
      textMuted: '#80868B',
    },
  }),
}));

import { databaseService } from '../database';
import { searchRepository } from '../database/repositories/searchRepository';
import { useSearchStore } from '../store/search.store';
import { getSmartPresetForQuery, SAVED_SEARCH_ICONS, SAVED_SEARCH_COLORS } from '../components/search/SaveSearchModal';
import { SEARCH_PRESETS } from '../components/search/RecentAndSavedSearches';

describe('ContextVault Sprint P2-2 — Saved Searches & History Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSearchStore.setState({
      query: '',
      results: [],
      recentSearches: [],
      savedSearches: [],
      isSaveModalOpen: false,
      editingSavedSearch: null,
      saveModalInitialQuery: '',
    });
  });

  describe('1. SearchRepository — Recent Searches Management', () => {
    it('saves recent search query with timestamp and caps history at 25 items', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);

      await searchRepository.saveRecentSearch('Amazon invoice 2026', 5);

      // 1. First command is the upsert
      expect(executeCommandSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO recent_searches'),
        [expect.stringMatching(/^rec_/), 'Amazon invoice 2026', expect.any(String), 5]
      );

      // 2. Second command enforces 25-item ceiling
      expect(executeCommandSpy).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('DELETE FROM recent_searches')
      );
    });

    it('ignores empty or whitespace query when saving recent search', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);

      await searchRepository.saveRecentSearch('   ');
      expect(executeCommandSpy).not.toHaveBeenCalled();
    });

    it('retrieves recent searches ordered by latest timestamp descending', async () => {
      const mockRows = [
        { id: 'rec_1', query: 'Electricity bill', timestamp: '2026-09-12T10:00:00Z', result_count: 3 },
        { id: 'rec_2', query: 'Flight ticket Goa', timestamp: '2026-09-12T09:00:00Z', result_count: 1 },
      ];

      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue(mockRows as any);

      const items = await searchRepository.getRecentSearches(10);
      expect(items).toHaveLength(2);
      expect(items[0].query).toBe('Electricity bill');
      expect(items[0].resultCount).toBe(3);
      expect(items[1].query).toBe('Flight ticket Goa');
    });

    it('deletes a single recent search by ID or query text', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);

      await searchRepository.deleteRecentSearch('rec_123');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        'DELETE FROM recent_searches WHERE id = ? OR query = ?',
        ['rec_123', 'rec_123']
      );
    });

    it('clears all recent search history', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);

      await searchRepository.clearRecentSearches();

      expect(executeCommandSpy).toHaveBeenCalledWith('DELETE FROM recent_searches');
    });
  });

  describe('2. SearchRepository — Saved & Pinned Searches CRUD', () => {
    it('saves a pinned search with custom title, icon, and accent color', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);

      await searchRepository.savePinnedSearch(
        'UPI payment merchant',
        'Merchant Payments',
        'card-outline',
        '#6366F1'
      );

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO saved_searches'),
        [
          expect.stringMatching(/^saved_/),
          'UPI payment merchant',
          'Merchant Payments',
          'card-outline',
          '#6366F1',
          expect.any(String),
        ]
      );
    });

    it('updates an existing saved search title, icon, and color', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);

      await searchRepository.updateSavedSearch('saved_99', {
        title: 'Updated Title',
        iconName: 'receipt-outline',
        colorHex: '#10B981',
      });

      expect(executeCommandSpy).toHaveBeenCalledWith(
        'UPDATE saved_searches SET title = ?, icon_name = ?, color_hex = ? WHERE id = ?',
        ['Updated Title', 'receipt-outline', '#10B981', 'saved_99']
      );
    });

    it('retrieves saved searches ordered by created_at DESC', async () => {
      const mockSaved = [
        {
          id: 'saved_1',
          query: 'Amazon Invoices',
          title: 'Amazon Receipts',
          icon_name: 'receipt-outline',
          color_hex: '#10B981',
          created_at: '2026-09-12T08:00:00Z',
        },
      ];

      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue(mockSaved as any);

      const items = await searchRepository.getSavedSearches();
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Amazon Receipts');
      expect(items[0].iconName).toBe('receipt-outline');
      expect(items[0].colorHex).toBe('#10B981');
    });

    it('finds saved search by exact query text or ID', async () => {
      const mockItem = [
        {
          id: 'saved_2',
          query: 'Flight ticket',
          title: 'Upcoming Flights',
          icon_name: 'airplane-outline',
          color_hex: '#EC4899',
          created_at: '2026-09-12T07:00:00Z',
        },
      ];

      jest.spyOn(databaseService, 'executeQuery').mockResolvedValue(mockItem as any);

      const byQuery = await searchRepository.getSavedSearchByQuery('Flight ticket');
      expect(byQuery).not.toBeNull();
      expect(byQuery?.title).toBe('Upcoming Flights');

      const byId = await searchRepository.getSavedSearchById('saved_2');
      expect(byId).not.toBeNull();
      expect(byId?.iconName).toBe('airplane-outline');
    });

    it('checks whether a query is already saved', async () => {
      const executeQuerySpy = jest
        .spyOn(databaseService, 'executeQuery')
        .mockResolvedValueOnce([{ 1: 1 }] as any)
        .mockResolvedValueOnce([] as any);

      const isSaved = await searchRepository.isSearchSaved('Flight ticket');
      expect(isSaved).toBe(true);

      const isNotSaved = await searchRepository.isSearchSaved('Random unknown text');
      expect(isNotSaved).toBe(false);
    });

    it('deletes a saved search by ID or query', async () => {
      const executeCommandSpy = jest
        .spyOn(databaseService, 'executeCommand')
        .mockResolvedValue(undefined as any);

      await searchRepository.deleteSavedSearch('saved_2');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        'DELETE FROM saved_searches WHERE id = ? OR query = ?',
        ['saved_2', 'saved_2']
      );
    });
  });

  describe('3. Zustand Store — useSearchStore Saved & Recent State', () => {
    it('loads recent and saved searches into store', async () => {
      jest.spyOn(searchRepository, 'getRecentSearches').mockResolvedValue([
        { id: 'rec_1', query: 'Tax 2026', timestamp: '2026-09-12T00:00:00Z', resultCount: 2 },
      ]);
      jest.spyOn(searchRepository, 'getSavedSearches').mockResolvedValue([
        {
          id: 'saved_1',
          query: 'Tax 2026',
          title: 'Tax Receipts',
          iconName: 'receipt-outline',
          colorHex: '#10B981',
          createdAt: '2026-09-12T00:00:00Z',
        },
      ]);

      await useSearchStore.getState().loadRecentAndSavedSearches();

      expect(useSearchStore.getState().recentSearches).toHaveLength(1);
      expect(useSearchStore.getState().savedSearches).toHaveLength(1);
      expect(useSearchStore.getState().savedSearches[0].title).toBe('Tax Receipts');
    });

    it('clears all recent searches and updates state to empty', async () => {
      jest.spyOn(searchRepository, 'clearRecentSearches').mockResolvedValue(undefined);

      useSearchStore.setState({
        recentSearches: [
          { id: 'rec_1', query: 'test', timestamp: '2026-09-12T00:00:00Z', resultCount: 0 },
        ],
      });

      await useSearchStore.getState().clearAllRecentSearches();

      expect(useSearchStore.getState().recentSearches).toHaveLength(0);
    });

    it('opens and closes save search modal correctly', () => {
      useSearchStore.getState().openSaveModal('Flutter widget bug');

      expect(useSearchStore.getState().isSaveModalOpen).toBe(true);
      expect(useSearchStore.getState().saveModalInitialQuery).toBe('Flutter widget bug');
      expect(useSearchStore.getState().editingSavedSearch).toBeNull();

      useSearchStore.getState().closeSaveModal();

      expect(useSearchStore.getState().isSaveModalOpen).toBe(false);
      expect(useSearchStore.getState().saveModalInitialQuery).toBe('');
    });

    it('saves pinned search and closes modal', async () => {
      jest.spyOn(searchRepository, 'savePinnedSearch').mockResolvedValue(undefined);
      jest.spyOn(searchRepository, 'getSavedSearches').mockResolvedValue([
        {
          id: 'saved_new',
          query: 'Amazon order',
          title: 'Amazon Purchases',
          iconName: 'cart-outline',
          colorHex: '#F59E0B',
          createdAt: '2026-09-12T00:00:00Z',
        },
      ]);

      useSearchStore.setState({ isSaveModalOpen: true, saveModalInitialQuery: 'Amazon order' });

      await useSearchStore
        .getState()
        .savePinnedSearch('Amazon order', 'Amazon Purchases', 'cart-outline', '#F59E0B');

      expect(useSearchStore.getState().isSaveModalOpen).toBe(false);
      expect(useSearchStore.getState().savedSearches).toHaveLength(1);
      expect(useSearchStore.getState().savedSearches[0].iconName).toBe('cart-outline');
    });
  });

  describe('4. Smart Presets & Color Heuristics', () => {
    it('accurately identifies intelligent presets based on user query keywords', () => {
      // Invoices / Bills -> Receipt & Green
      const invoice = getSmartPresetForQuery('Amazon tax invoice');
      expect(invoice.icon).toBe('receipt-outline');
      expect(invoice.color).toBe('#10B981');

      // UPI / Payment -> Card & Indigo
      const upi = getSmartPresetForQuery('GPay UPI transfer 500');
      expect(upi.icon).toBe('card-outline');
      expect(upi.color).toBe('#6366F1');

      // Dev / Bugs -> Code & Blue
      const code = getSmartPresetForQuery('Flutter error stacktrace');
      expect(code.icon).toBe('code-slash-outline');
      expect(code.color).toBe('#3B82F6');

      // Travel / Tickets -> Airplane & Pink
      const travel = getSmartPresetForQuery('IndiGo flight booking');
      expect(travel.icon).toBe('airplane-outline');
      expect(travel.color).toBe('#EC4899');

      // Shopping / Orders -> Cart & Amber
      const shop = getSmartPresetForQuery('Flipkart order details');
      expect(shop.icon).toBe('cart-outline');
      expect(shop.color).toBe('#F59E0B');

      // IDs / Documents -> Document & Purple
      const doc = getSmartPresetForQuery('Aadhaar card pdf');
      expect(doc.icon).toBe('document-text-outline');
      expect(doc.color).toBe('#8B5CF6');
    });

    it('provides rich palette of curated icons and colors', () => {
      expect(SAVED_SEARCH_ICONS.length).toBeGreaterThanOrEqual(8);
      expect(SAVED_SEARCH_COLORS.length).toBeGreaterThanOrEqual(6);
      expect(SEARCH_PRESETS.length).toBeGreaterThanOrEqual(5);

      // Verify each preset has query, title, and valid icon
      SEARCH_PRESETS.forEach((preset) => {
        expect(preset.title).toBeTruthy();
        expect(preset.query).toBeTruthy();
        expect(preset.icon).toBeTruthy();
        expect(preset.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
  });
});
