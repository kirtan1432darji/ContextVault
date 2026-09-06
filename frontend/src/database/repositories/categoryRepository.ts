import { databaseService } from '../database';
import { CategoryModel } from '../../models';

export class CategoryRepository {
  async getAllCategories(): Promise<CategoryModel[]> {
    const rows = await databaseService.executeQuery(
      'SELECT * FROM categories ORDER BY order_index ASC'
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

  async getOrCreateCategory({
    id,
    name,
    parentId,
    iconName = 'folder-outline',
    colorHex = '6366F1',
    description = '',
  }: {
    id: string;
    name: string;
    parentId?: string;
    iconName?: string;
    colorHex?: string;
    description?: string;
  }): Promise<CategoryModel> {
    const existing = await this.getCategoryById(id);
    if (existing) return existing;

    await databaseService.executeCommand(
      `INSERT INTO categories (id, name, parent_id, icon_name, color_hex, description, is_system, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, parentId || null, iconName, colorHex, description, 0, 50]
    );

    return {
      id,
      name,
      parentId,
      iconName,
      colorHex,
      description,
      isSystem: false,
      orderIndex: 50,
      screenshotCount: 0,
      subCategories: [],
    };
  }

  private mapRowToModel(row: any): CategoryModel {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      iconName: row.icon_name || 'folder-outline',
      colorHex: row.color_hex || '6366F1',
      description: row.description || '',
      isSystem: Boolean(row.is_system),
      orderIndex: row.order_index || 0,
      screenshotCount: 0,
      subCategories: [],
    };
  }
}

export const categoryRepository = new CategoryRepository();
