import { databaseService } from '../database';
import { CategoryModel, FolderStatistics } from '../../models';

export class CategoryRepository {
  async getAllCategories(): Promise<CategoryModel[]> {
    const rows = await databaseService.executeQuery(
      'SELECT * FROM categories ORDER BY is_favorite DESC, order_index ASC, name ASC'
    );
    return rows.map(this.mapRowToModel);
  }

  async getCategoryById(id: string): Promise<CategoryModel | null> {
    const rows = await databaseService.executeQuery(
      'SELECT * FROM categories WHERE id = ? LIMIT 1',
      [id]
    );
    if (rows.length === 0) return null;
    return this.mapRowToModel(rows[0]);
  }

  async getCategoryByName(name: string, parentId: string | null = null): Promise<CategoryModel | null> {
    let sql: string;
    let params: any[];

    if (parentId) {
      sql = 'SELECT * FROM categories WHERE LOWER(name) = LOWER(?) AND (parent_id = ? OR parent_category_id = ?) LIMIT 1';
      params = [name, parentId, parentId];
    } else {
      sql = 'SELECT * FROM categories WHERE LOWER(name) = LOWER(?) AND (parent_id IS NULL OR parent_id = "") LIMIT 1';
      params = [name];
    }

    const rows = await databaseService.executeQuery(sql, params);
    if (rows.length === 0) return null;
    return this.mapRowToModel(rows[0]);
  }

  async getOrCreateCategory({
    id,
    name,
    parentId = null,
    iconName = 'folder-outline',
    colorHex = '6366F1',
    description = '',
    isSystem = false,
  }: {
    id?: string;
    name: string;
    parentId?: string | null;
    iconName?: string;
    colorHex?: string;
    description?: string;
    isSystem?: boolean;
  }): Promise<CategoryModel> {
    const existing = await this.getCategoryByName(name, parentId);
    if (existing) {
      return existing;
    }

    const catId = id || `cat_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;

    // Resolve path
    let path = `/${name}`;
    if (parentId) {
      const parent = await this.getCategoryById(parentId);
      if (parent) {
        path = `${parent.path || `/${parent.name}`}/${name}`;
      }
    }

    const createdOn = new Date().toISOString();

    await databaseService.executeCommand(
      `INSERT OR REPLACE INTO categories (
        id, name, parent_id, parent_category_id, icon_name, icon,
        color_hex, color, description, is_system, order_index,
        screenshot_count, is_favorite, path, created_on
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        catId,
        name,
        parentId,
        parentId,
        iconName,
        iconName,
        colorHex,
        colorHex,
        description,
        isSystem ? 1 : 0,
        50,
        0,
        0,
        path,
        createdOn,
      ]
    );

    return {
      id: catId,
      name,
      parentId,
      parentCategoryId: parentId,
      iconName,
      icon: iconName,
      colorHex,
      color: colorHex,
      description,
      isSystem,
      orderIndex: 50,
      screenshotCount: 0,
      isFavorite: false,
      path,
      createdOn,
      subCategories: [],
    };
  }

  /**
   * Recursively resolves or creates an unlimited nested hierarchy:
   * e.g. ['Projects', 'NHDC', 'Payroll']
   * Returns the final leaf node category.
   */
  async createNestedCategoryHierarchy(
    hierarchyNames: string[],
    defaultIcon = 'folder-outline',
    defaultColor = '6366F1'
  ): Promise<CategoryModel> {
    if (!hierarchyNames || hierarchyNames.length === 0) {
      return (await this.getCategoryById('unsorted')) || (await this.getOrCreateCategory({ name: 'Unsorted', isSystem: true }));
    }

    let currentParentId: string | null = null;
    let currentCategory: CategoryModel | null = null;

    for (let i = 0; i < hierarchyNames.length; i++) {
      const segName = hierarchyNames[i].trim();
      if (!segName) continue;

      const isRoot = i === 0;
      currentCategory = await this.getOrCreateCategory({
        name: segName,
        parentId: currentParentId,
        iconName: isRoot ? defaultIcon : 'folder-outline',
        colorHex: defaultColor,
        description: isRoot ? `${segName} folder collection` : `Subfolder in ${hierarchyNames[i - 1]}`,
        isSystem: false,
      });

      currentParentId = currentCategory.id;
    }

    return currentCategory!;
  }

  async getDescendantCategoryIds(categoryId: string): Promise<string[]> {
    const all = await this.getAllCategories();
    const result: string[] = [categoryId];
    const queue: string[] = [categoryId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = all.filter(
        (c) =>
          (c.parentId === current || c.parentCategoryId === current) &&
          !result.includes(c.id)
      );
      for (const child of children) {
        result.push(child.id);
        queue.push(child.id);
      }
    }
    return result;
  }

  async updateScreenshotCount(categoryId: string): Promise<number> {
    const stats = await this.updateFolderCounts(categoryId);
    return stats.count;
  }

  async updateAllAncestorCounts(categoryId: string): Promise<void> {
    let currentId: string | null = categoryId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      await this.updateFolderCounts(currentId);
      const cat = await this.getCategoryById(currentId);
      currentId = cat?.parentId || cat?.parentCategoryId || null;
    }
  }

  async recalculateAllCounts(): Promise<void> {
    const all = await this.getAllCategories();
    for (const cat of all) {
      await this.updateFolderCounts(cat.id);
    }
  }

  async renameCategory(id: string, newName: string): Promise<void> {
    const cat = await this.getCategoryById(id);
    if (!cat) return;

    let newPath = `/${newName}`;
    if (cat.parentId) {
      const parent = await this.getCategoryById(cat.parentId);
      if (parent) {
        newPath = `${parent.path || `/${parent.name}`}/${newName}`;
      }
    }

    await databaseService.executeCommand(
      'UPDATE categories SET name = ?, path = ? WHERE id = ?',
      [newName, newPath, id]
    );
    await databaseService.executeCommand(
      'UPDATE screenshots SET category_name = ? WHERE category_id = ?',
      [newName, id]
    );
  }

  async moveCategory(id: string, newParentId: string | null): Promise<void> {
    const cat = await this.getCategoryById(id);
    if (!cat) return;

    let newPath = `/${cat.name}`;
    if (newParentId) {
      const parent = await this.getCategoryById(newParentId);
      if (parent) {
        newPath = `${parent.path || `/${parent.name}`}/${cat.name}`;
      }
    }

    await databaseService.executeCommand(
      'UPDATE categories SET parent_id = ?, parent_category_id = ?, path = ? WHERE id = ?',
      [newParentId, newParentId, newPath, id]
    );
  }

  async mergeCategories(sourceId: string, targetId: string): Promise<void> {
    const target = await this.getCategoryById(targetId);
    if (!target) return;

    // Move all screenshots to target category
    await databaseService.executeCommand(
      'UPDATE screenshots SET category_id = ?, category_name = ? WHERE category_id = ?',
      [target.id, target.name, sourceId]
    );

    // Delete source category if not system
    await databaseService.executeCommand(
      'DELETE FROM categories WHERE id = ? AND is_system = 0',
      [sourceId]
    );

    await this.updateScreenshotCount(targetId);
  }

  async toggleFavorite(id: string): Promise<boolean> {
    const cat = await this.getCategoryById(id);
    if (!cat) return false;

    const newFav = cat.isFavorite ? 0 : 1;
    await databaseService.executeCommand(
      'UPDATE categories SET is_favorite = ? WHERE id = ?',
      [newFav, id]
    );
    return newFav === 1;
  }

  async getTopCategories(limit = 6): Promise<CategoryModel[]> {
    const rows = await databaseService.executeQuery(
      'SELECT * FROM categories WHERE id != "unsorted" ORDER BY screenshot_count DESC, is_favorite DESC LIMIT ?',
      [limit]
    );
    return rows.map(this.mapRowToModel);
  }

  async getRecentlyCreated(limit = 6): Promise<CategoryModel[]> {
    const rows = await databaseService.executeQuery(
      'SELECT * FROM categories WHERE id != "unsorted" ORDER BY created_on DESC LIMIT ?',
      [limit]
    );
    return rows.map(this.mapRowToModel);
  }

  async getUnsortedCount(): Promise<number> {
    const rows = await databaseService.executeQuery(
      'SELECT COUNT(*) as count FROM screenshots WHERE category_id = "unsorted" AND (is_deleted = 0 OR is_deleted IS NULL)'
    );
    return rows.length > 0 ? rows[0].count : 0;
  }

  async deleteCategory(id: string): Promise<void> {
    // Reassign screenshots to Unsorted
    await databaseService.executeCommand(
      'UPDATE screenshots SET category_id = "unsorted", category_name = "Unsorted" WHERE category_id = ?',
      [id]
    );
    await databaseService.executeCommand(
      'DELETE FROM categories WHERE id = ? AND is_system = 0',
      [id]
    );
  }

  /**
   * Finds a Smart Folder by its category name (case-insensitive) or matches built-in aliases.
   */
  async getFolderByCategory(categoryName: string): Promise<CategoryModel | null> {
    const clean = (categoryName || '').trim();
    if (!clean) return null;

    let cat = await this.getCategoryByName(clean);
    if (cat) return cat;

    const rows = await databaseService.executeQuery(
      'SELECT * FROM categories WHERE LOWER(name) = LOWER(?) OR LOWER(id) = LOWER(?) LIMIT 1',
      [clean, clean.toLowerCase().replace(/\s+/g, '_')]
    );
    if (rows.length > 0) return this.mapRowToModel(rows[0]);

    return null;
  }

  /**
   * Assigns a screenshot to a specific folder.
   * If isManual is true, flags classification_source as 'manual' and confidence as 1.0.
   */
  async assignScreenshotToFolder(
    screenshotId: string,
    folderId: string,
    isManual = false
  ): Promise<void> {
    const targetFolder = await this.getCategoryById(folderId);
    if (!targetFolder) throw new Error(`Target folder ${folderId} not found.`);

    const now = new Date().toISOString();
    const source = isManual ? 'manual' : 'local';
    const autoCat = isManual ? 0 : 1;

    await databaseService.executeCommand(
      `UPDATE screenshots SET 
        category_id = ?, 
        folder_id = ?, 
        category_name = ?,
        is_auto_categorized = ?,
        classification_source = ?,
        confidence = CASE WHEN ? = 1 THEN 1.0 ELSE confidence END,
        is_reviewed = CASE WHEN ? = 1 THEN 1 ELSE is_reviewed END,
        last_scanned_at = ?
       WHERE id = ?`,
      [
        targetFolder.id,
        targetFolder.id,
        targetFolder.name,
        autoCat,
        source,
        isManual ? 1 : 0,
        isManual ? 1 : 0,
        now,
        screenshotId,
      ]
    );

    // Update folder counts & covers for ancestor hierarchy
    await this.updateAllAncestorCounts(targetFolder.id);
  }

  /**
   * Moves a screenshot from its current folder to targetFolderId.
   * Treats this as a manual override.
   */
  async moveScreenshot(screenshotId: string, targetFolderId: string): Promise<void> {
    const oldScreenshot = await databaseService.executeQuery(
      'SELECT category_id, folder_id FROM screenshots WHERE id = ? LIMIT 1',
      [screenshotId]
    );
    const oldFolderId = oldScreenshot.length > 0 ? (oldScreenshot[0].folder_id || oldScreenshot[0].category_id) : null;

    await this.assignScreenshotToFolder(screenshotId, targetFolderId, true);

    if (oldFolderId && oldFolderId !== targetFolderId) {
      await this.updateAllAncestorCounts(oldFolderId);
    }
  }

  /**
   * Automatically calculates or manually sets a folder cover image.
   * Selection Rules:
   * 1. Manual cover override if explicitly provided / set
   * 2. Favorite screenshot with highest confidence
   * 3. Highest confidence screenshot
   * 4. Latest screenshot
   */
  async updateFolderCover(
    folderId: string,
    coverUri?: string,
    manualOverride = false
  ): Promise<string | null> {
    if (manualOverride && coverUri) {
      await databaseService.executeCommand(
        'UPDATE categories SET manual_cover_uri = ?, cover_uri = ?, updated_at = ? WHERE id = ?',
        [coverUri, coverUri, new Date().toISOString(), folderId]
      );
      return coverUri;
    }

    const cat = await this.getCategoryById(folderId);
    if (cat?.manualCoverUri) {
      return cat.manualCoverUri;
    }

    const descendantIds = await this.getDescendantCategoryIds(folderId);
    const placeholders = descendantIds.map(() => '?').join(',');

    const query = `
      SELECT coalesce(thumbnail_uri, content_uri, local_path, file_path) as uri,
             is_favorite, confidence, created_at
      FROM screenshots
      WHERE (coalesce(folder_id, category_id) IN (${placeholders}))
        AND (is_deleted = 0 OR is_deleted IS NULL)
        AND (coalesce(thumbnail_uri, content_uri, local_path, file_path) IS NOT NULL)
      ORDER BY is_favorite DESC, confidence DESC, created_at DESC
      LIMIT 1
    `;

    const rows = await databaseService.executeQuery(query, descendantIds);
    const chosenCover = rows.length > 0 ? rows[0].uri : null;

    await databaseService.executeCommand(
      'UPDATE categories SET cover_uri = ?, updated_at = ? WHERE id = ?',
      [chosenCover, new Date().toISOString(), folderId]
    );

    return chosenCover;
  }

  /**
   * Updates screenshot count, storage size, average confidence, and cover for a folder.
   */
  async updateFolderCounts(folderId: string): Promise<{ count: number; storageSize: number; avgConfidence: number }> {
    const descendantIds = await this.getDescendantCategoryIds(folderId);
    const placeholders = descendantIds.map(() => '?').join(',');

    const statsSql = `
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(file_size), 0) as storage_size,
        COALESCE(AVG(confidence), 0.0) as avg_conf
      FROM screenshots
      WHERE (coalesce(folder_id, category_id) IN (${placeholders}))
        AND (is_deleted = 0 OR is_deleted IS NULL)
    `;

    const rows = await databaseService.executeQuery(statsSql, descendantIds);
    const count = rows.length > 0 ? Number(rows[0].count) : 0;
    const storageSize = rows.length > 0 ? Number(rows[0].storage_size) : 0;
    const avgConfidence = rows.length > 0 ? Number(rows[0].avg_conf) : 0.0;
    const now = new Date().toISOString();

    await databaseService.executeCommand(
      `UPDATE categories SET 
        screenshot_count = ?,
        storage_size_bytes = ?,
        average_confidence = ?,
        updated_at = ?
       WHERE id = ?`,
      [count, storageSize, avgConfidence, now, folderId]
    );

    await this.updateFolderCover(folderId);

    return { count, storageSize, avgConfidence };
  }

  /**
   * Compiles comprehensive statistics for a folder.
   */
  async getFolderStatistics(folderId: string): Promise<FolderStatistics> {
    const cat = await this.getCategoryById(folderId);
    const descendantIds = await this.getDescendantCategoryIds(folderId);
    const placeholders = descendantIds.map(() => '?').join(',');

    const statsQuery = `
      SELECT 
        COUNT(*) as count,
        SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as fav_count,
        SUM(CASE WHEN ocr_status = 'completed' THEN 1 ELSE 0 END) as ocr_count,
        SUM(CASE WHEN (SELECT 1 FROM vision_cache WHERE vision_cache.screenshot_id = screenshots.id LIMIT 1) = 1 THEN 1 ELSE 0 END) as vision_count,
        COALESCE(AVG(confidence), 0.0) as avg_confidence,
        COALESCE(SUM(file_size), 0) as storage_size,
        MAX(created_at) as last_created
      FROM screenshots
      WHERE (coalesce(folder_id, category_id) IN (${placeholders}))
        AND (is_deleted = 0 OR is_deleted IS NULL)
    `;

    const rows = await databaseService.executeQuery(statsQuery, descendantIds);
    const r = rows[0] || {};

    return {
      categoryId: folderId,
      categoryName: cat?.name || 'Smart Folder',
      screenshotCount: Number(r.count || 0),
      favoriteCount: Number(r.fav_count || 0),
      ocrCount: Number(r.ocr_count || 0),
      visionCount: Number(r.vision_count || 0),
      averageConfidence: Number(r.avg_confidence || 0.0),
      storageSizeBytes: Number(r.storage_size || 0),
      lastAnalysisTime: r.last_created || cat?.updatedAt || null,
      coverUri: cat?.coverUri || null,
      manualCoverUri: cat?.manualCoverUri || null,
    };
  }

  /**
   * Returns categories sorted by screenshot count or recently updated/created.
   */
  async getSortedFolders(sortBy: 'count' | 'recent' = 'count', limit = 20): Promise<CategoryModel[]> {
    const orderClause =
      sortBy === 'recent'
        ? 'coalesce(updated_at, created_on) DESC, screenshot_count DESC'
        : 'screenshot_count DESC, is_favorite DESC, name ASC';

    const rows = await databaseService.executeQuery(
      `SELECT * FROM categories WHERE id != "unsorted" ORDER BY ${orderClause} LIMIT ?`,
      [limit]
    );
    return rows.map(this.mapRowToModel);
  }

  /**
   * Rebuilds all smart folders, recalculates ancestor counts, and selects covers.
   */
  async rebuildSmartFolders(): Promise<{ processed: number; updated: number }> {
    const allCategories = await this.getAllCategories();
    for (const cat of allCategories) {
      await this.updateFolderCounts(cat.id);
    }
    return { processed: allCategories.length, updated: allCategories.length };
  }

  private mapRowToModel(row: any): CategoryModel {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id || row.parent_category_id || null,
      parentCategoryId: row.parent_category_id || row.parent_id || null,
      iconName: row.icon_name || row.icon || 'folder-outline',
      icon: row.icon || row.icon_name || 'folder-outline',
      colorHex: row.color_hex || row.color || '6366F1',
      color: row.color || row.color_hex || '6366F1',
      description: row.description || '',
      isSystem: Boolean(row.is_system),
      orderIndex: row.order_index || 0,
      screenshotCount: row.screenshot_count || 0,
      isFavorite: Boolean(row.is_favorite),
      path: row.path || `/${row.name}`,
      createdOn: row.created_on || new Date().toISOString(),
      updatedAt: row.updated_at || row.created_on || new Date().toISOString(),
      coverUri: row.cover_uri || null,
      manualCoverUri: row.manual_cover_uri || null,
      averageConfidence: row.average_confidence != null ? Number(row.average_confidence) : 0,
      storageSizeBytes: row.storage_size_bytes != null ? Number(row.storage_size_bytes) : 0,
      subCategories: [],
    };
  }
}

export const categoryRepository = new CategoryRepository();
