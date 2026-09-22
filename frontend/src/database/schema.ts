import { DEFAULT_CATEGORIES } from '../models/category.model';
import { VISION_CACHE_TABLE_SQL, VISION_CACHE_INDEXES_SQL } from './visionCacheMigration';

export const DATABASE_NAME = 'ai_screenshot_organizer.db';
export const DATABASE_VERSION = 9;

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
    analysis_status TEXT NOT NULL DEFAULT 'Pending',
    analysis_processing_time INTEGER NOT NULL DEFAULT 0,
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

  // 9. Chat History (Sprint RN-07 / Sprint P3-A)
  `CREATE TABLE IF NOT EXISTS chat_history (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    folder_id TEXT,
    screenshot_id TEXT,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    content TEXT,
    citations_json TEXT,
    referenced_screenshot_ids TEXT,
    response_time_ms INTEGER DEFAULT 0,
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
    vision_version TEXT,
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

  // 17. Analysis Queue (Sprint P5-A Background AI Processing Queue)
  `CREATE TABLE IF NOT EXISTS analysis_queue (
    id TEXT PRIMARY KEY,
    screenshot_id TEXT NOT NULL UNIQUE,
    state TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    priority TEXT NOT NULL DEFAULT 'medium',
    priority_order INTEGER NOT NULL DEFAULT 2,
    queued_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    error_message TEXT,
    processing_time_ms INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (screenshot_id) REFERENCES screenshots (id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_analysis_queue_state ON analysis_queue(state);`,
  `CREATE INDEX IF NOT EXISTS idx_analysis_queue_priority ON analysis_queue(priority_order DESC, queued_at ASC);`,
  `CREATE INDEX IF NOT EXISTS idx_analysis_queue_screenshot ON analysis_queue(screenshot_id);`,

  // 18. Memory Timeline (Sprint P3-A)
  `CREATE TABLE IF NOT EXISTS memory_timeline (
    id TEXT PRIMARY KEY,
    event_date TEXT NOT NULL,
    event_period TEXT NOT NULL,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    screenshot_ids_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_memory_timeline_date ON memory_timeline(event_date);`,
  `CREATE INDEX IF NOT EXISTS idx_memory_timeline_period ON memory_timeline(event_period);`,
  `CREATE INDEX IF NOT EXISTS idx_memory_timeline_type ON memory_timeline(event_type);`,

  // 19. Daily Digest (Sprint P3-A)
  `CREATE TABLE IF NOT EXISTS daily_digest (
    digest_date TEXT PRIMARY KEY,
    screenshot_count INTEGER NOT NULL DEFAULT 0,
    spending_total REAL NOT NULL DEFAULT 0.0,
    merchant_summary_json TEXT NOT NULL DEFAULT '[]',
    category_summary_json TEXT NOT NULL DEFAULT '{}',
    ai_summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_daily_digest_date ON daily_digest(digest_date);`,

  // 20. Weekly Digest (Sprint P3-A)
  `CREATE TABLE IF NOT EXISTS weekly_digest (
    week_key TEXT PRIMARY KEY,
    screenshot_count INTEGER NOT NULL DEFAULT 0,
    spending_total REAL NOT NULL DEFAULT 0.0,
    ai_summary TEXT NOT NULL DEFAULT '',
    top_categories_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE INDEX IF NOT EXISTS idx_weekly_digest_key ON weekly_digest(week_key);`,

  // 21. Monthly Digest (Sprint P3-A)
  `CREATE TABLE IF NOT EXISTS monthly_digest (
    month_key TEXT PRIMARY KEY,
    screenshot_count INTEGER NOT NULL DEFAULT 0,
    spending_total REAL NOT NULL DEFAULT 0.0,
    ai_summary TEXT NOT NULL DEFAULT '',
    insights_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE INDEX IF NOT EXISTS idx_monthly_digest_key ON monthly_digest(month_key);`,

  // 22. Chat Sessions (Sprint P3-B)
  `CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_message_preview TEXT,
    summary TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at);`,

  // 23. Chat Messages (Sprint P3-B)
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    citations_json TEXT DEFAULT '[]',
    screenshot_ids_json TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);`,
  `CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);`,
];
