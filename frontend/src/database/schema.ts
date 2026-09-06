import { DEFAULT_CATEGORIES } from '../models/category.model';

export const DATABASE_NAME = 'ai_screenshot_organizer.db';
export const DATABASE_VERSION = 3;

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

  // 10. Pending Screenshots Queue (Sprint RN-03 / RN-04)
  `CREATE TABLE IF NOT EXISTS pending_screenshots (
    id TEXT PRIMARY KEY,
    device_asset_id TEXT,
    file_path TEXT NOT NULL,
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
];
