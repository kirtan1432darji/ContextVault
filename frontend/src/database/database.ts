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

    // Seed default categories if empty
    const [res] = await db.executeSql('SELECT COUNT(*) as count FROM categories');
    const count = res.rows.item(0).count;

    if (count === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await db.executeSql(
          `INSERT OR REPLACE INTO categories 
          (id, name, parent_id, icon_name, color_hex, description, is_system, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cat.id,
            cat.name,
            cat.parentId || null,
            cat.iconName,
            cat.colorHex,
            cat.description || '',
            cat.isSystem ? 1 : 0,
            cat.orderIndex,
          ]
        );
      }
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
