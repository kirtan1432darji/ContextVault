import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';
import { DATABASE_NAME, SCHEMA_SQL } from './schema';
import { DEFAULT_CATEGORIES } from '../models/category.model';
import { VISION_CACHE_TABLE_SQL, VISION_CACHE_INDEXES_SQL } from './visionCacheMigration';

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
      try {
        await db.executeSql(statement);
      } catch (e) {
        // Continue creating subsequent tables even if one errors
      }
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
      'ALTER TABLE categories ADD COLUMN cover_uri TEXT',
      'ALTER TABLE categories ADD COLUMN manual_cover_uri TEXT',
      'ALTER TABLE categories ADD COLUMN average_confidence REAL DEFAULT 0.0',
      'ALTER TABLE categories ADD COLUMN storage_size_bytes INTEGER DEFAULT 0',
      'ALTER TABLE categories ADD COLUMN updated_at TEXT',

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

      // Screenshot table migrations (Sprint RN-06 & Sprint P1-5 Recycle Bin)
      'ALTER TABLE screenshots ADD COLUMN folder_path TEXT',
      'ALTER TABLE screenshots ADD COLUMN classification_source TEXT DEFAULT "local"',
      'ALTER TABLE screenshots ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE screenshots ADD COLUMN deleted_at TEXT',
      'CREATE INDEX IF NOT EXISTS idx_screenshots_deleted ON screenshots(is_deleted)',

      // Chat history migrations (Sprint RN-07)
      'ALTER TABLE chat_history ADD COLUMN message TEXT',
      'ALTER TABLE chat_history ADD COLUMN created_on TEXT',
      'ALTER TABLE chat_history ADD COLUMN sync_status TEXT DEFAULT "synced"',
      'CREATE INDEX IF NOT EXISTS idx_chat_history_folder ON chat_history(folder_id)',
      'CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_chat_history_created ON chat_history(created_on)',

      // Global Search migrations (Sprint RN-08)
      'CREATE TABLE IF NOT EXISTS recent_searches (id TEXT PRIMARY KEY, query TEXT NOT NULL UNIQUE, timestamp TEXT NOT NULL, result_count INTEGER NOT NULL DEFAULT 0)',
      'CREATE INDEX IF NOT EXISTS idx_recent_searches_time ON recent_searches(timestamp)',
      'CREATE TABLE IF NOT EXISTS saved_searches (id TEXT PRIMARY KEY, query TEXT NOT NULL UNIQUE, title TEXT, icon_name TEXT, color_hex TEXT, created_at TEXT NOT NULL)',
      'CREATE INDEX IF NOT EXISTS idx_saved_searches_created ON saved_searches(created_at)',

      // BugFix-01 MediaStore URI & Rendering Pipeline Migrations
      'ALTER TABLE screenshots ADD COLUMN local_path TEXT',
      'ALTER TABLE screenshots ADD COLUMN content_uri TEXT',
      'ALTER TABLE screenshots ADD COLUMN thumbnail_uri TEXT',
      'ALTER TABLE screenshots ADD COLUMN mime_type TEXT',
      'ALTER TABLE screenshots ADD COLUMN folder_id TEXT',
      'ALTER TABLE screenshots ADD COLUMN created_on TEXT',
      'ALTER TABLE pending_screenshots ADD COLUMN local_path TEXT',
      'ALTER TABLE pending_screenshots ADD COLUMN content_uri TEXT',
      'ALTER TABLE pending_screenshots ADD COLUMN thumbnail_uri TEXT',

      // Sprint P2-C Vision AI First Architecture Migrations
      'ALTER TABLE screenshots ADD COLUMN analysis_status TEXT DEFAULT "Pending"',
      'ALTER TABLE screenshots ADD COLUMN analysis_processing_time INTEGER DEFAULT 0',
      'ALTER TABLE classification_cache ADD COLUMN vision_version TEXT',

      // Sprint V01 Vision AI Cache
      VISION_CACHE_TABLE_SQL,
      ...VISION_CACHE_INDEXES_SQL,

      // Sprint P3-A Memory Timeline & Digest Migrations
      'CREATE TABLE IF NOT EXISTS memory_timeline (id TEXT PRIMARY KEY, event_date TEXT NOT NULL, event_period TEXT NOT NULL, event_type TEXT NOT NULL, summary TEXT NOT NULL, screenshot_ids_json TEXT NOT NULL DEFAULT "[]", created_at TEXT NOT NULL)',
      'CREATE INDEX IF NOT EXISTS idx_memory_timeline_date ON memory_timeline(event_date)',
      'CREATE INDEX IF NOT EXISTS idx_memory_timeline_period ON memory_timeline(event_period)',
      'CREATE INDEX IF NOT EXISTS idx_memory_timeline_type ON memory_timeline(event_type)',
      'CREATE TABLE IF NOT EXISTS daily_digest (digest_date TEXT PRIMARY KEY, screenshot_count INTEGER NOT NULL DEFAULT 0, spending_total REAL NOT NULL DEFAULT 0.0, merchant_summary_json TEXT NOT NULL DEFAULT "[]", category_summary_json TEXT NOT NULL DEFAULT "{}", ai_summary TEXT NOT NULL DEFAULT "", created_at TEXT NOT NULL)',
      'CREATE INDEX IF NOT EXISTS idx_daily_digest_date ON daily_digest(digest_date)',
      'CREATE TABLE IF NOT EXISTS weekly_digest (week_key TEXT PRIMARY KEY, screenshot_count INTEGER NOT NULL DEFAULT 0, spending_total REAL NOT NULL DEFAULT 0.0, ai_summary TEXT NOT NULL DEFAULT "", top_categories_json TEXT NOT NULL DEFAULT "[]", created_at TEXT NOT NULL DEFAULT (datetime("now")))',
      'CREATE INDEX IF NOT EXISTS idx_weekly_digest_key ON weekly_digest(week_key)',
      'CREATE TABLE IF NOT EXISTS monthly_digest (month_key TEXT PRIMARY KEY, screenshot_count INTEGER NOT NULL DEFAULT 0, spending_total REAL NOT NULL DEFAULT 0.0, ai_summary TEXT NOT NULL DEFAULT "", insights_json TEXT NOT NULL DEFAULT "{}", created_at TEXT NOT NULL DEFAULT (datetime("now")))',
      'CREATE INDEX IF NOT EXISTS idx_monthly_digest_key ON monthly_digest(month_key)',

      // Sprint P3-B Context Chat AI Migrations
      'CREATE TABLE IF NOT EXISTS chat_sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_message_preview TEXT, summary TEXT)',
      'CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at)',
      'CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, citations_json TEXT DEFAULT "[]", screenshot_ids_json TEXT DEFAULT "[]", created_at TEXT NOT NULL, FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE)',
      'CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at)',
    ];

    for (const alterSql of alterStatements) {
      try {
        await db.executeSql(alterSql);
      } catch {
        // Ignored if column already exists
      }
    }

    // Backfill empty or null columns for backwards compatibility
    const backfillStatements = [
      'UPDATE screenshots SET local_path = file_path WHERE local_path IS NULL OR local_path = ""',
      'UPDATE screenshots SET created_on = created_at WHERE created_on IS NULL OR created_on = ""',
      'UPDATE screenshots SET folder_id = category_id WHERE folder_id IS NULL OR folder_id = ""',
      'UPDATE pending_screenshots SET local_path = file_path WHERE local_path IS NULL OR local_path = ""',
      'UPDATE screenshots SET analysis_status = CASE WHEN ocr_status = "completed" THEN "Completed" WHEN ocr_status = "processing" THEN "Processing" WHEN ocr_status = "failed" THEN "Failed" ELSE "Pending" END WHERE analysis_status IS NULL',
      'UPDATE screenshots SET analysis_processing_time = 0 WHERE analysis_processing_time IS NULL',
    ];

    for (const sql of backfillStatements) {
      try {
        await db.executeSql(sql);
      } catch {}
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
export const getDatabase = () => databaseService.getDatabase();
