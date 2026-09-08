import { databaseService } from '../database';

export interface RecentSearchItem {
  id: string;
  query: string;
  timestamp: string;
  resultCount: number;
}

export interface SavedSearchItem {
  id: string;
  query: string;
  title: string;
  iconName: string;
  colorHex: string;
  createdAt: string;
}

export class SearchRepository {
  /**
   * Saves or updates a recent search entry.
   * Maintains uniqueness by query and limits total history to 25 items.
   */
  async saveRecentSearch(query: string, resultCount = 0): Promise<void> {
    const trimmed = (query || '').trim();
    if (!trimmed) return;

    const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    try {
      // Upsert: update timestamp and resultCount if already exists
      await databaseService.executeCommand(
        `INSERT INTO recent_searches (id, query, timestamp, result_count)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(query) DO UPDATE SET
           timestamp = excluded.timestamp,
           result_count = excluded.result_count`,
        [id, trimmed, now, resultCount]
      );

      // Keep only top 25 recent searches
      await databaseService.executeCommand(
        `DELETE FROM recent_searches
         WHERE id NOT IN (
           SELECT id FROM recent_searches
           ORDER BY timestamp DESC
           LIMIT 25
         )`
      );
    } catch (err) {
      console.warn('[SearchRepository] Failed to save recent search:', err);
    }
  }

  /**
   * Retrieves recent searches ordered by latest first.
   */
  async getRecentSearches(limit = 15): Promise<RecentSearchItem[]> {
    try {
      const rows = await databaseService.executeQuery(
        `SELECT id, query, timestamp, result_count
         FROM recent_searches
         ORDER BY timestamp DESC
         LIMIT ?`,
        [limit]
      );

      return rows.map((r: any) => ({
        id: r.id,
        query: r.query,
        timestamp: r.timestamp,
        resultCount: r.result_count || 0,
      }));
    } catch (err) {
      console.warn('[SearchRepository] Failed to load recent searches:', err);
      return [];
    }
  }

  /**
   * Deletes a single recent search entry by ID or query text.
   */
  async deleteRecentSearch(idOrQuery: string): Promise<void> {
    try {
      await databaseService.executeCommand(
        `DELETE FROM recent_searches WHERE id = ? OR query = ?`,
        [idOrQuery, idOrQuery]
      );
    } catch (err) {
      console.warn('[SearchRepository] Failed to delete recent search:', err);
    }
  }

  /**
   * Clears all recent search history.
   */
  async clearRecentSearches(): Promise<void> {
    try {
      await databaseService.executeCommand(`DELETE FROM recent_searches`);
    } catch (err) {
      console.warn('[SearchRepository] Failed to clear recent searches:', err);
    }
  }

  /**
   * Pins or saves a search for quick 1-tap access.
   */
  async savePinnedSearch(
    query: string,
    title?: string,
    iconName = 'bookmark-outline',
    colorHex = '#6366F1'
  ): Promise<void> {
    const trimmed = (query || '').trim();
    if (!trimmed) return;

    const id = `saved_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const displayTitle = title || trimmed;
    const now = new Date().toISOString();

    try {
      await databaseService.executeCommand(
        `INSERT INTO saved_searches (id, query, title, icon_name, color_hex, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(query) DO UPDATE SET
           title = excluded.title,
           icon_name = excluded.icon_name,
           color_hex = excluded.color_hex`,
        [id, trimmed, displayTitle, iconName, colorHex, now]
      );
    } catch (err) {
      console.warn('[SearchRepository] Failed to save pinned search:', err);
    }
  }

  /**
   * Retrieves all saved / pinned searches.
   */
  async getSavedSearches(): Promise<SavedSearchItem[]> {
    try {
      const rows = await databaseService.executeQuery(
        `SELECT id, query, title, icon_name, color_hex, created_at
         FROM saved_searches
         ORDER BY created_at DESC`
      );

      return rows.map((r: any) => ({
        id: r.id,
        query: r.query,
        title: r.title || r.query,
        iconName: r.icon_name || 'bookmark-outline',
        colorHex: r.color_hex || '#6366F1',
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.warn('[SearchRepository] Failed to get saved searches:', err);
      return [];
    }
  }

  /**
   * Removes a saved / pinned search by ID or query text.
   */
  async deleteSavedSearch(idOrQuery: string): Promise<void> {
    try {
      await databaseService.executeCommand(
        `DELETE FROM saved_searches WHERE id = ? OR query = ?`,
        [idOrQuery, idOrQuery]
      );
    } catch (err) {
      console.warn('[SearchRepository] Failed to delete saved search:', err);
    }
  }

  /**
   * Checks whether a query is already saved / pinned.
   */
  async isSearchSaved(query: string): Promise<boolean> {
    const trimmed = (query || '').trim();
    if (!trimmed) return false;

    try {
      const rows = await databaseService.executeQuery(
        `SELECT 1 FROM saved_searches WHERE query = ? LIMIT 1`,
        [trimmed]
      );
      return rows.length > 0;
    } catch (err) {
      console.warn('[SearchRepository] Error checking isSearchSaved:', err);
      return false;
    }
  }
}

export const searchRepository = new SearchRepository();
