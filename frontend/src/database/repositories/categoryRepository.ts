import { databaseService } from '../database';
import { CategoryModel } from '../../models';

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
    const descendantIds = await this.getDescendantCategoryIds(categoryId);
    const placeholders = descendantIds.map(() => '?').join(',');
    const rows = await databaseService.executeQuery(
      `SELECT COUNT(*) as count FROM screenshots WHERE category_id IN (${placeholders}) AND (is_deleted = 0 OR is_deleted IS NULL)`,
      descendantIds
    );
    const count = rows.length > 0 ? rows[0].count : 0;

    await databaseService.executeCommand(
      'UPDATE categories SET screenshot_count = ? WHERE id = ?',
      [count, categoryId]
    );
    return count;
  }

  async updateAllAncestorCounts(categoryId: string): Promise<void> {
    let currentId: string | null = categoryId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      await this.updateScreenshotCount(currentId);
      const cat = await this.getCategoryById(currentId);
      currentId = cat?.parentId || cat?.parentCategoryId || null;
    }
  }

  async recalculateAllCounts(): Promise<void> {
    const all = await this.getAllCategories();
    for (const cat of all) {
      await this.updateScreenshotCount(cat.id);
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
      subCategories: [],
    };
  }
}

export const categoryRepository = new CategoryRepository();
