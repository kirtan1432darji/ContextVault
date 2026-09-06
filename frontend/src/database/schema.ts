import { DEFAULT_CATEGORIES } from '../models/category.model';

export const DATABASE_NAME = 'ai_screenshot_organizer.db';
export const DATABASE_VERSION = 1;

export const SCHEMA_SQL = [
  // 1. Categories
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    icon_name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);`,

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
    file_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    width INTEGER NOT NULL DEFAULT 1080,
    height INTEGER NOT NULL DEFAULT 2400,
    file_size INTEGER NOT NULL DEFAULT 0,
    category_id TEXT NOT NULL,
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
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET DEFAULT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_screenshots_cat ON screenshots(category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_screenshots_fav ON screenshots(is_favorite);`,
  `CREATE INDEX IF NOT EXISTS idx_screenshots_reviewed ON screenshots(is_reviewed);`,

  // 5. Screenshot Tags M2M
  `CREATE TABLE IF NOT EXISTS screenshot_tags (
    screenshot_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (screenshot_id, tag_id),
    FOREIGN KEY (screenshot_id) REFERENCES screenshots (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
  );`,

  // 6. OCR Cache
  `CREATE TABLE IF NOT EXISTS ocr_cache (
    screenshot_id TEXT PRIMARY KEY,
    raw_text TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    confidence REAL NOT NULL DEFAULT 1.0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (screenshot_id) REFERENCES screenshots (id) ON DELETE CASCADE
  );`,

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

  // 9. Chat History
  `CREATE TABLE IF NOT EXISTS chat_history (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    folder_id TEXT,
    screenshot_id TEXT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    citations_json TEXT,
    created_at TEXT NOT NULL
  );`,
];
