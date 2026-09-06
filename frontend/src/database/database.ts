import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';
import { DATABASE_NAME, SCHEMA_SQL } from './schema';
import { DEFAULT_CATEGORIES } from '../models/category.model';

SQLite.enablePromise(true);

class DatabaseService {
  private dbInstance: SQLiteDatabase | null = null;
  private isInitializing = false;

  async getDatabase(): Promise<SQLiteDatabase> {
    if (this.dbInstance) {
      return this.dbInstance;
    }

    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (this.dbInstance) return this.dbInstance;
    }

    this.isInitializing = true;
    try {
      this.dbInstance = await SQLite.openDatabase({
        name: DATABASE_NAME,
        location: 'default',
      });

      await this.initSchema(this.dbInstance);
      return this.dbInstance;
    } finally {
      this.isInitializing = false;
    }
  }

  private async initSchema(db: SQLiteDatabase): Promise<void> {
    for (const statement of SCHEMA_SQL) {
      await db.executeSql(statement);
    }

    // Safe column migrations for existing SQLite databases
    const alterStatements = [
      // Categories table migrations (Sprint RN-05)
      'ALTER TABLE categories ADD COLUMN parent_category_id TEXT',
      'ALTER TABLE categories ADD COLUMN icon TEXT',
      'ALTER TABLE categories ADD COLUMN color TEXT',
      'ALTER TABLE categories ADD COLUMN screenshot_count INTEGER DEFAULT 0',
      'ALTER TABLE categories ADD COLUMN is_favorite INTEGER DEFAULT 0',
      'ALTER TABLE categories ADD COLUMN path TEXT',
      'ALTER TABLE categories ADD COLUMN created_on TEXT',

      // Pending screenshots migrations (Sprint RN-03 / RN-04)
      'ALTER TABLE pending_screenshots ADD COLUMN device_folder TEXT',
      'ALTER TABLE pending_screenshots ADD COLUMN mime_type TEXT',
      'ALTER TABLE pending_screenshots ADD COLUMN resolution TEXT',
      'ALTER TABLE pending_screenshots ADD COLUMN width INTEGER DEFAULT 1080',
      'ALTER TABLE pending_screenshots ADD COLUMN height INTEGER DEFAULT 2400',
      'ALTER TABLE pending_screenshots ADD COLUMN ocr_status TEXT DEFAULT "Pending"',
      'ALTER TABLE pending_screenshots ADD COLUMN ocr_processing_time INTEGER DEFAULT 0',
      'ALTER TABLE pending_screenshots ADD COLUMN extracted_text TEXT',

      // OCR cache migrations (Sprint RN-04)
      'ALTER TABLE ocr_cache ADD COLUMN normalized_text TEXT',
      'ALTER TABLE ocr_cache ADD COLUMN processing_time INTEGER DEFAULT 0',
      'ALTER TABLE ocr_cache ADD COLUMN ocr_version TEXT DEFAULT "MLKit-Text-16.0.0"',
      'ALTER TABLE ocr_cache ADD COLUMN created_on TEXT',
      'ALTER TABLE ocr_cache ADD COLUMN blocks_json TEXT',

      // Screenshot table migrations (Sprint RN-06)
      'ALTER TABLE screenshots ADD COLUMN folder_path TEXT',
      'ALTER TABLE screenshots ADD COLUMN classification_source TEXT DEFAULT "local"',
    ];

    for (const alterSql of alterStatements) {
      try {
        await db.executeSql(alterSql);
      } catch {
        // Ignored if column already exists
      }
    }

    // Seed or update default smart categories
    for (const cat of DEFAULT_CATEGORIES) {
      await db.executeSql(
        `INSERT OR REPLACE INTO categories 
        (id, name, parent_id, parent_category_id, icon_name, icon, color_hex, color, description, is_system, order_index, is_favorite, path, created_on)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, coalesce((SELECT created_on FROM categories WHERE id = ?), ?))`,
        [
          cat.id,
          cat.name,
          cat.parentId || null,
          cat.parentCategoryId || cat.parentId || null,
          cat.iconName,
          cat.icon || cat.iconName,
          cat.colorHex,
          cat.color || cat.colorHex,
          cat.description || '',
          cat.isSystem ? 1 : 0,
          cat.orderIndex,
          cat.isFavorite ? 1 : 0,
          cat.path || `/${cat.name}`,
          cat.id,
          cat.createdOn || new Date().toISOString(),
        ]
      );
    }
  }

  async executeQuery(sql: string, params: any[] = []): Promise<any[]> {
    const db = await this.getDatabase();
    const [results] = await db.executeSql(sql, params);
    const rows: any[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      rows.push(results.rows.item(i));
    }
    return rows;
  }

  async executeCommand(sql: string, params: any[] = []): Promise<any> {
    const db = await this.getDatabase();
    const [results] = await db.executeSql(sql, params);
    return results;
  }
}

export const databaseService = new DatabaseService();
