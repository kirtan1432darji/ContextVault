import { create } from 'zustand';
import {
  GlobalSearchResultItem,
  SearchFilterState,
  AIAnswerCardData,
  RecentSearchItem,
  SavedSearchItem,
} from '../models';
import { globalSearchService } from '../services/GlobalSearchService';
import { searchRepository } from '../database/repositories/searchRepository';
import { voiceSearchService } from '../services/voiceSearchService';

interface SearchState {
  query: string;
  activeFilters: SearchFilterState;
  loading: boolean;
  isOffline: boolean;
  results: GlobalSearchResultItem[];
  groupedResults: Record<string, GlobalSearchResultItem[]>;
  aiAnswer: AIAnswerCardData | null;
  recentSearches: RecentSearchItem[];
  savedSearches: SavedSearchItem[];
  isVoiceModalOpen: boolean;
  lastVoiceQuery: string | null;
  isSaveModalOpen: boolean;
  editingSavedSearch: SavedSearchItem | null;
  saveModalInitialQuery: string;

  // Actions
  setQuery: (q: string) => void;
  setFilter: (patch: Partial<SearchFilterState>) => void;
  resetFilters: () => void;
  executeSearch: (customQuery?: string, customFilters?: SearchFilterState) => Promise<void>;
  loadRecentAndSavedSearches: () => Promise<void>;
  deleteRecentSearch: (id: string) => Promise<void>;
  clearAllRecentSearches: () => Promise<void>;
  savePinnedSearch: (query: string, title?: string, iconName?: string, colorHex?: string) => Promise<void>;
  updateSavedSearch: (id: string, updates: { title?: string; iconName?: string; colorHex?: string }) => Promise<void>;
  deleteSavedSearch: (idOrQuery: string) => Promise<void>;
  toggleSaveSearch: (query: string, title?: string) => Promise<void>;
  openSaveModal: (query: string, existing?: SavedSearchItem | null) => void;
  closeSaveModal: () => void;
  setVoiceModalOpen: (open: boolean) => void;
  executeVoiceSearch: (recognizedText: string) => Promise<void>;
}

const DEFAULT_FILTERS: SearchFilterState = {
  folderId: 'all',
  dateRange: 'all',
  sourceApp: 'all',
  onlyFavorites: false,
  onlyNeedsReview: false,
};

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const searchCache = new Map<string, any>();

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  activeFilters: DEFAULT_FILTERS,
  loading: false,
  isOffline: false,
  results: [],
  groupedResults: {},
  aiAnswer: null,
  recentSearches: [],
  savedSearches: [],
  isVoiceModalOpen: false,
  lastVoiceQuery: null,
  isSaveModalOpen: false,
  editingSavedSearch: null,
  saveModalInitialQuery: '',

  setQuery: (q: string) => {
    set({ query: q });

    if (debounceTimer) clearTimeout(debounceTimer);

    if (!q.trim()) {
      set({
        results: [],
        groupedResults: {},
        aiAnswer: null,
        loading: false,
      });
      return;
    }

    set({ loading: true });
    debounceTimer = setTimeout(() => {
      get().executeSearch(q);
    }, 350);
  },

  setFilter: (patch: Partial<SearchFilterState>) => {
    const updated = { ...get().activeFilters, ...patch };
    set({ activeFilters: updated });
    if (get().query.trim()) {
      get().executeSearch(get().query, updated);
    }
  },

  resetFilters: () => {
    set({ activeFilters: DEFAULT_FILTERS });
    if (get().query.trim()) {
      get().executeSearch(get().query, DEFAULT_FILTERS);
    }
  },

  executeSearch: async (customQuery?: string, customFilters?: SearchFilterState) => {
    const q = customQuery !== undefined ? customQuery : get().query;
    const filters = customFilters !== undefined ? customFilters : get().activeFilters;

    const trimmed = (q || '').trim();
    if (!trimmed) {
      set({
        results: [],
        groupedResults: {},
        aiAnswer: null,
        loading: false,
      });
      return;
    }

    const cacheKey = `${trimmed.toLowerCase()}_${JSON.stringify(filters)}`;
    if (searchCache.has(cacheKey)) {
      const cached = searchCache.get(cacheKey);
      set({
        results: cached.results,
        groupedResults: cached.groupedResults,
        aiAnswer: cached.aiAnswer,
        isOffline: cached.isOffline,
        loading: false,
      });
      return;
    }

    set({ loading: true });

    try {
      const outcome = await globalSearchService.searchGlobal({ query: trimmed, filters });
      searchCache.set(cacheKey, outcome);

      set({
        results: outcome.results,
        groupedResults: outcome.groupedResults,
        aiAnswer: outcome.aiAnswer,
        isOffline: outcome.isOffline,
        loading: false,
      });

      // Refresh recent searches list in store
      get().loadRecentAndSavedSearches();
    } catch (err) {
      console.warn('[useSearchStore] Search error:', err);
      set({ loading: false });
    }
  },

  loadRecentAndSavedSearches: async () => {
    try {
      const [recent, saved] = await Promise.all([
        searchRepository.getRecentSearches(15),
        searchRepository.getSavedSearches(),
      ]);
      set({ recentSearches: recent, savedSearches: saved });
    } catch (err) {
      console.warn('[useSearchStore] Failed to load searches:', err);
    }
  },

  deleteRecentSearch: async (id: string) => {
    await searchRepository.deleteRecentSearch(id);
    const recent = await searchRepository.getRecentSearches(15);
    set({ recentSearches: recent });
  },

  clearAllRecentSearches: async () => {
    await searchRepository.clearRecentSearches();
    set({ recentSearches: [] });
  },

  savePinnedSearch: async (query: string, title?: string, iconName?: string, colorHex?: string) => {
    await searchRepository.savePinnedSearch(query, title, iconName, colorHex);
    const saved = await searchRepository.getSavedSearches();
    set({ savedSearches: saved, isSaveModalOpen: false, editingSavedSearch: null });
  },

  updateSavedSearch: async (id: string, updates: { title?: string; iconName?: string; colorHex?: string }) => {
    await searchRepository.updateSavedSearch(id, updates);
    const saved = await searchRepository.getSavedSearches();
    set({ savedSearches: saved, isSaveModalOpen: false, editingSavedSearch: null });
  },

  deleteSavedSearch: async (idOrQuery: string) => {
    await searchRepository.deleteSavedSearch(idOrQuery);
    const saved = await searchRepository.getSavedSearches();
    set({ savedSearches: saved, isSaveModalOpen: false, editingSavedSearch: null });
  },

  toggleSaveSearch: async (query: string, title?: string) => {
    const isSaved = await searchRepository.isSearchSaved(query);
    if (isSaved) {
      await searchRepository.deleteSavedSearch(query);
    } else {
      await searchRepository.savePinnedSearch(query, title);
    }
    const saved = await searchRepository.getSavedSearches();
    set({ savedSearches: saved });
  },

  openSaveModal: (query: string, existing?: SavedSearchItem | null) => {
    set({
      isSaveModalOpen: true,
      saveModalInitialQuery: query,
      editingSavedSearch: existing || null,
    });
  },

  closeSaveModal: () => {
    set({
      isSaveModalOpen: false,
      editingSavedSearch: null,
      saveModalInitialQuery: '',
    });
  },

  setVoiceModalOpen: (open: boolean) => {
    set({ isVoiceModalOpen: open });
  },

  executeVoiceSearch: async (recognizedText: string) => {
    const normalized = voiceSearchService.normalizeVoiceQuery(recognizedText);
    set({
      query: normalized,
      lastVoiceQuery: recognizedText,
      isVoiceModalOpen: false,
    });
    await get().executeSearch(normalized);
  },
}));

