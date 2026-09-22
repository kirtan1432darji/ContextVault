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
  filters?: any;
  lastUsedAt?: string;
  useCount?: number;
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

  private async ensureSavedSearchColumns(): Promise<void> {
    try {
      await databaseService.executeCommand(`ALTER TABLE saved_searches ADD COLUMN filters_json TEXT`);
    } catch {}
    try {
      await databaseService.executeCommand(`ALTER TABLE saved_searches ADD COLUMN last_used_at TEXT`);
    } catch {}
    try {
      await databaseService.executeCommand(`ALTER TABLE saved_searches ADD COLUMN use_count INTEGER DEFAULT 0`);
    } catch {}
  }

  /**
   * Pins or saves a search for quick 1-tap access.
   */
  async savePinnedSearch(
    query: string,
    title?: string,
    iconName = 'bookmark-outline',
    colorHex = '#6366F1',
    filters?: any
  ): Promise<void> {
    const trimmed = (query || '').trim();
    if (!trimmed) return;

    const id = `saved_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const displayTitle = title || trimmed;
    const now = new Date().toISOString();

    if (filters !== undefined) {
      await this.ensureSavedSearchColumns();
      const filtersJson = JSON.stringify(filters);
      try {
        await databaseService.executeCommand(
          `INSERT INTO saved_searches (id, query, title, icon_name, color_hex, created_at, filters_json, last_used_at, use_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
           ON CONFLICT(query) DO UPDATE SET
             title = excluded.title,
             icon_name = excluded.icon_name,
             color_hex = excluded.color_hex,
             filters_json = excluded.filters_json`,
          [id, trimmed, displayTitle, iconName, colorHex, now, filtersJson, now]
        );
        return;
      } catch {}
    }

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
        `SELECT * FROM saved_searches ORDER BY created_at DESC`
      );

      return rows.map((r: any) => {
        let filters: any = undefined;
        try {
          if (r.filters_json) filters = JSON.parse(r.filters_json);
        } catch {}

        return {
          id: r.id,
          query: r.query,
          title: r.title || r.query,
          iconName: r.icon_name || 'bookmark-outline',
          colorHex: r.color_hex || '#6366F1',
          createdAt: r.created_at,
          filters,
          lastUsedAt: r.last_used_at,
          useCount: r.use_count || 0,
        };
      });
    } catch (err) {
      console.warn('[SearchRepository] Failed to get saved searches:', err);
      return [];
    }
  }

  /**
   * Increments the use count of a saved search and updates last_used_at.
   */
  async incrementSavedSearchUse(idOrQuery: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await databaseService.executeCommand(
        `UPDATE saved_searches 
         SET use_count = coalesce(use_count, 0) + 1, last_used_at = ? 
         WHERE id = ? OR query = ?`,
        [now, idOrQuery, idOrQuery]
      );
    } catch {}
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
   * Updates an existing saved search entry (title, icon, color).
   */
  async updateSavedSearch(
    id: string,
    updates: { title?: string; iconName?: string; colorHex?: string; filters?: any }
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title.trim());
    }
    if (updates.iconName !== undefined) {
      fields.push('icon_name = ?');
      values.push(updates.iconName);
    }
    if (updates.colorHex !== undefined) {
      fields.push('color_hex = ?');
      values.push(updates.colorHex);
    }
    if (updates.filters !== undefined) {
      fields.push('filters_json = ?');
      values.push(JSON.stringify(updates.filters));
    }

    if (fields.length === 0) return;

    values.push(id);
    try {
      await databaseService.executeCommand(
        `UPDATE saved_searches SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    } catch (err) {
      console.warn('[SearchRepository] Failed to update saved search:', err);
    }
  }

  /**
   * Retrieves a saved search by exact query text.
   */
  async getSavedSearchByQuery(query: string): Promise<SavedSearchItem | null> {
    const trimmed = (query || '').trim();
    if (!trimmed) return null;

    try {
      const rows = await databaseService.executeQuery(
        `SELECT * FROM saved_searches WHERE query = ? LIMIT 1`,
        [trimmed]
      );
      if (!rows || rows.length === 0) return null;
      const r = rows[0];
      let filters: any = undefined;
      try {
        if (r.filters_json) filters = JSON.parse(r.filters_json);
      } catch {}

      return {
        id: r.id,
        query: r.query,
        title: r.title || r.query,
        iconName: r.icon_name || 'bookmark-outline',
        colorHex: r.color_hex || '#6366F1',
        createdAt: r.created_at,
        filters,
        lastUsedAt: r.last_used_at,
        useCount: r.use_count || 0,
      };
    } catch (err) {
      console.warn('[SearchRepository] Error getSavedSearchByQuery:', err);
      return null;
    }
  }

  /**
   * Retrieves a saved search by ID.
   */
  async getSavedSearchById(id: string): Promise<SavedSearchItem | null> {
    if (!id) return null;

    try {
      const rows = await databaseService.executeQuery(
        `SELECT * FROM saved_searches WHERE id = ? LIMIT 1`,
        [id]
      );
      if (!rows || rows.length === 0) return null;
      const r = rows[0];
      let filters: any = undefined;
      try {
        if (r.filters_json) filters = JSON.parse(r.filters_json);
      } catch {}

      return {
        id: r.id,
        query: r.query,
        title: r.title || r.query,
        iconName: r.icon_name || 'bookmark-outline',
        colorHex: r.color_hex || '#6366F1',
        createdAt: r.created_at,
        filters,
        lastUsedAt: r.last_used_at,
        useCount: r.use_count || 0,
      };
    } catch (err) {
      console.warn('[SearchRepository] Error getSavedSearchById:', err);
      return null;
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
