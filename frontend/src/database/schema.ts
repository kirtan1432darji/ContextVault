import { DEFAULT_CATEGORIES } from '../models/category.model';
import { VISION_CACHE_TABLE_SQL, VISION_CACHE_INDEXES_SQL } from './visionCacheMigration';

export const DATABASE_NAME = 'ai_screenshot_organizer.db';
export const DATABASE_VERSION = 7;

export const SCHEMA_SQL = [
  // 1. Categories (Sprint RN-05 Dynamic Smart Folder Hierarchy)
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    parent_category_id TEXT,
    icon_name TEXT NOT NULL,
    icon TEXT,
    color_hex TEXT NOT NULL,
    color TEXT,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0,
    screenshot_count INTEGER NOT NULL DEFAULT 0,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    path TEXT,
    created_on TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);`,
  `CREATE INDEX IF NOT EXISTS idx_categories_parent_cat ON categories(parent_category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_categories_fav ON categories(is_favorite);`,

  // 2. Folders
  `CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );`,

  // 3. Tags
  `CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color_hex TEXT NOT NULL
  );`,

  // 4. Screenshots
  `CREATE TABLE IF NOT EXISTS screenshots (
    id TEXT PRIMARY KEY,
    device_asset_id TEXT,
    file_path TEXT NOT NULL,
    local_path TEXT,
    content_uri TEXT,
    thumbnail_uri TEXT,
    file_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_on TEXT,
    width INTEGER NOT NULL DEFAULT 1080,
    height INTEGER NOT NULL DEFAULT 2400,
    file_size INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT,
    category_id TEXT NOT NULL,
    folder_id TEXT,
    category_name TEXT NOT NULL,
    subcategory TEXT,
    confidence REAL NOT NULL DEFAULT 0.0,
    source_app TEXT,
    detected_app TEXT,
    keywords_json TEXT,
    is_auto_categorized INTEGER NOT NULL DEFAULT 0,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    is_reviewed INTEGER NOT NULL DEFAULT 0,
    is_synced INTEGER NOT NULL DEFAULT 0,
    ocr_status TEXT NOT NULL DEFAULT 'none',
    ocr_text TEXT,
    last_scanned_at TEXT,
    is_mock INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET DEFAULT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_screenshots_cat ON screenshots(category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_screenshots_fav ON screenshots(is_favorite);`,
  `CREATE INDEX IF NOT EXISTS idx_screenshots_reviewed ON screenshots(is_reviewed);`,
  `CREATE INDEX IF NOT EXISTS idx_screenshots_deleted ON screenshots(is_deleted);`,

  // 5. Screenshot Tags M2M
  `CREATE TABLE IF NOT EXISTS screenshot_tags (
    screenshot_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (screenshot_id, tag_id),
    FOREIGN KEY (screenshot_id) REFERENCES screenshots (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
  );`,

  // 6. OCRCache (Sprint RN-04 Table)
  `CREATE TABLE IF NOT EXISTS ocr_cache (
    id TEXT PRIMARY KEY,
    screenshot_id TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    normalized_text TEXT,
    processing_time INTEGER NOT NULL DEFAULT 0,
    language TEXT NOT NULL DEFAULT 'en',
    ocr_version TEXT NOT NULL DEFAULT 'MLKit-Text-16.0.0',
    confidence REAL NOT NULL DEFAULT 1.0,
    blocks_json TEXT,
    created_on TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_ocr_screenshot ON ocr_cache(screenshot_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ocr_created ON ocr_cache(created_on);`,

  // 7. Sync Queue
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    http_method TEXT NOT NULL DEFAULT 'POST',
    payload TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    last_error TEXT
  );`,

  // 8. Classification History
  `CREATE TABLE IF NOT EXISTS classification_history (
    id TEXT PRIMARY KEY,
    screenshot_id TEXT NOT NULL,
    category TEXT NOT NULL,
    sub_category TEXT,
    tags_json TEXT,
    confidence REAL NOT NULL DEFAULT 0.0,
    model_name TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (screenshot_id) REFERENCES screenshots (id) ON DELETE CASCADE
  );`,

  // 9. Chat History (Sprint RN-07)
  `CREATE TABLE IF NOT EXISTS chat_history (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    folder_id TEXT,
    screenshot_id TEXT,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    content TEXT,
    citations_json TEXT,
    created_on TEXT NOT NULL,
    created_at TEXT,
    sync_status TEXT NOT NULL DEFAULT 'synced'
  );`,
  `CREATE INDEX IF NOT EXISTS idx_chat_history_folder ON chat_history(folder_id);`,
  `CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id);`,
  `CREATE INDEX IF NOT EXISTS idx_chat_history_created ON chat_history(created_on);`,

  // 10. Pending Screenshots Queue (Sprint RN-03 / RN-04)
  `CREATE TABLE IF NOT EXISTS pending_screenshots (
    id TEXT PRIMARY KEY,
    device_asset_id TEXT,
    file_path TEXT NOT NULL,
    local_path TEXT,
    content_uri TEXT,
    thumbnail_uri TEXT,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    file_hash TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    device_folder TEXT,
    mime_type TEXT,
    resolution TEXT,
    width INTEGER DEFAULT 1080,
    height INTEGER DEFAULT 2400,
    ocr_status TEXT DEFAULT 'Pending',
    ocr_processing_time INTEGER DEFAULT 0,
    extracted_text TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_screenshots(status);`,
  `CREATE INDEX IF NOT EXISTS idx_pending_ocr_status ON pending_screenshots(ocr_status);`,
  `CREATE INDEX IF NOT EXISTS idx_pending_hash ON pending_screenshots(file_hash);`,
  `CREATE INDEX IF NOT EXISTS idx_pending_asset ON pending_screenshots(device_asset_id);`,

  // 11. FolderContext (Sprint RN-06)
  `CREATE TABLE IF NOT EXISTS folder_context (
    folder_id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    entities_json TEXT,
    tasks_json TEXT,
    updated_on TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  );`,
  `CREATE INDEX IF NOT EXISTS idx_folder_context_updated ON folder_context(updated_on);`,

  // 12. ClassificationCache (Sprint RN-06)
  `CREATE TABLE IF NOT EXISTS classification_cache (
    id TEXT PRIMARY KEY,
    screenshot_id TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    tags_json TEXT,
    entities_json TEXT,
    confidence REAL NOT NULL DEFAULT 0.0,
    summary TEXT,
    source TEXT NOT NULL DEFAULT 'backend',
    cached_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_classification_cache_screenshot ON classification_cache(screenshot_id);`,
  `CREATE INDEX IF NOT EXISTS idx_classification_cache_cached ON classification_cache(cached_at);`,

  // 13. Recent Searches (Sprint RN-08)
  `CREATE TABLE IF NOT EXISTS recent_searches (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL UNIQUE,
    timestamp TEXT NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_recent_searches_time ON recent_searches(timestamp);`,

  // 14. Saved Searches (Sprint RN-08)
  `CREATE TABLE IF NOT EXISTS saved_searches (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL UNIQUE,
    title TEXT,
    icon_name TEXT,
    color_hex TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_saved_searches_created ON saved_searches(created_at);`,

  // 15. Vision AI Cache (Sprint V01)
  VISION_CACHE_TABLE_SQL,
  ...VISION_CACHE_INDEXES_SQL,

  // 16. Thumbnail Cache (Sprint P0-B)
  `CREATE TABLE IF NOT EXISTS thumbnail_cache (
    id TEXT PRIMARY KEY,
    screenshot_id TEXT NOT NULL,
    file_hash TEXT,
    thumbnail_path TEXT NOT NULL,
    width INTEGER NOT NULL DEFAULT 300,
    height INTEGER NOT NULL DEFAULT 300,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE INDEX IF NOT EXISTS idx_thumbnail_screenshot ON thumbnail_cache(screenshot_id);`,
  `CREATE INDEX IF NOT EXISTS idx_thumbnail_hash ON thumbnail_cache(file_hash);`,
];
