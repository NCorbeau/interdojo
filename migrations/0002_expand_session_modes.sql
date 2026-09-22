CREATE TABLE sessions_next (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  payload TEXT NOT NULL
);

INSERT INTO sessions_next (
  id, mode, started_at, completed_at, score, total, payload
)
SELECT id, mode, started_at, completed_at, score, total, payload
FROM sessions;

DROP TABLE sessions;

ALTER TABLE sessions_next RENAME TO sessions;

CREATE INDEX sessions_completed_at_idx
  ON sessions (completed_at DESC);
