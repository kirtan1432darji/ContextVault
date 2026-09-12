export const VISION_CACHE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS vision_cache (
  screenshot_id TEXT PRIMARY KEY,
  screen_type TEXT NOT NULL,
  application_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  detected_objects TEXT NOT NULL,
  detected_entities TEXT NOT NULL,
  detected_logos TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.0,
  processed_at TEXT NOT NULL,
  model_version TEXT NOT NULL
);
`;

export const VISION_CACHE_INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_vision_cache_screen_type ON vision_cache(screen_type);`,
  `CREATE INDEX IF NOT EXISTS idx_vision_cache_processed_at ON vision_cache(processed_at);`,
  `CREATE INDEX IF NOT EXISTS idx_vision_cache_app ON vision_cache(application_name);`,
];
