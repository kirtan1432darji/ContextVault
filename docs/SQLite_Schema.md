# ContextVault — SQLite Local Database Schema (v5)

ContextVault mobile clients embed a local-first SQLite database (`ai_screenshot_organizer.db`, Schema Version 5).

---

## 1. Tables Definition

### 1. Categories Table (`categories`)
```sql
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  icon_name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
```

### 2. Screenshots Table (`screenshots`)
```sql
CREATE TABLE IF NOT EXISTS screenshots (
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
  folder_path TEXT,
  is_auto_categorized INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_reviewed INTEGER NOT NULL DEFAULT 0,
  is_synced INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  classification_source TEXT NOT NULL DEFAULT 'auto',
  ocr_status TEXT NOT NULL DEFAULT 'none',
  ocr_text TEXT,
  last_scanned_at TEXT,
  is_mock INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET DEFAULT
);
CREATE INDEX IF NOT EXISTS idx_screenshots_category_id ON screenshots(category_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_is_favorite ON screenshots(is_favorite);
CREATE INDEX IF NOT EXISTS idx_screenshots_is_deleted ON screenshots(is_deleted);
CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON screenshots(created_at);
CREATE INDEX IF NOT EXISTS idx_screenshots_folder_path ON screenshots(folder_path);
```

### 3. Tags & Many-to-Many Bridge (`tags`, `screenshot_tags`)
```sql
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color_hex TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS screenshot_tags (
  screenshot_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (screenshot_id, tag_id),
  FOREIGN KEY (screenshot_id) REFERENCES screenshots (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);
```

### 4. OCR Cache (`ocr_cache`)
```sql
CREATE TABLE IF NOT EXISTS ocr_cache (
  screenshot_id TEXT PRIMARY KEY,
  raw_text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  confidence REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (screenshot_id) REFERENCES screenshots (id) ON DELETE CASCADE
);
```

### 5. Chat History (`chat_history`)
```sql
CREATE TABLE IF NOT EXISTS chat_history (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  folder_id TEXT,
  screenshot_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  citations_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_folder_id ON chat_history(folder_id);
```

### 6. Search History & Saved Queries (`search_history`, `saved_searches`)
```sql
CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  category_filter TEXT,
  date_filter TEXT,
  results_count INTEGER NOT NULL DEFAULT 0,
  searched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  label TEXT NOT NULL,
  category_filter TEXT,
  date_filter TEXT,
  created_at TEXT NOT NULL
);
```

### 7. Sync Queue (`sync_queue`)
```sql
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  http_method TEXT NOT NULL DEFAULT 'POST',
  payload TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  last_error TEXT
);
```
