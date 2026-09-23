CREATE TABLE IF NOT EXISTS boss_fight_runs (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  scenario_version INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  decision_count INTEGER NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS boss_fight_runs_updated_at_idx
  ON boss_fight_runs (updated_at DESC);
