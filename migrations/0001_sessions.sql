CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('daily', 'engineering', 'interview')),
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_completed_at_idx
  ON sessions (completed_at DESC);
