import { useState, useEffect, useCallback } from 'react';
import { vaultApi } from '../api/vaultApi';
import { Category, PagedScreenshots, ScreenshotFilters } from '../types/vault';
import { errorService } from '../services/errorService';

/**
 * Custom hook to interact with Vault screenshots and categories.
 */
export function useVault(initialFilters: ScreenshotFilters = {}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [screenshotsData, setScreenshotsData] = useState<PagedScreenshots | null>(null);
  const [filters, setFilters] = useState<ScreenshotFilters>(initialFilters);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await vaultApi.listCategories(true);
      setCategories(res.data || []);
    } catch (err) {
      console.warn('Could not load categories:', err);
    }
  }, []);

  const fetchScreenshots = useCallback(async (currentFilters: ScreenshotFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await vaultApi.listScreenshots(currentFilters);
      setScreenshotsData(res.data);
    } catch (err) {
      const parsed = errorService.parse(err);
      setError(parsed.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchScreenshots(filters);
  }, [fetchScreenshots, filters]);

  const updateFilters = useCallback((newFilters: Partial<ScreenshotFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      // Reset to page 1 if changing search or category
      page: newFilters.page ?? (newFilters.searchTerm !== undefined || newFilters.categoryId !== undefined ? 1 : prev.page),
    }));
  }, []);

  const refetch = useCallback(() => {
    fetchCategories();
    fetchScreenshots(filters);
  }, [fetchCategories, fetchScreenshots, filters]);

  return {
    categories,
    screenshotsData,
    screenshots: screenshotsData?.items || [],
    totalCount: screenshotsData?.totalCount || 0,
    page: screenshotsData?.page || 1,
    totalPages: screenshotsData?.totalPages || 1,
    isLoading,
    error,
    filters,
    updateFilters,
    refetch,
  };
}
